"""Export a language word list snapshot from system Hunspell dictionaries."""

from __future__ import annotations

import argparse
from collections import Counter, defaultdict
import json
from datetime import datetime, timezone
from pathlib import Path
import re

from dictionary_provider import normalize_word


DEFAULT_MINIMUM_LENGTH = 3
DEFAULT_MAXIMUM_LENGTH = 16
DEFAULT_SELECTION_STRATEGY = "representative"
DEFAULT_HUNSPELL_DICTIONARIES = {
    "el": {
        "dictionary_id": "el_GR",
        "dic_path": Path("/usr/share/hunspell/el_GR.dic"),
        "aff_path": Path("/usr/share/hunspell/el_GR.aff"),
    },
    "en": {
        "dictionary_id": "en_US",
        "dic_path": Path("/usr/share/hunspell/en_US.dic"),
        "aff_path": Path("/usr/share/hunspell/en_US.aff"),
    },
}


def parse_arguments() -> argparse.Namespace:
    """Parse CLI flags for dictionary export."""

    parser = argparse.ArgumentParser(
        description="Export a Hunspell language snapshot to a reusable local file."
    )
    parser.add_argument("--language", type=str, default="en", help="Dictionary language code.")
    parser.add_argument(
        "--minimum-length",
        type=int,
        default=DEFAULT_MINIMUM_LENGTH,
        help="Minimum word length to include in the snapshot.",
    )
    parser.add_argument(
        "--maximum-length",
        type=int,
        default=DEFAULT_MAXIMUM_LENGTH,
        help="Maximum word length to include in the snapshot.",
    )
    parser.add_argument(
        "--maximum-words",
        type=int,
        default=None,
        help="Optional cap on the exported word count after normalization.",
    )
    parser.add_argument(
        "--selection-strategy",
        type=str,
        default=DEFAULT_SELECTION_STRATEGY,
        choices=("ordered", "representative"),
        help="How to choose words when --maximum-words is set.",
    )
    parser.add_argument(
        "--source-file",
        type=Path,
        default=None,
        help="Optional existing TXT or JSON export to use as the word source.",
    )
    parser.add_argument(
        "--hunspell-dic",
        type=Path,
        default=None,
        help="Optional path to a Hunspell .dic file. Overrides the built-in language mapping.",
    )
    parser.add_argument(
        "--hunspell-aff",
        type=Path,
        default=None,
        help="Optional path to a Hunspell .aff file. Used to detect dictionary encoding.",
    )
    parser.add_argument(
        "--skip-if-exists",
        action="store_true",
        help="Exit successfully without rewriting the file when the output already exists.",
    )
    parser.add_argument("--output", type=Path, required=True, help="Output JSON file path.")
    return parser.parse_args()


def normalize_words(
    raw_words: list[str],
    minimum_length: int,
    maximum_length: int,
) -> list[str]:
    """Filter exported words into an ordered, deduplicated uppercase list."""

    normalized_words: list[str] = []
    seen: set[str] = set()

    for raw_word in raw_words:
        word = normalize_word(raw_word, uppercase=True)
        if len(word) < minimum_length or len(word) > maximum_length:
            continue
        if not word.isalpha():
            continue
        if word in seen:
            continue

        seen.add(word)
        normalized_words.append(word)

    return normalized_words


def read_raw_words_from_export(source_file: Path) -> list[str]:
    """Read raw words from an existing TXT or JSON export file."""

    if not source_file.exists():
        raise SystemExit(f"Source file '{source_file}' was not found.")

    if source_file.suffix.lower() == ".txt":
        return [line for line in source_file.read_text(encoding="utf-8").splitlines() if line.strip()]

    try:
        payload = json.loads(source_file.read_text(encoding="utf-8"))
    except json.JSONDecodeError as error:
        raise SystemExit(f"Source file '{source_file}' is not valid JSON.") from error

    if isinstance(payload, list):
        return [word for word in payload if isinstance(word, str)]

    if isinstance(payload, dict) and isinstance(payload.get("words"), list):
        return [word for word in payload["words"] if isinstance(word, str)]

    raise SystemExit(
        f"Source file '{source_file}' must be a TXT file, a JSON array, or a JSON "
        "object containing a 'words' array."
    )


def resolve_hunspell_paths(arguments: argparse.Namespace) -> tuple[str, Path, Path | None]:
    """Resolve which Hunspell dictionary files to use for the requested language."""

    if arguments.hunspell_dic is not None:
        dictionary_id = arguments.hunspell_dic.stem
        return dictionary_id, arguments.hunspell_dic, arguments.hunspell_aff

    language = arguments.language.strip().lower()
    config = DEFAULT_HUNSPELL_DICTIONARIES.get(language)
    if config is None:
        supported_languages = ", ".join(sorted(DEFAULT_HUNSPELL_DICTIONARIES))
        raise SystemExit(
            f"No built-in Hunspell dictionary is configured for '{arguments.language}'. "
            f"Supported languages: {supported_languages}. "
            "Use --hunspell-dic/--hunspell-aff to supply custom files."
        )

    return config["dictionary_id"], config["dic_path"], config["aff_path"]


def resolve_word_source(arguments: argparse.Namespace) -> tuple[str, str, list[str]]:
    """Load raw words from either an export file or a Hunspell dictionary."""

    if arguments.source_file is not None:
        source_file = arguments.source_file
        return source_file.stem, "snapshot", read_raw_words_from_export(source_file)

    dictionary_id, dic_path, aff_path = resolve_hunspell_paths(arguments)
    return dictionary_id, "hunspell", load_hunspell_words(dic_path, aff_path)


def detect_dictionary_encoding(aff_path: Path | None) -> str:
    """Detect the Hunspell dictionary encoding from the .aff file."""

    if aff_path is None or not aff_path.exists():
        return "utf-8"

    aff_text = aff_path.read_text(encoding="latin-1")
    match = re.search(r"(?m)^SET\s+([^\s]+)\s*$", aff_text)
    if not match:
        return "utf-8"

    declared_encoding = match.group(1).strip()
    return "utf-8" if declared_encoding.upper() == "UTF-8" else declared_encoding


def load_hunspell_words(dic_path: Path, aff_path: Path | None) -> list[str]:
    """Load raw dictionary stems from a Hunspell .dic file."""

    if not dic_path.exists():
        raise SystemExit(f"Hunspell dictionary file '{dic_path}' was not found.")

    encoding = detect_dictionary_encoding(aff_path)
    lines = dic_path.read_text(encoding=encoding).splitlines()
    if not lines:
        return []

    start_index = 1 if lines[0].strip().isdigit() else 0
    raw_words: list[str] = []

    for line in lines[start_index:]:
        stripped_line = line.strip()
        if not stripped_line or stripped_line.startswith("#"):
            continue

        token = stripped_line.split(maxsplit=1)[0]
        stem = token.split("/", maxsplit=1)[0]
        if stem:
            raw_words.append(stem)

    return raw_words


def build_letter_frequency(words: list[str]) -> Counter[str]:
    """Count single-letter frequency across the normalized word list."""

    counts: Counter[str] = Counter()
    for word in words:
        counts.update(word)
    return counts


def build_bigram_frequency(words: list[str]) -> Counter[str]:
    """Count adjacent two-letter combinations across the normalized word list."""

    counts: Counter[str] = Counter()
    for word in words:
        counts.update(word[index : index + 2] for index in range(len(word) - 1))
    return counts


def build_representative_word_key(
    word: str,
    *,
    letter_frequency: Counter[str],
    bigram_frequency: Counter[str],
) -> tuple[float, float, float, str]:
    """Build a deterministic ranking key for representative word selection."""

    average_letter_score = sum(letter_frequency[character] for character in word) / len(word)
    if len(word) > 1:
        average_bigram_score = sum(
            bigram_frequency[word[index : index + 2]] for index in range(len(word) - 1)
        ) / (len(word) - 1)
    else:
        average_bigram_score = average_letter_score
    unique_ratio = len(set(word)) / len(word)
    return (-average_bigram_score, -average_letter_score, -unique_ratio, word)


def allocate_length_quotas(
    words_by_length: dict[int, list[str]],
    *,
    maximum_words: int,
    minimum_length: int,
    maximum_length: int,
) -> dict[int, int]:
    """Distribute the target word cap across lengths with a playable-length bias."""

    lengths = sorted(words_by_length)
    if not lengths:
        return {}

    target_length = min(max(minimum_length, 7), maximum_length)

    def length_preference(length: int) -> float:
        distance = abs(length - target_length)
        if length <= target_length:
            base_weight = 12 - (distance * 2.2)
        else:
            base_weight = 12 - (distance * 2.8)

        if length <= 4:
            base_weight *= 0.75
        if length >= 10:
            base_weight *= 0.55
        if length >= 12:
            base_weight *= 0.3
        if length >= 14:
            base_weight *= 0.2

        return max(base_weight, 0.05)

    weighted_capacity = {
        length: (len(words_by_length[length]) ** 0.5) * length_preference(length)
        for length in lengths
    }
    total_weight = sum(weighted_capacity.values())
    if total_weight <= 0:
        return {length: 0 for length in lengths}

    raw_quota = {
        length: maximum_words * weighted_capacity[length] / total_weight for length in lengths
    }
    quotas = {
        length: min(len(words_by_length[length]), int(raw_quota[length])) for length in lengths
    }

    if maximum_words >= len(lengths):
        for length in lengths:
            if quotas[length] == 0 and words_by_length[length]:
                quotas[length] = 1

    total_allocated = sum(quotas.values())
    if total_allocated > maximum_words:
        for length in sorted(
            lengths,
            key=lambda current: (
                quotas[current] - raw_quota[current],
                abs(current - target_length),
                current,
            ),
            reverse=True,
        ):
            while total_allocated > maximum_words and quotas[length] > 0:
                quotas[length] -= 1
                total_allocated -= 1

    while total_allocated < maximum_words:
        candidates = [
            length
            for length in lengths
            if quotas[length] < len(words_by_length[length])
        ]
        if not candidates:
            break

        best_length = max(
            candidates,
            key=lambda current: (
                raw_quota[current] - quotas[current],
                weighted_capacity[current],
                -abs(current - target_length),
                -current,
            ),
        )
        quotas[best_length] += 1
        total_allocated += 1

    return quotas


def select_representative_words(
    words: list[str],
    *,
    maximum_words: int,
    minimum_length: int,
    maximum_length: int,
) -> list[str]:
    """Select a deterministic representative subset from a large word list."""

    if maximum_words >= len(words):
        return words

    words_by_length: dict[int, list[str]] = defaultdict(list)
    for word in words:
        words_by_length[len(word)].append(word)

    letter_frequency = build_letter_frequency(words)
    bigram_frequency = build_bigram_frequency(words)
    quotas = allocate_length_quotas(
        words_by_length,
        maximum_words=maximum_words,
        minimum_length=minimum_length,
        maximum_length=maximum_length,
    )

    selected: list[str] = []
    leftovers: list[str] = []
    for length in sorted(words_by_length):
        ranked_words = sorted(
            words_by_length[length],
            key=lambda word: build_representative_word_key(
                word,
                letter_frequency=letter_frequency,
                bigram_frequency=bigram_frequency,
            ),
        )
        quota = quotas.get(length, 0)
        selected.extend(ranked_words[:quota])
        leftovers.extend(ranked_words[quota:])

    if len(selected) < maximum_words:
        selected.extend(leftovers[: maximum_words - len(selected)])

    return sorted(selected[:maximum_words])


def apply_word_limit(
    words: list[str],
    *,
    maximum_words: int | None,
    selection_strategy: str,
    minimum_length: int,
    maximum_length: int,
) -> list[str]:
    """Apply the optional export size cap using the requested strategy."""

    if maximum_words is None or maximum_words >= len(words):
        return words
    if maximum_words < 1:
        raise SystemExit("--maximum-words must be at least 1.")

    if selection_strategy == "ordered":
        return words[:maximum_words]

    return select_representative_words(
        words,
        maximum_words=maximum_words,
        minimum_length=minimum_length,
        maximum_length=maximum_length,
    )


def build_payload(
    arguments: argparse.Namespace,
    words: list[str],
    *,
    dictionary_id: str,
    source: str,
) -> dict[str, object]:
    """Construct the export payload with enough metadata for debugging."""

    return {
        "language": arguments.language,
        "exportedAt": datetime.now(timezone.utc).isoformat(),
        "source": source,
        "dictionaryId": dictionary_id,
        "minimumLength": arguments.minimum_length,
        "maximumLength": arguments.maximum_length,
        "maximumWords": arguments.maximum_words,
        "selectionStrategy": arguments.selection_strategy,
        "wordCount": len(words),
        "words": words,
    }


def write_output(output_path: Path, payload: dict[str, object]) -> None:
    """Write the export payload to disk."""

    output_path.parent.mkdir(parents=True, exist_ok=True)
    words = payload.get("words", [])
    if output_path.suffix.lower() == ".txt":
        output_path.write_text(
            "\n".join(words) + "\n",
            encoding="utf-8",
        )
        return

    output_path.write_text(
        json.dumps(payload, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )


def should_skip_existing_output(output_path: Path) -> bool:
    """Return whether an existing export can be reused as-is."""

    if output_path.suffix.lower() == ".txt":
        try:
            return bool(output_path.read_text(encoding="utf-8").strip())
        except OSError:
            return False

    try:
        payload = json.loads(output_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return False

    return payload.get("source") == "hunspell"


def main() -> None:
    """Export the requested word list snapshot."""

    arguments = parse_arguments()
    if arguments.skip_if_exists and arguments.output.exists() and should_skip_existing_output(
        arguments.output
    ):
        print(f"Dictionary snapshot already exists at {arguments.output.as_posix()}")
        return

    dictionary_id, source_name, raw_words = resolve_word_source(arguments)
    normalized_words = normalize_words(
        raw_words=raw_words,
        minimum_length=arguments.minimum_length,
        maximum_length=arguments.maximum_length,
    )
    words = apply_word_limit(
        normalized_words,
        maximum_words=arguments.maximum_words,
        selection_strategy=arguments.selection_strategy,
        minimum_length=arguments.minimum_length,
        maximum_length=arguments.maximum_length,
    )
    if not words:
        raise SystemExit(
            f"No usable words were exported for language '{arguments.language}'."
        )

    payload = build_payload(
        arguments,
        words,
        dictionary_id=dictionary_id,
        source=source_name,
    )
    write_output(arguments.output, payload)
    print(
        f"Exported {len(words)} words for '{arguments.language}' from "
        f"{source_name}:{dictionary_id} to {arguments.output.as_posix()}"
    )


if __name__ == "__main__":
    main()
