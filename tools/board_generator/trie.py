"""Trie data structure for fast board solving."""

from __future__ import annotations


class TrieNode:
    """Represents one node in the trie."""

    def __init__(self) -> None:
        """Initialize an empty trie node."""

        self.children: dict[str, TrieNode] = {}
        self.is_word = False


class Trie:
    """Stores dictionary words for prefix lookup."""

    def __init__(self, words: list[str]) -> None:
        """Build a trie from the provided words."""

        self.root = TrieNode()
        for word in words:
            self.insert(word)

    def insert(self, word: str) -> None:
        """Insert a word into the trie."""

        node = self.root
        for letter in word:
            node = node.children.setdefault(letter, TrieNode())
        node.is_word = True
