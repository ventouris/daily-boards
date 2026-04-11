/**
 * Creates a rectangular matrix filled with the provided value.
 *
 * @param {number} rows - The number of matrix rows.
 * @param {number} cols - The number of matrix columns.
 * @param {boolean} [fillValue=false] - The initial value for each cell.
 * @returns {boolean[][]} The created matrix.
 */
export function createMatrix(rows, cols, fillValue = false) {
  return Array.from({ length: rows }, () => Array.from({ length: cols }, () => fillValue));
}

/**
 * Clones a path so callers can mutate it safely.
 *
 * @param {Array<{row: number, col: number}>} path - The path to clone.
 * @returns {Array<{row: number, col: number}>} The cloned path.
 */
export function clonePath(path) {
  return path.map((cell) => ({ ...cell }));
}

/**
 * Serializes a cell coordinate for use as a stable key.
 *
 * @param {{row: number, col: number}} cell - The cell to serialize.
 * @returns {string} The serialized cell key.
 */
export function serializeCell(cell) {
  return `${cell.row}:${cell.col}`;
}

/**
 * Checks whether two cells are adjacent in 8 directions.
 *
 * @param {{row: number, col: number}} a - The first cell.
 * @param {{row: number, col: number}} b - The second cell.
 * @returns {boolean} True when the cells are adjacent.
 */
export function areAdjacent(a, b) {
  return Math.max(Math.abs(a.row - b.row), Math.abs(a.col - b.col)) === 1;
}

/**
 * Checks whether the provided row is the last row in the grid.
 *
 * @param {Array<Array<string>>} grid - The puzzle grid.
 * @param {number} row - The row index to inspect.
 * @returns {boolean} True when the row is the bottom row.
 */
export function isBottomRow(grid, row) {
  return row === grid.length - 1;
}

/**
 * Checks whether the provided cell is already activated.
 *
 * @param {boolean[][]} activated - The activated tile matrix.
 * @param {{row: number, col: number}} cell - The cell to inspect.
 * @returns {boolean} True when the cell is activated.
 */
export function cellIsActivated(activated, cell) {
  return Boolean(activated[cell.row]?.[cell.col]);
}

/**
 * Checks whether a cell can start the next trace.
 *
 * @param {object} params - Start validation inputs.
 * @param {Array<Array<string>>} params.grid - The puzzle grid.
 * @param {boolean[][]} params.activated - The activated tile matrix.
 * @param {Array<{word: string}>} params.submittedWords - The submitted words list.
 * @param {{row: number, col: number}} cell - The candidate start cell.
 * @returns {boolean} True when the cell is a valid trace start.
 */
export function canStartPath({ grid, activated, submittedWords }, cell) {
  if (submittedWords.length === 0) {
    return isBottomRow(grid, cell.row);
  }

  return cellIsActivated(activated, cell);
}

/**
 * Builds the string represented by a traced path.
 *
 * @param {Array<Array<string>>} grid - The puzzle grid.
 * @param {Array<{row: number, col: number}>} path - The traced path.
 * @returns {string} The word formed by the path.
 */
export function buildWord(grid, path) {
  return path.map((cell) => grid[cell.row][cell.col]).join("");
}

/**
 * Removes combining accents and normalizes casing for dictionary comparisons.
 *
 * @param {string} value - The raw word candidate.
 * @returns {string} The normalized word.
 */
export function normalizeWord(value) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase();
}

/**
 * Counts the number of activated tiles in the matrix.
 *
 * @param {boolean[][]} activated - The activated tile matrix.
 * @returns {number} The number of activated tiles.
 */
export function countActivated(activated) {
  return activated.reduce((total, row) => total + row.filter(Boolean).length, 0);
}

/**
 * Checks whether any activated tile reaches the top row.
 *
 * @param {boolean[][]} activated - The activated tile matrix.
 * @returns {boolean} True when the top row contains an activated tile.
 */
export function hasReachedTop(activated) {
  return activated[0].some(Boolean);
}

/**
 * Creates a standard evaluation result object.
 *
 * @param {boolean} isValid - Whether the evaluation passed.
 * @param {string} reason - The user-facing evaluation message.
 * @param {string} word - The lowercase word being evaluated.
 * @returns {{isValid: boolean, reason: string, word: string}} The evaluation result.
 */
function createEvaluationResult(isValid, reason, word) {
  return { isValid, reason, word };
}

/**
 * Validates that the path is not empty.
 *
 * @param {Array<{row: number, col: number}>} currentPath - The active path.
 * @returns {{isValid: boolean, reason: string, word: string} | null} The failure result, or null when valid.
 */
function validatePathPresence(currentPath) {
  if (currentPath.length === 0) {
    return createEvaluationResult(false, "Trace a word to submit.", "");
  }

  return null;
}

/**
 * Validates the minimum allowed path length.
 *
 * @param {Array<{row: number, col: number}>} currentPath - The active path.
 * @param {number} minimumWordLength - The minimum allowed word length.
 * @param {string} word - The lowercase word being evaluated.
 * @returns {{isValid: boolean, reason: string, word: string} | null} The failure result, or null when valid.
 */
function validateMinimumLength(currentPath, minimumWordLength, word) {
  if (currentPath.length < minimumWordLength) {
    return createEvaluationResult(false, `Too short. Use at least ${minimumWordLength} letters.`, word);
  }

  return null;
}

/**
 * Validates that the word has not already been submitted.
 *
 * @param {Array<{word: string}>} submittedWords - The submitted words list.
 * @param {string} word - The lowercase word being evaluated.
 * @returns {{isValid: boolean, reason: string, word: string} | null} The failure result, or null when valid.
 */
function validateDuplicateWord(submittedWords, word) {
  if (submittedWords.some((entry) => entry.word === word)) {
    return createEvaluationResult(false, "Already used.", word);
  }

  return null;
}

/**
 * Validates that the word exists in the current dictionary.
 *
 * @param {Set<string>} dictionary - The active dictionary set.
 * @param {string} word - The lowercase word being evaluated.
 * @returns {{isValid: boolean, reason: string, word: string} | null} The failure result, or null when valid.
 */
function validateDictionaryWord(dictionary, word) {
  if (!dictionary.has(word)) {
    return createEvaluationResult(false, "Not in dictionary.", word);
  }

  return null;
}

/**
 * Validates that the path starts from an allowed tile.
 *
 * @param {object} params - Start validation inputs.
 * @param {Array<Array<string>>} params.grid - The puzzle grid.
 * @param {boolean[][]} params.activated - The activated tile matrix.
 * @param {Array<{word: string}>} params.submittedWords - The submitted words list.
 * @param {Array<{row: number, col: number}>} params.currentPath - The active path.
 * @param {string} word - The lowercase word being evaluated.
 * @returns {{isValid: boolean, reason: string, word: string} | null} The failure result, or null when valid.
 */
function validatePathStart({ grid, activated, submittedWords, currentPath }, word) {
  if (!canStartPath({ grid, activated, submittedWords }, currentPath[0])) {
    const reason = submittedWords.length === 0
      ? "First word must start on the bottom row."
      : "Next word must start on an activated tile.";
    return createEvaluationResult(false, reason, word);
  }

  return null;
}

/**
 * Validates the current path against all gameplay rules.
 *
 * @param {object} params - Path validation inputs.
 * @param {Array<Array<string>>} params.grid - The puzzle grid.
 * @param {boolean[][]} params.activated - The activated tile matrix.
 * @param {Array<{row: number, col: number}>} params.currentPath - The active path.
 * @param {Array<{word: string}>} params.submittedWords - The submitted words list.
 * @param {Set<string>} params.dictionary - The active dictionary set.
 * @param {number} params.minimumWordLength - The minimum allowed word length.
 * @returns {{isValid: boolean, reason: string, word: string}} The validation result.
 */
export function evaluatePath({ grid, activated, currentPath, submittedWords, dictionary, minimumWordLength }) {
  const presenceError = validatePathPresence(currentPath);
  if (presenceError) {
    return presenceError;
  }

  const word = normalizeWord(buildWord(grid, currentPath));
  const minimumLengthError = validateMinimumLength(currentPath, minimumWordLength, word);
  if (minimumLengthError) {
    return minimumLengthError;
  }

  const duplicateError = validateDuplicateWord(submittedWords, word);
  if (duplicateError) {
    return duplicateError;
  }

  const dictionaryError = validateDictionaryWord(dictionary, word);
  if (dictionaryError) {
    return dictionaryError;
  }

  const startError = validatePathStart({ grid, activated, submittedWords, currentPath }, word);
  if (startError) {
    return startError;
  }

  return createEvaluationResult(true, "Valid word.", word);
}

/**
 * Extends the current path, or truncates it when re-selecting an existing tile.
 *
 * @param {object} params - Path extension inputs.
 * @param {Array<{row: number, col: number}>} params.currentPath - The active path.
 * @param {{row: number, col: number}} params.nextCell - The next selected cell.
 * @returns {Array<{row: number, col: number}>} The next path.
 */
export function extendPath({ currentPath, nextCell }) {
  if (currentPath.length === 0) {
    return [nextCell];
  }

  const existingIndex = currentPath.findIndex((cell) => cell.row === nextCell.row && cell.col === nextCell.col);
  if (existingIndex !== -1) {
    return currentPath.slice(0, existingIndex);
  }

  const lastCell = currentPath[currentPath.length - 1];
  if (!areAdjacent(lastCell, nextCell)) {
    return currentPath;
  }

  return [...currentPath, nextCell];
}

/**
 * Applies a submitted word to the activated state and history.
 *
 * @param {object} params - Commit inputs.
 * @param {boolean[][]} params.activated - The activated tile matrix.
 * @param {Array<{row: number, col: number}>} params.currentPath - The submitted path.
 * @param {Array<{word: string, path: Array<{row: number, col: number}>}>} params.submittedWords - The submitted words list.
 * @param {string} params.word - The lowercase submitted word.
 * @returns {{activated: boolean[][], submittedWords: Array<{word: string, path: Array<{row: number, col: number}>}>, scoreUniqueActivated: number, completed: boolean}} The committed result.
 */
export function commitWord({ activated, currentPath, submittedWords, word }) {
  const nextActivated = activated.map((row) => [...row]);
  currentPath.forEach((cell) => {
    nextActivated[cell.row][cell.col] = true;
  });

  return {
    activated: nextActivated,
    submittedWords: [...submittedWords, { word, path: clonePath(currentPath) }],
    scoreUniqueActivated: countActivated(nextActivated),
    completed: hasReachedTop(nextActivated),
  };
}

/**
 * Formats a duration as `MM:SS`.
 *
 * @param {number} milliseconds - The duration to format.
 * @returns {string} The formatted duration.
 */
export function formatDuration(milliseconds) {
  const safeMilliseconds = Math.max(0, milliseconds);
  const totalSeconds = Math.floor(safeMilliseconds / 1000);
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

/**
 * Builds the spoiler-free emoji share text for a run.
 *
 * @param {object} params - Share text inputs.
 * @param {number} params.boardNumber - The daily puzzle number.
 * @param {number} params.characterTotal - The number of unique activated tiles.
 * @param {number} params.totalCells - The total number of tiles on the board.
 * @param {number} params.wordsUsed - The number of submitted words.
 * @param {number} params.elapsed - The elapsed run time in milliseconds.
 * @param {boolean[][]} params.activated - The activated tile matrix.
 * @returns {string} The shareable result text.
 */
export function buildShareText({ boardNumber, characterTotal, totalCells, wordsUsed, elapsed, activated }) {
  const rows = activated.map((row) => row.map((cell) => (cell ? "\uD83D\uDFE9" : "\u2B1C")).join("")).join("\n");
  const wordLabel = wordsUsed === 1 ? "1 word" : `${wordsUsed} words`;
  const tileLabel = totalCells ? `${characterTotal}/${totalCells} tiles` : `${characterTotal} tiles`;
  return `Gridly Blitz #${boardNumber}\n${formatDuration(elapsed)} | ${wordLabel} | ${tileLabel}\n${rows}`;
}

/**
 * Creates a case-insensitive dictionary set from a list of words.
 *
 * @param {string[]} words - The words to normalize.
 * @returns {Set<string>} The normalized dictionary set.
 */
export function createDictionary(words) {
  const dictionary = new Set();

  words.forEach((word) => {
    const normalizedWord = normalizeWord(word);
    if (normalizedWord && /^[\p{L}]+$/u.test(normalizedWord)) {
      dictionary.add(normalizedWord);
    }
  });

  return dictionary;
}

