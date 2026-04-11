"""CLI entrypoint for generating solvable Blitz boards organised by year."""

from __future__ import annotations

import argparse
import calendar
import sys
from pathlib import Path

from board_generator import BoardGenerator
from board_types import BoardSpec
from dictionary_provider import DictionaryProvider

BOARDS_PER_YEAR = 366


def parse_arguments() -> argparse.Namespace:
    """Parse CLI flags for board generation."""

    parser = argparse.ArgumentParser(description="Generate solvable daily Blitz boards organised by year.")
    parser.add_argument(
        "--years",
        type=str,
        required=True,
        help="Comma-separated years to generate boards for, e.g. 2026,2027.",
    )
    parser.add_argument(
        "--sizes",
        type=str,
        required=True,
        help="Comma-separated board sizes such as 4x4,10x10,100x100.",
    )
    parser.add_argument("--language", type=str, default="en", help="Dictionary language code.")
    parser.add_argument(
        "--minimum-length",
        type=int,
        default=3,
        help="Minimum allowed word length.",
    )
    parser.add_argument(
        "--maximum-word-length",
        type=int,
        default=7,
        help="Maximum dictionary word length considered for placement.",
    )
    parser.add_argument(
        "--maximum-words",
        type=int,
        default=6,
        help="Maximum number of chained solution words.",
    )
    parser.add_argument(
        "--dictionary-file",
        type=Path,
        default=None,
        help="Path to an exported dictionary JSON or TXT file.",
    )
    parser.add_argument("--seed", type=int, default=None, help="Optional base random seed (varied per year).")
    parser.add_argument(
        "--output-dir",
        type=str,
        required=True,
        help="Root output directory. Boards are written to {output_dir}/{language}/{year}/boards.txt.",
    )
    return parser.parse_args()


def parse_years(years_argument: str) -> list[int]:
    """Parse the requested years from the CLI string."""

    years: list[int] = []
    for part in years_argument.split(","):
        cleaned = part.strip()
        if not cleaned.isdigit():
            raise ValueError(f"Invalid year: {part!r}")
        year = int(cleaned)
        if year < 1:
            raise ValueError(f"Year must be positive: {part!r}")
        years.append(year)
    if not years:
        raise ValueError("At least one year must be provided.")
    return years


def parse_sizes(size_argument: str) -> list[BoardSpec]:
    """Parse the requested board sizes from the CLI string."""

    sizes: list[BoardSpec] = []
    for part in size_argument.split(","):
        cleaned = part.strip().lower()
        if "x" not in cleaned:
            raise ValueError(f"Invalid board size: {part}")
        rows_text, cols_text = cleaned.split("x", maxsplit=1)
        rows = int(rows_text)
        cols = int(cols_text)
        if rows < 1 or cols < 1:
            raise ValueError(f"Board size must be positive: {part}")
        sizes.append(BoardSpec(rows=rows, cols=cols))
    return sizes


def boards_in_year(year: int) -> int:
    """Return the number of days in the given year (365 or 366)."""

    return 366 if calendar.isleap(year) else 365


def derive_year_seed(base_seed: int | None, year: int) -> int | None:
    """Derive a deterministic per-year seed from the base seed and year."""

    if base_seed is None:
        return None
    return (base_seed * 1_000_000 + year) & 0xFFFF_FFFF


def write_year_output(output_path: Path, boards: list[dict]) -> None:
    """Write the generated boards for one year to disk in tab-separated format."""

    output_path.parent.mkdir(parents=True, exist_ok=True)
    board_lines = [
        f"{board['board_id']}\t{''.join(''.join(row) for row in board['grid'])}"
        for board in boards
    ]
    output_path.write_text("\n".join(board_lines) + "\n", encoding="utf-8")


def main() -> None:
    """Run the board generator CLI."""

    try:
        arguments = parse_arguments()
        years = parse_years(arguments.years)
        sizes = parse_sizes(arguments.sizes)
        output_root = Path(arguments.output_dir)

        provider = DictionaryProvider(
            language=arguments.language,
            minimum_length=arguments.minimum_length,
            maximum_length=arguments.maximum_word_length,
            dictionary_file=arguments.dictionary_file,
        )
        provider.load()
        print(f"Loaded dictionary with {len(provider.words)} words.", flush=True)

        for year in years:
            count = boards_in_year(year)
            year_seed = derive_year_seed(arguments.seed, year)
            output_path = output_root / arguments.language / str(year) / "boards.txt"

            print(
                f"Generating {count} boards for {year}:",
                {
                    "sizes": arguments.sizes,
                    "language": arguments.language,
                    "minimum_length": arguments.minimum_length,
                    "maximum_word_length": arguments.maximum_word_length,
                    "maximum_words": arguments.maximum_words,
                    "seed": year_seed,
                    "output": output_path.as_posix(),
                },
                flush=True,
            )

            generator = BoardGenerator(
                dictionary_provider=provider,
                minimum_length=arguments.minimum_length,
                maximum_words=arguments.maximum_words,
                random_seed=year_seed,
            )
            boards = generator.generate_boards(count, sizes)
            write_year_output(output_path, boards)
            print(f"Wrote {len(boards)} boards to {output_path.as_posix()}", flush=True)

    except Exception as error:
        print(f"Board generation failed: {error}", file=sys.stderr, flush=True)
        raise SystemExit(1) from error


if __name__ == "__main__":
    main()
