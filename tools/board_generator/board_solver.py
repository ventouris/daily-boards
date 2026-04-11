"""Board solver for enumerating all valid words on a generated board."""

from __future__ import annotations

from board_types import Cell
from trie import Trie


def build_neighbors(rows: int, cols: int) -> dict[tuple[int, int], list[Cell]]:
    """Precompute 8-direction neighbors for each cell in the board."""

    neighbors: dict[tuple[int, int], list[Cell]] = {}
    for row in range(rows):
        for col in range(cols):
            cell_neighbors: list[Cell] = []
            for row_offset in (-1, 0, 1):
                for col_offset in (-1, 0, 1):
                    if row_offset == 0 and col_offset == 0:
                        continue
                    next_row = row + row_offset
                    next_col = col + col_offset
                    if 0 <= next_row < rows and 0 <= next_col < cols:
                        cell_neighbors.append(Cell(next_row, next_col))
            neighbors[(row, col)] = cell_neighbors
    return neighbors


def find_all_words(
    grid: list[list[str]],
    trie: Trie,
    minimum_length: int,
) -> list[str]:
    """Enumerate all valid dictionary words that can be traced on the board."""

    rows = len(grid)
    cols = len(grid[0])
    neighbors = build_neighbors(rows, cols)
    found_words: set[str] = set()

    for row in range(rows):
        for col in range(cols):
            _walk_board(
                grid=grid,
                trie=trie,
                neighbors=neighbors,
                cell=Cell(row, col),
                visited={(row, col)},
                prefix="",
                found_words=found_words,
                minimum_length=minimum_length,
            )

    return sorted(found_words)


def _walk_board(
    grid: list[list[str]],
    trie: Trie,
    neighbors: dict[tuple[int, int], list[Cell]],
    cell: Cell,
    visited: set[tuple[int, int]],
    prefix: str,
    found_words: set[str],
    minimum_length: int,
) -> None:
    """Depth-first search the board using trie prefixes."""

    next_prefix = prefix + grid[cell.row][cell.col].lower()
    node = _follow_prefix(trie, next_prefix)
    if node is None:
        return

    if node.is_word and len(next_prefix) >= minimum_length:
        found_words.add(next_prefix)

    for neighbor in neighbors[(cell.row, cell.col)]:
        neighbor_key = (neighbor.row, neighbor.col)
        if neighbor_key in visited:
            continue
        visited.add(neighbor_key)
        _walk_board(
            grid=grid,
            trie=trie,
            neighbors=neighbors,
            cell=neighbor,
            visited=visited,
            prefix=next_prefix,
            found_words=found_words,
            minimum_length=minimum_length,
        )
        visited.remove(neighbor_key)


def _follow_prefix(trie: Trie, prefix: str):
    """Traverse the trie for the provided prefix."""

    node = trie.root
    for letter in prefix:
        node = node.children.get(letter)
        if node is None:
            return None
    return node
