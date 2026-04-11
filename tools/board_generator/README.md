# Board Generator

Standalone Python tool for generating solvable daily Blitz boards.

## Features

- Generate one or many boards in a single run
- Support configurable board sizes with no hard upper limit
- Guarantee each board has at least one valid chained route from bottom to top
- Export compact board data for direct frontend consumption
- Reuse an exported local dictionary snapshot instead of loading a corpus package at runtime
- Cap large dictionaries to a deterministic representative subset when needed
- Run locally with Python or inside Docker

## Docker Usage

```bash
docker build --target dictionary-export -t blitz-dictionary-export .
docker run --rm -v ${PWD}/../../src/data/dictionaries:/frontend-data/dictionaries blitz-dictionary-export --language en --output /frontend-data/dictionaries/en.txt --skip-if-exists

docker build --target board-generator -t blitz-board-generator .
docker run --rm -v ${PWD}/../../src/data:/frontend-data blitz-board-generator --count 10 --sizes 5x5 --language en --dictionary-file /frontend-data/dictionaries/en.txt --output /frontend-data/boards/boards_en.txt
```

To export a smaller dictionary for a language with a very large Hunspell list, pass a cap such as:

```bash
docker run --rm -v ${PWD}/../../src/data/dictionaries:/frontend-data/dictionaries blitz-dictionary-export --language el --minimum-length 3 --maximum-words 100000 --selection-strategy representative --output /frontend-data/dictionaries/el.txt
```

## Docker Compose

From the generator directory, with no host Python install:

```bash
docker compose up --build
```

This will:

- create `src/data/dictionaries/<language>.txt` if it does not already exist
- generate `src/data/boards/boards_<language>.txt` on the host
- export dictionaries from Hunspell inside Docker instead of requiring host installs
- use English defaults for the current frontend dataset

To generate another language, rerun the container with a different `--language` and matching output file such as `src/data/boards/boards_el.txt`.

Built-in Hunspell mappings currently cover:

- `en` -> `/usr/share/hunspell/en_US.{aff,dic}`
- `el` -> `/usr/share/hunspell/el_GR.{aff,dic}`

For another language, pass custom `--hunspell-dic` and `--hunspell-aff` files to the export command or extend the built-in mapping.
