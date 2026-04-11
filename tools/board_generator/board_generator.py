"""Board construction logic for solvable Blitz boards."""

from __future__ import annotations

import random
from dataclasses import asdict

from board_solver import build_neighbors, find_all_words
from board_types import BoardSpec, Cell, GeneratedBoard, PlacedWord
from dictionary_provider import DictionaryProvider
from trie import Trie

MAX_SEGMENT_LENGTH = 6
ROUTE_ATTEMPTS = 160
WORD_CHAIN_ATTEMPTS = 120


class BoardGenerationError(RuntimeError):
    """Raised when a solvable board cannot be generated within the attempt limit."""


class BoardGenerator:
    """Generates solvable boards and exports their valid words."""

    def __init__(
        self,
        dictionary_provider: DictionaryProvider,
        minimum_length: int,
        maximum_words: int,
        random_seed: int | None = None,
    ) -> None:
        """Store generation settings and initialize deterministic randomness."""

        self.dictionary_provider = dictionary_provider
        self.minimum_length = minimum_length
        self.maximum_words = maximum_words
        self.random = random.Random(random_seed)
        self.trie = Trie(dictionary_provider.words)

    def generate_boards(self, count: int, sizes: list[BoardSpec]) -> list[dict]:
        """Generate multiple boards across the requested size pool."""

        generated: list[dict] = []
        for board_index in range(count):
            spec = self.random.choice(sizes)
            board = self.generate_board(spec, board_index)
            generated.append(asdict(board))
        return generated

    def generate_board(self, spec: BoardSpec, board_index: int) -> GeneratedBoard:
        """Generate one solvable board for the provided size."""

        for attempt in range(200):
            candidate = self._try_generate_board(spec, board_index, attempt)
            if candidate is not None:
                return candidate

        raise BoardGenerationError(
            f"Could not generate a solvable {spec.rows}x{spec.cols} board after repeated attempts."
        )

    def _try_generate_board(
        self,
        spec: BoardSpec,
        board_index: int,
        attempt: int,
    ) -> GeneratedBoard | None:
        """Attempt to build one valid board candidate."""

        grid = self._create_empty_grid(spec)
        placed_words = self._build_solution_chain(spec, grid)
        if not placed_words:
            return None

        self._fill_empty_cells(grid)
        final_grid = [[cell or "A" for cell in row] for row in grid]
        all_valid_words = find_all_words(final_grid, self.trie, self.minimum_length)

        if not self._board_is_interesting(placed_words, all_valid_words):
            return None

        return GeneratedBoard(
            board_id=f"{self.dictionary_provider.language}-{spec.rows}x{spec.cols}-{board_index + 1:03d}-{attempt + 1:02d}",
            language=self.dictionary_provider.language,
            rows=spec.rows,
            cols=spec.cols,
            grid=final_grid,
        )

    def _create_empty_grid(self, spec: BoardSpec) -> list[list[str | None]]:
        """Create an empty board grid for staged placement."""

        return [[None for _ in range(spec.cols)] for _ in range(spec.rows)]

    def _build_solution_chain(
        self,
        spec: BoardSpec,
        grid: list[list[str | None]],
    ) -> list[PlacedWord] | None:
        """Build a chained solution by first creating a route and then fitting words to it."""

        for _ in range(WORD_CHAIN_ATTEMPTS):
            segment_lengths = self._choose_segment_lengths(spec)
            if segment_lengths is None:
                continue

            route_length = self._segment_lengths_to_route_length(segment_lengths)
            route = self._build_route(spec, route_length)
            if route is None:
                continue

            words = self._choose_words_for_segments(segment_lengths)
            if words is None:
                continue

            placed_words = self._segment_route_into_words(route, words)
            self._apply_solution_words(grid, placed_words)
            return placed_words

        return None

    def _choose_segment_lengths(self, spec: BoardSpec) -> list[int] | None:
        """Choose word lengths that fit the board and create a meaningful route."""

        maximum_segment_count = min(self.maximum_words, 3 if spec.rows <= 5 else 4)
        for _ in range(40):
            segment_count = self.random.randint(1, maximum_segment_count)
            lengths = [
                self.random.randint(
                    self.minimum_length,
                    min(MAX_SEGMENT_LENGTH, spec.rows + 1, spec.cols + 1),
                )
                for _ in range(segment_count)
            ]
            route_length = self._segment_lengths_to_route_length(lengths)
            if route_length < spec.rows + 1:
                continue
            if route_length > spec.rows * spec.cols:
                continue
            return lengths
        return None

    def _segment_lengths_to_route_length(self, segment_lengths: list[int]) -> int:
        """Convert overlapping segment lengths into the total route length."""

        return sum(segment_lengths) - max(0, len(segment_lengths) - 1)

    def _build_route(self, spec: BoardSpec, route_length: int) -> list[Cell] | None:
        """Build a simple bottom-to-top path with the required number of cells."""

        neighbors = build_neighbors(spec.rows, spec.cols)
        for _ in range(ROUTE_ATTEMPTS):
            start = Cell(spec.rows - 1, self.random.randrange(spec.cols))
            route = self._search_route(
                current=start,
                neighbors=neighbors,
                visited={(start.row, start.col)},
                path=[start],
                target_length=route_length,
            )
            if route is not None:
                return route
        return None

    def _search_route(
        self,
        current: Cell,
        neighbors: dict[tuple[int, int], list[Cell]],
        visited: set[tuple[int, int]],
        path: list[Cell],
        target_length: int,
    ) -> list[Cell] | None:
        """Depth-first search for a simple route that reaches the top row on time."""

        if len(path) == target_length:
            return list(path) if current.row == 0 else None

        remaining_steps = target_length - len(path)
        candidates = list(neighbors[(current.row, current.col)])
        self.random.shuffle(candidates)
        candidates.sort(key=lambda cell: (cell.row, abs(cell.col - current.col)))

        for neighbor in candidates:
            key = (neighbor.row, neighbor.col)
            if key in visited:
                continue
            if neighbor.row > remaining_steps:
                continue

            visited.add(key)
            path.append(neighbor)
            route = self._search_route(neighbor, neighbors, visited, path, target_length)
            if route is not None:
                return route
            path.pop()
            visited.remove(key)

        return None

    def _choose_words_for_segments(self, segment_lengths: list[int]) -> list[str] | None:
        """Choose a chain of words whose overlaps match the planned route segments."""

        chain: list[str] = []
        used_words: set[str] = set()

        for segment_index, length in enumerate(segment_lengths):
            starts_with = chain[-1][-1] if segment_index > 0 else None
            word = self._pick_word(length, starts_with, used_words)
            if word is None:
                return None
            chain.append(word)
            used_words.add(word)

        return chain

    def _pick_word(
        self,
        length: int,
        starts_with: str | None,
        used_words: set[str],
    ) -> str | None:
        """Pick one word that matches the requested length and optional first letter."""

        if starts_with is None:
            candidates = self.dictionary_provider.words
        else:
            candidates = self.dictionary_provider.words_by_first_letter.get(starts_with, [])

        filtered = [word for word in candidates if len(word) == length and word not in used_words]
        if not filtered:
            return None

        shortlist = filtered[: min(500, len(filtered))]
        return self.random.choice(shortlist)

    def _segment_route_into_words(self, route: list[Cell], words: list[str]) -> list[PlacedWord]:
        """Map the chosen word chain onto overlapping route segments."""

        placed_words: list[PlacedWord] = []
        route_index = 0

        for segment_index, word in enumerate(words):
            segment_length = len(word)
            path = route[route_index: route_index + segment_length]
            placed_words.append(PlacedWord(word=word, path=path))
            route_index += segment_length - 1
            if segment_index == len(words) - 1:
                break

        return placed_words

    def _apply_solution_words(
        self,
        grid: list[list[str | None]],
        placed_words: list[PlacedWord],
    ) -> None:
        """Write all solution words into the grid."""

        for placed_word in placed_words:
            for letter, cell in zip(placed_word.word.upper(), placed_word.path, strict=True):
                grid[cell.row][cell.col] = letter

    def _fill_empty_cells(self, grid: list[list[str | None]]) -> None:
        """Fill remaining board cells with weighted random letters."""

        for row_index, row in enumerate(grid):
            for col_index, cell in enumerate(row):
                if cell is None:
                    grid[row_index][col_index] = self.random.choice(
                        self.dictionary_provider.letter_weights
                    )

    def _board_is_interesting(
        self,
        solution_words: list[PlacedWord],
        all_valid_words: list[str],
    ) -> bool:
        """Reject boards that are technically solvable but too sparse."""

        if not solution_words:
            return False

        solution_word_set = {placed_word.word for placed_word in solution_words}
        if not solution_word_set.issubset(set(all_valid_words)):
            return False

        if len(all_valid_words) < max(8, len(solution_words)):
            return False

        return True
