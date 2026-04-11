"""Dictionary access for multilingual board generation."""

from __future__ import annotations

from collections import defaultdict
import json
from pathlib import Path
from typing import Any
import unicodedata

DEFAULT_DICTIONARY_DIR = Path(__file__).resolve().parent / "dictionaries"


def strip_accents(value: str) -> str:
    """Remove combining accents and diacritics from a string."""

    normalized = unicodedata.normalize("NFKD", value)
    return "".join(character for character in normalized if not unicodedata.combining(character))


def normalize_word(value: str, *, uppercase: bool) -> str:
    """Normalize one dictionary word into a stable accent-free form."""

    normalized = strip_accents(value.strip())
    return normalized.upper() if uppercase else normalized.lower()


class DictionaryProvider:
    """Loads and indexes candidate words for a given language from an exported file."""

    def __init__(
        self,
        language: str,
        minimum_length: int,
        maximum_length: int,
        dictionary_file: Path | None = None,
        maximum_words: int | None = None,
    ) -> None:
        """Store provider settings without loading the dictionary yet."""

        self.language = language
        self.minimum_length = minimum_length
        self.maximum_length = maximum_length
        self.maximum_words = maximum_words
        self.dictionary_file = (
            dictionary_file
            if dictionary_file is not None
            else self.get_default_dictionary_file(language)
        )
        self.words: list[str] = []
        self.words_by_first_letter: dict[str, list[str]] = defaultdict(list)
        self.letter_weights: list[str] = []

    @staticmethod
    def get_default_dictionary_file(language: str) -> Path:
        """Return the conventional exported dictionary path for one language."""

        normalized_language = language.strip().lower()
        return DEFAULT_DICTIONARY_DIR / f"{normalized_language}.txt"

    def load(self) -> None:
        """Load and index words for the configured language from an exported snapshot."""

        words = self._load_words_from_file()
        if not words:
            raise ValueError(
                f"Dictionary file '{self.dictionary_file}' contained no usable words "
                f"for language '{self.language}'."
            )

        self.words = words
        self.words_by_first_letter = self._index_by_first_letter(words)
        self.letter_weights = self._build_letter_weights(words)

    def _load_words_from_file(self) -> list[str]:
        """Load filtered words from the exported dictionary file."""

        if not self.dictionary_file.exists():
            raise FileNotFoundError(
                f"Dictionary file '{self.dictionary_file}' was not found. "
                "Run export_dictionary.py first."
            )

        raw_words = self._read_raw_words(self.dictionary_file)
        normalized_words = self._normalize_words(raw_words)
        if self.maximum_words is None:
            return normalized_words
        return normalized_words[: self.maximum_words]

    def _read_raw_words(self, dictionary_file: Path) -> list[str]:
        """Read the exported word list from JSON or plain text."""

        if dictionary_file.suffix.lower() == ".txt":
            return dictionary_file.read_text(encoding="utf-8").splitlines()

        payload = json.loads(dictionary_file.read_text(encoding="utf-8"))
        return self._extract_words_from_json_payload(payload)

    def _extract_words_from_json_payload(self, payload: Any) -> list[str]:
        """Extract the raw word sequence from the exported JSON payload."""

        if isinstance(payload, list):
            return [word for word in payload if isinstance(word, str)]

        if isinstance(payload, dict) and isinstance(payload.get("words"), list):
            return [word for word in payload["words"] if isinstance(word, str)]

        raise ValueError(
            f"Dictionary file '{self.dictionary_file}' must be a JSON array or an "
            "object containing a 'words' array."
        )

    def _normalize_words(self, raw_words: list[str]) -> list[str]:
        """Filter raw dictionary words into board-friendly candidates."""

        filtered: list[str] = []
        seen: set[str] = set()

        for raw_word in raw_words:
            word = normalize_word(raw_word, uppercase=False)
            if len(word) < self.minimum_length or len(word) > self.maximum_length:
                continue
            if not word.isalpha():
                continue
            if word in seen:
                continue
            seen.add(word)
            filtered.append(word)

        return filtered

    def _index_by_first_letter(self, words: list[str]) -> dict[str, list[str]]:
        """Group words by their initial letter."""

        grouped: dict[str, list[str]] = defaultdict(list)
        for word in words:
            grouped[word[0]].append(word)
        return grouped

    def _build_letter_weights(self, words: list[str]) -> list[str]:
        """Build a weighted letter pool from the loaded dictionary."""

        pool: list[str] = []
        for word in words:
            pool.extend(word.upper())
        if not pool:
            raise ValueError(
                f"Dictionary file '{self.dictionary_file}' produced no letters "
                f"for language '{self.language}'."
            )
        return pool
