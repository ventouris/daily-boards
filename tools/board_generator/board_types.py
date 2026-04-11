"""Shared data models for the board generator."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True, slots=True)
class Cell:
    """Represents a single board coordinate."""

    row: int
    col: int


@dataclass(slots=True)
class PlacedWord:
    """Represents a word and the path used to place it on the board."""

    word: str
    path: list[Cell]


@dataclass(frozen=True, slots=True)
class BoardSpec:
    """Configuration for a board size."""

    rows: int
    cols: int


@dataclass(slots=True)
class GeneratedBoard:
    """Final exported board payload."""

    board_id: str
    language: str
    rows: int
    cols: int
    grid: list[list[str]]
