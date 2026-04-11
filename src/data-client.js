/**
 * Normalizes a single board letter value.
 *
 * @param {unknown} cell - The raw cell value.
 * @returns {string} The normalized uppercase letter.
 */
function normalizeLetter(cell) {
  if (typeof cell !== "string" || cell.trim().length !== 1) {
    throw new Error("Daily board letters are invalid.");
  }

  return cell.trim().toUpperCase();
}

/**
 * Normalizes a single grid row.
 *
 * @param {unknown} row - The raw row value.
 * @returns {string[]} The normalized row.
 */
function normalizeGridRow(row) {
  if (typeof row === "string" && row.length > 0) {
    return Array.from(row).map(normalizeLetter);
  }

  if (!Array.isArray(row) || row.length === 0) {
    throw new Error("Daily board grid rows are invalid.");
  }

  return row.map(normalizeLetter);
}

/**
 * Normalizes and validates the grid payload.
 *
 * @param {unknown} grid - The raw grid payload.
 * @returns {string[][]} The normalized rectangular grid.
 */
function normalizeGrid(grid) {
  if (!Array.isArray(grid) || grid.length === 0) {
    throw new Error("Daily board grid is missing.");
  }

  const normalized = grid.map(normalizeGridRow);
  const width = normalized[0].length;

  if (normalized.some((row) => row.length !== width)) {
    throw new Error("Daily board grid must be rectangular.");
  }

  return normalized;
}

/**
 * Normalizes a positive integer setting from the payload.
 *
 * @param {unknown} value - The raw setting value.
 * @param {number} fallback - The fallback value to use when invalid.
 * @param {number} minimum - The smallest allowed value.
 * @returns {number} The normalized setting value.
 */
function normalizePositiveInteger(value, fallback, minimum) {
  if (Number.isInteger(value) && value >= minimum) {
    return value;
  }

  return fallback;
}

/**
 * Normalizes a language code into a URL-safe lowercase value.
 *
 * @param {unknown} value - The raw language code candidate.
 * @returns {string} The normalized language code, or an empty string.
 */
export function normalizeLanguageCode(value) {
  if (typeof value !== "string") {
    return "";
  }

  const normalized = value.trim().toLowerCase();
  return /^[a-z]{2,}(?:-[a-z0-9]+)*$/.test(normalized) ? normalized : "";
}

const REQUESTED_DEFAULT_LANGUAGE = normalizeLanguageCode(import.meta.env.VITE_DEFAULT_LANGUAGE) || "en";

// Normalize the Vite base URL to an absolute path prefix that always ends with "/".
// Relative bases (e.g. "./") are treated as root for the history API.
function getBasePath() {
  const base = import.meta.env.BASE_URL || "/";
  if (!base.startsWith("/")) return "/";
  return base.endsWith("/") ? base : base + "/";
}

const BASE_PATH = getBasePath();
const DEFAULT_MINIMUM_WORD_LENGTH = 3;
const DEFAULT_MAXIMUM_WORDS = 6;
const DAILY_SCHEDULE_EPOCH_UTC_MS = Date.UTC(2026, 0, 1);
const MS_PER_DAY = 86400000;
const BOARD_ID_SIZE_PATTERN = /-(\d+)x(\d+)-\d+-\d+$/u;
const boardCatalogLoaders = import.meta.glob("./data/boards/*/*/boards.txt", {
  query: "?raw",
  import: "default",
});
const dictionaryLoaders = import.meta.glob("./data/dictionaries/*.txt", {
  query: "?raw",
  import: "default",
});
const availableBoardLanguages = getAvailableBoardLanguages(boardCatalogLoaders);
const availableDictionaryLanguages = getAvailableLanguages(dictionaryLoaders);
export const supportedLanguages = availableBoardLanguages.filter((language) =>
  availableDictionaryLanguages.includes(language),
);
const DEFAULT_LANGUAGE = supportedLanguages.includes(REQUESTED_DEFAULT_LANGUAGE)
  ? REQUESTED_DEFAULT_LANGUAGE
  : (supportedLanguages[0] || REQUESTED_DEFAULT_LANGUAGE);

/**
 * Strips the Vite base path prefix from a pathname, returning the app-relative portion.
 *
 * e.g. with BASE_PATH "/Daily-Boards/", "/Daily-Boards/en" → "/en"
 *
 * @param {string} pathname - The full browser pathname.
 * @returns {string} The pathname with the base prefix removed.
 */
function stripBasePath(pathname) {
  const prefix = BASE_PATH === "/" ? "" : BASE_PATH.slice(0, -1); // e.g. "/Daily-Boards"
  if (prefix && pathname.startsWith(prefix)) {
    return pathname.slice(prefix.length) || "/";
  }
  return pathname;
}

/**
 * Builds an absolute URL path for a given language, including the Vite base prefix.
 *
 * e.g. with BASE_PATH "/Daily-Boards/", buildLanguagePath("en") → "/Daily-Boards/en"
 *
 * @param {string} language - The normalized language code.
 * @returns {string} The full path to use with the history API.
 */
export function buildLanguagePath(language) {
  return `${BASE_PATH}${language}`;
}

/**
 * Returns the active language code from the first pathname segment.
 *
 * @param {string} pathname - The browser pathname to inspect.
 * @returns {string} The requested language or the default language.
 */
export function getLanguageFromPathname(pathname = window.location.pathname) {
  const [firstSegment = ""] = stripBasePath(pathname).split("/").filter(Boolean);
  return getSupportedLanguage(firstSegment);
}

/**
 * Ensures the current location includes a normalized leading language segment.
 *
 * @returns {string} The active language after normalization.
 */
export function ensureLanguagePath() {
  const normalizedLanguage = getLanguageFromPathname();
  const [firstSegment = ""] = stripBasePath(window.location.pathname).split("/").filter(Boolean);

  if (getSupportedLanguage(firstSegment) !== firstSegment || !firstSegment) {
    window.history.replaceState(
      null,
      "",
      `${buildLanguagePath(normalizedLanguage)}${window.location.search}${window.location.hash}`,
    );
  }

  return normalizedLanguage;
}

/**
 * Returns a supported language code, falling back to the shipped default.
 *
 * @param {unknown} value - The requested language candidate.
 * @returns {string} The supported language code.
 */
function getSupportedLanguage(value) {
  const normalizedLanguage = normalizeLanguageCode(value);
  if (normalizedLanguage && supportedLanguages.includes(normalizedLanguage)) {
    return normalizedLanguage;
  }

  return DEFAULT_LANGUAGE;
}

/**
 * Returns the available language codes from a dictionary loader map.
 *
 * @param {Record<string, Function>} loaders - The lazy import map keyed by file path.
 * @returns {string[]} The sorted language codes.
 */
function getAvailableLanguages(loaders) {
  return Object.keys(loaders)
    .map((path) => path.split("/").pop()?.replace(/\.(json|txt)$/u, "") || "")
    .filter(Boolean)
    .sort();
}

/**
 * Returns the available language codes from the year-partitioned board loader map.
 *
 * Expects paths of the form ./data/boards/{language}/{year}/boards.txt.
 *
 * @param {Record<string, Function>} loaders - The lazy import map.
 * @returns {string[]} The sorted language codes.
 */
function getAvailableBoardLanguages(loaders) {
  const languages = new Set();
  for (const path of Object.keys(loaders)) {
    // path: ./data/boards/en/2026/boards.txt  →  parts[3] is the language
    const parts = path.split("/");
    if (parts.length >= 5) {
      languages.add(parts[3]);
    }
  }
  return [...languages].sort();
}

/**
 * Resolves a lazy file loader for a language-specific dictionary file.
 *
 * @param {Record<string, Function>} loaders - The lazy import map.
 * @param {string} fileName - The expected file name.
 * @param {string} entityName - The user-facing entity label.
 * @returns {Function} The matching lazy loader.
 */
function resolveLanguageLoader(loaders, fileName, entityName) {
  const loaderEntry = Object.entries(loaders).find(([path]) => path.endsWith(`/${fileName}`));
  if (loaderEntry) {
    return loaderEntry[1];
  }

  const availableLanguages = getAvailableLanguages(loaders).join(", ") || "none";
  throw new Error(`No ${entityName} found for '${fileName}'. Available languages: ${availableLanguages}.`);
}

/**
 * Resolves a lazy file loader for the board catalog of a given language and year.
 *
 * Falls back to the most recent available year if the requested year is not found.
 *
 * @param {Record<string, Function>} loaders - The lazy import map.
 * @param {string} language - The normalized language code.
 * @param {number} year - The requested year.
 * @returns {Function} The matching lazy loader.
 */
function resolveBoardLoader(loaders, language, year) {
  const targetPath = `./data/boards/${language}/${year}/boards.txt`;
  if (targetPath in loaders) {
    return loaders[targetPath];
  }

  // Fall back to the most recent available year for this language.
  const availableYears = Object.keys(loaders)
    .filter((path) => path.startsWith(`./data/boards/${language}/`))
    .map((path) => parseInt(path.split("/")[4], 10))
    .filter((y) => !isNaN(y))
    .sort((a, b) => b - a);

  if (availableYears.length === 0) {
    throw new Error(`No board catalog found for language '${language}'.`);
  }

  const fallbackYear = availableYears[0];
  console.warn(`No boards for ${language}/${year}, falling back to ${fallbackYear}.`);
  return loaders[`./data/boards/${language}/${fallbackYear}/boards.txt`];
}

/**
 * Parses board size information from one board id.
 *
 * @param {string} boardId - The board identifier.
 * @returns {{rows: number, cols: number}} The parsed size.
 */
function parseBoardSizeFromId(boardId) {
  const match = boardId.match(BOARD_ID_SIZE_PATTERN);
  if (!match) {
    throw new Error(`Board id '${boardId}' does not include a valid size.`);
  }

  const rows = Number(match[1]);
  const cols = Number(match[2]);
  if (!Number.isInteger(rows) || !Number.isInteger(cols) || rows < 1 || cols < 1) {
    throw new Error(`Board id '${boardId}' includes an invalid size.`);
  }

  return { rows, cols };
}

/**
 * Validates and normalizes one board line from the compact text catalog.
 *
 * @param {string} line - The raw board line.
 * @param {string} language - The active language code.
 * @returns {object} The normalized board entry.
 */
function parseBoardLine(line, language) {
  const [boardId = "", flattenedGrid = ""] = line.split("\t");
  if (!boardId || !flattenedGrid) {
    throw new Error("Board entry is invalid.");
  }

  const { rows, cols } = parseBoardSizeFromId(boardId);
  const letters = Array.from(flattenedGrid);
  if (letters.length !== rows * cols) {
    throw new Error(`Board '${boardId}' has ${letters.length} letters but expected ${rows * cols}.`);
  }

  const rawGrid = Array.from({ length: rows }, (_, rowIndex) =>
    letters.slice(rowIndex * cols, (rowIndex + 1) * cols),
  );
  const grid = normalizeGrid(rawGrid);

  return {
    boardId,
    language,
    rows,
    cols,
    grid,
  };
}

/**
 * Validates and normalizes a board catalog payload.
 *
 * @param {unknown} payload - The raw catalog payload.
 * @param {string} language - The active language code.
 * @returns {object} The normalized catalog.
 */
function validateBoardCatalogPayload(payload, language) {
  if (typeof payload !== "string") {
    throw new Error("Board catalog payload is invalid.");
  }

  const boardLines = payload
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean);
  if (boardLines.length === 0) {
    throw new Error("Board catalog is missing boards.");
  }

  const boards = boardLines.map((line) => parseBoardLine(line, language));
  if (boards.some((board) => !board.boardId)) {
    throw new Error("Board catalog contains a board without an id.");
  }

  return {
    language,
    minimumWordLength: DEFAULT_MINIMUM_WORD_LENGTH,
    maximumWords: DEFAULT_MAXIMUM_WORDS,
    boards,
  };
}

/**
 * Validates and normalizes an exported dictionary payload.
 *
 * @param {unknown} payload - The raw dictionary payload.
 * @returns {{words: string[]}} The normalized dictionary payload.
 */
function validateDictionaryPayload(payload) {
  if (typeof payload === "string") {
    return {
      words: payload.split(/\r?\n/u).map((word) => word.trim()).filter(Boolean),
    };
  }

  if (Array.isArray(payload)) {
    return {
      words: payload.filter((word) => typeof word === "string"),
    };
  }

  if (payload && typeof payload === "object" && Array.isArray(payload.words)) {
    return {
      words: payload.words.filter((word) => typeof word === "string"),
    };
  }

  throw new Error("Dictionary payload is invalid.");
}

/**
 * Formats the browser-local date as an ISO date string.
 *
 * @returns {string} The local ISO date.
 */
function getTodayIsoDate() {
  const today = new Date();
  const year = today.getUTCFullYear();
  const month = String(today.getUTCMonth() + 1).padStart(2, "0");
  const day = String(today.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Returns the UTC midnight timestamp for today.
 *
 * @returns {number} The UTC midnight timestamp in milliseconds.
 */
function getUtcMidnightTimestamp() {
  const today = new Date();
  return Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
}

/**
 * Returns the number of UTC days since the fixed daily schedule epoch.
 *
 * @returns {number} The non-negative UTC day offset.
 */
function getScheduleDayOffset() {
  return Math.max(0, Math.floor((getUtcMidnightTimestamp() - DAILY_SCHEDULE_EPOCH_UTC_MS) / MS_PER_DAY));
}

/**
 * Returns the current UTC year.
 *
 * @returns {number} The UTC full year.
 */
function getUtcYear() {
  return new Date().getUTCFullYear();
}

/**
 * Returns the 0-indexed day of the current UTC year (0 = Jan 1, 364/365 = Dec 31).
 *
 * @returns {number} The zero-based day-of-year index.
 */
function getUtcDayOfYear() {
  const now = new Date();
  const yearStart = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  return Math.floor((today - yearStart) / MS_PER_DAY);
}

/**
 * Loads and normalizes the board catalog for one language and year.
 *
 * @param {string} language - The requested language code.
 * @param {number} year - The UTC year to load boards for.
 * @returns {Promise<object>} The normalized board catalog.
 */
async function loadBoardCatalog(language, year) {
  const normalizedLanguage = getSupportedLanguage(language);
  const loader = resolveBoardLoader(boardCatalogLoaders, normalizedLanguage, year);
  const module = await loader();
  return validateBoardCatalogPayload(module.default ?? module, normalizedLanguage);
}

/**
 * Loads and normalizes the dictionary for one language.
 *
 * @param {string} language - The requested language code.
 * @returns {Promise<{words: string[]}>} The normalized dictionary payload.
 */
async function loadDictionary(language) {
  const normalizedLanguage = getSupportedLanguage(language);
  const loader = resolveLanguageLoader(
    dictionaryLoaders,
    `${normalizedLanguage}.txt`,
    "dictionary",
  );
  const module = await loader();
  return validateDictionaryPayload(module.default ?? module);
}

/**
 * Returns the selected daily board from the local board catalog.
 *
 * The board is selected by the 0-indexed day of the current UTC year, so every user
 * sees the same board on the same calendar day regardless of their local time zone.
 *
 * @param {string} language - The requested language code.
 * @returns {Promise<object>} The normalized daily board object.
 */
export async function getDailyBoard(language) {
  const year = getUtcYear();
  const catalog = await loadBoardCatalog(language, year);
  const dayOfYear = getUtcDayOfYear();
  const boardIndex = Math.min(dayOfYear, catalog.boards.length - 1);
  const board = catalog.boards[boardIndex];

  return {
    boardId: board.boardId,
    dayIndex: getScheduleDayOffset() + 1,
    date: getTodayIsoDate(),
    language: board.language || catalog.language,
    grid: board.grid,
    maxWords: catalog.maximumWords,
    minimumWordLength: catalog.minimumWordLength,
  };
}

/**
 * Returns the dictionary words for one language from the local export file.
 *
 * @param {string} language - The requested language code.
 * @returns {Promise<string[]>} The normalized dictionary words.
 */
export async function getDictionaryWords(language) {
  const dictionary = await loadDictionary(language);
  return dictionary.words;
}
