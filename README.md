# Gridly Blitz

A daily word-path puzzle. Trace words across a letter grid, chaining them together from the bottom row up to the top. One new board every day, the same for everyone.

## How to play

1. **Start from the bottom row** — tap any letter on the bottom row to begin your first word.
2. **Trace a path** — slide through adjacent letters (including diagonals) to spell a word. You cannot reuse a letter within the same word.
3. **Submit** — tap Submit when you have a valid word (minimum 3 letters, must be in the dictionary).
4. **Chain your words** — every word after the first must start from a tile you have already activated.
5. **Reach the top** — keep chaining words until an activated tile reaches the top row.
6. **Limited moves** — you have up to 6 words to complete the board. Use them wisely.

After completing or running out of moves, share your result as a spoiler-free emoji grid.

## Features

- Daily puzzle — one board per day, same for all players worldwide (based on UTC date)
- Multi-language support — each language gets its own board and dictionary
- Progress saved locally — resume your run even after closing the tab
- Streak tracking — current and best streaks stored in the browser
- Dark and light theme
- Shareable emoji result grid

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React 19, Vite 7 |
| Board generation | Python 3.12 |
| Hosting | GitHub Pages |
| CI / CD | GitHub Actions |

## Project structure

```
├── src/
│   ├── components/        # React UI components
│   ├── data/
│   │   ├── boards/        # Pre-generated board files, organised by language and year
│   │   │   └── en/
│   │   │       └── 2026/
│   │   │           └── boards.txt   # 365 or 366 boards, one per line
│   │   └── dictionaries/  # Word lists used by the frontend
│   │       └── en.txt
│   ├── data-client.js     # Board and dictionary loading logic
│   ├── game-engine.js     # Pure game logic (path validation, scoring, share text)
│   └── App.jsx            # Main application and state management
│
└── tools/
    └── board_generator/   # Python CLI tools
        ├── generate_boards.py     # Generate boards for one or more years
        ├── export_dictionary.py   # Export a word list from Hunspell or an existing file
        ├── board_generator.py     # Core board construction algorithm
        ├── board_solver.py        # Validates that boards have a solution
        ├── dictionary_provider.py # Loads and indexes word lists
        └── trie.py                # Prefix trie used during generation
```

## Running locally

```bash
npm install
npm run dev
```

The dev server starts at `http://localhost:5173`. Board files must already exist under `src/data/boards/` (see below).

## Generating boards

Board files live at `src/data/boards/{language}/{year}/boards.txt`. Each file contains one board per line for every day of that year (365 or 366 lines).

**Step 1 — prepare the dictionary for the generator**

From `tools/board_generator/`:

```bash
python export_dictionary.py \
  --language en \
  --source-file ../../src/data/dictionaries/en.txt \
  --output dictionaries/en.txt
```

**Step 2 — generate boards**

```bash
python generate_boards.py \
  --years 2026,2027 \
  --sizes 4x4,5x5 \
  --language en \
  --dictionary-file ../../src/data/dictionaries/en.txt \
  --output-dir ../../src/data/boards
```

| Flag | Description |
|---|---|
| `--years` | Comma-separated years to generate, e.g. `2026,2027` |
| `--sizes` | Comma-separated board dimensions, e.g. `4x4,5x5,6x6`. The generator picks randomly among them. |
| `--language` | Language code. Must match a dictionary file. |
| `--dictionary-file` | Path to the word list. |
| `--output-dir` | Root output directory. Files are written to `{dir}/{language}/{year}/boards.txt`. |
| `--seed` | Optional integer seed for reproducible output. |

## Adding a new language

1. **Add a dictionary** — place a plain-text word list (one word per line) at `src/data/dictionaries/{lang}.txt`. The easiest source is a Hunspell dictionary via `export_dictionary.py --language {lang}` (requires the relevant `hunspell-{lang}` package or custom `--hunspell-dic`/`--hunspell-aff` files).

2. **Generate boards** — run `generate_boards.py` with `--language {lang}`.

3. **Set the default language** (optional) — add a `VITE_DEFAULT_LANGUAGE={lang}` environment variable to your build.

The game detects supported languages automatically at build time from the files present in `src/data/boards/` and `src/data/dictionaries/`.

## Deployment (GitHub Pages)

### First-time setup

1. Push the repository to GitHub.
2. Go to **Settings → Pages → Source** and select **GitHub Actions**.
3. The `deploy` workflow runs automatically on every push to `main`.

Your site will be live at `https://{username}.github.io/{repo-name}/`.

**Custom domain** — if you configure a custom domain in Pages settings, override the Vite base path by adding a repository variable `VITE_BASE` = `/`.

### Generating boards via GitHub Actions

Go to **Actions → Generate Boards → Run workflow** and fill in:

| Input | Example | Description |
|---|---|---|
| `years` | `2026,2027` | Years to generate boards for |
| `sizes` | `4x4,5x5` | Board dimensions |
| `language` | `en` | Language code |

The workflow commits the generated files back to the repository and the deploy workflow picks them up automatically.

A scheduled run fires every **November 1st** to pre-generate boards for the following year with the default settings (`en`, `4x4,5x5`).

## Docker (local board generation without a Python install)

```bash
cd tools/board_generator

# Export dictionary
docker build --target dictionary-export -t blitz-dict-export .
docker run --rm \
  -v ${PWD}/../../src/data/dictionaries:/out \
  blitz-dict-export \
  --language en --source-file /out/en.txt --output /out/en.txt

# Generate boards
docker build --target board-generator -t blitz-board-generator .
docker run --rm \
  -v ${PWD}/../../src/data:/data \
  blitz-board-generator \
  --years 2026 --sizes 4x4,5x5 --language en \
  --dictionary-file /data/dictionaries/en.txt \
  --output-dir /data/boards
```

---

Built with the help of [Claude Code](https://claude.ai/code) by Anthropic.
