import { useEffect, useReducer, useRef, useState } from "react";
import {
  buildLanguagePath,
  ensureLanguagePath,
  getLanguageFromPathname,
  getDailyBoard,
  getDictionaryWords,
} from "./data-client.js";
import {
  buildShareText,
  buildWord,
  canStartPath,
  clonePath,
  commitWord,
  createDictionary,
  createMatrix,
  evaluatePath,
  extendPath,
  serializeCell,
} from "./game-engine.js";
import BoardGrid from "./components/BoardGrid.jsx";
import ComposerPanel from "./components/ComposerPanel.jsx";
import GameHeader from "./components/GameHeader.jsx";
import HelpModal from "./components/HelpModal.jsx";
import HistoryPanel from "./components/HistoryPanel.jsx";
import ResultSheet from "./components/ResultSheet.jsx";
import StatusRow from "./components/StatusRow.jsx";

// ─── Constants ────────────────────────────────────────────────────────────────

const EMPTY_BOARD = {
  boardId: null,
  dayIndex: null,
  date: null,
  language: "en",
  grid: [],
  maxWords: 6,
  minimumWordLength: 3,
};

const TILE_DELAY_STEP_MS = 70;
const SUBMIT_BASE_MS = 540;

function getSubmitTimeout(pathLength) {
  return (pathLength - 1) * TILE_DELAY_STEP_MS + SUBMIT_BASE_MS;
}

// ─── localStorage helpers ─────────────────────────────────────────────────────

const RUN_KEY_PREFIX = "gridly-run-v1-";
const STREAKS_KEY = "gridly-streaks-v1";

function loadRunState(boardId) {
  try {
    const raw = localStorage.getItem(`${RUN_KEY_PREFIX}${boardId}`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveRunState(boardId, runState) {
  try {
    localStorage.setItem(
      `${RUN_KEY_PREFIX}${boardId}`,
      JSON.stringify({
        activated: runState.activated,
        submittedWords: runState.submittedWords,
        scoreUniqueActivated: runState.scoreUniqueActivated,
        completed: runState.completed,
        startedAt: runState.startedAt,
        finishedAt: runState.finishedAt,
      }),
    );
  } catch {
    // Storage unavailable.
  }
}

function loadStreaks() {
  try {
    const raw = localStorage.getItem(STREAKS_KEY);
    return raw ? JSON.parse(raw) : { currentStreak: 0, bestStreak: 0, lastCompletedDate: null };
  } catch {
    return { currentStreak: 0, bestStreak: 0, lastCompletedDate: null };
  }
}

function saveStreaks(streaks) {
  try {
    localStorage.setItem(STREAKS_KEY, JSON.stringify(streaks));
  } catch {
    // Storage unavailable.
  }
}

function computeNewStreaks(current, todayDate) {
  if (current.lastCompletedDate === todayDate) {
    return current; // Already completed today.
  }
  const yesterday = new Date();
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  const yesterdayStr = yesterday.toISOString().slice(0, 10);
  const newStreak = current.lastCompletedDate === yesterdayStr ? current.currentStreak + 1 : 1;
  return {
    currentStreak: newStreak,
    bestStreak: Math.max(current.bestStreak, newStreak),
    lastCompletedDate: todayDate,
  };
}

// ─── Pure helpers ─────────────────────────────────────────────────────────────

function buildBoardState(dailyBoard) {
  return {
    boardId: dailyBoard.boardId,
    dayIndex: typeof dailyBoard.dayIndex === "number" ? dailyBoard.dayIndex : 1,
    date: dailyBoard.date || dailyBoard.boardId,
    language: dailyBoard.language || "en",
    grid: dailyBoard.grid.map((row) => row.slice()),
    maxWords: dailyBoard.maxWords || 6,
    minimumWordLength: dailyBoard.minimumWordLength || 3,
  };
}

function getIdleMessage(submittedWordCount) {
  return submittedWordCount === 0
    ? "Your first word must start from the bottom row."
    : "Start the next word from any activated tile.";
}

function buildDisplayWord({ grid, currentPath, loading, loadError, hasStarted }) {
  if (currentPath.length > 0) return buildWord(grid, currentPath);
  if (loading) return "Loading board...";
  if (loadError) return "Board unavailable";
  if (!hasStarted) return "Press start to begin";
  return "Trace a path to begin";
}

function tileToCell(tile) {
  return { row: Number(tile.dataset.row), col: Number(tile.dataset.col) };
}

function isSameCell(a, b) {
  return Boolean(a && b && a.row === b.row && a.col === b.col);
}

// ─── Reducer ──────────────────────────────────────────────────────────────────

const initialGameState = {
  board: EMPTY_BOARD,
  dictionary: new Set(),
  dictionaryLoading: true,
  loading: true,
  loadError: "",
  routeLanguage: getLanguageFromPathname(),
  activated: [],
  currentPath: [],
  submittedWords: [],
  scoreUniqueActivated: 0,
  completed: false,
  message: "Fetching today's board.",
  startedAt: null,
  finishedAt: null,
  replayPath: [],
  helpOpen: false,
  resultOpen: false,
  resultMode: "complete",
  isSubmitting: false,
};

function gameReducer(state, action) {
  switch (action.type) {
    case "LOAD_START":
      return {
        ...state,
        loading: true,
        dictionaryLoading: true,
        loadError: "",
        message: "Fetching today's board.",
      };

    case "LOAD_BOARD_SUCCESS": {
      const nextBoard = buildBoardState(action.board);
      const rows = action.board.grid.length;
      const cols = action.board.grid[0]?.length ?? 0;
      const saved = action.savedRun;
      const hasSaved =
        saved &&
        Array.isArray(saved.activated) &&
        saved.activated.length === rows &&
        (saved.activated[0]?.length ?? 0) === cols;

      return {
        ...state,
        board: nextBoard,
        loading: false,
        activated: hasSaved ? saved.activated : createMatrix(rows, cols, false),
        currentPath: [],
        submittedWords: hasSaved ? saved.submittedWords : [],
        scoreUniqueActivated: hasSaved ? saved.scoreUniqueActivated : 0,
        completed: hasSaved ? saved.completed : false,
        startedAt: hasSaved ? saved.startedAt : null,
        finishedAt: hasSaved ? saved.finishedAt : null,
        replayPath: [],
        resultOpen: hasSaved && Boolean(saved.finishedAt),
        resultMode: hasSaved && saved.completed ? "complete" : (hasSaved && saved.finishedAt ? "out-of-moves" : "complete"),
        isSubmitting: false,
        message: hasSaved && !saved.finishedAt
          ? getIdleMessage(saved.submittedWords?.length ?? 0)
          : getIdleMessage(0),
      };
    }

    case "LOAD_DICTIONARY_SUCCESS":
      return { ...state, dictionary: action.dictionary, dictionaryLoading: false };

    case "LOAD_ERROR":
      return { ...state, loading: false, dictionaryLoading: false, loadError: action.error, message: action.error };

    case "START_GAME":
      return { ...state, startedAt: action.startedAt, finishedAt: null };

    case "SET_PATH":
      return { ...state, currentPath: action.path, message: action.message, replayPath: [] };

    case "CLEAR_PATH":
      return { ...state, currentPath: [], message: getIdleMessage(state.submittedWords.length), replayPath: [] };

    case "SET_REPLAY_PATH":
      return { ...state, replayPath: action.path };

    case "FLASH_MESSAGE":
      return { ...state, message: action.message };

    case "BEGIN_SUBMISSION":
      return { ...state, isSubmitting: true };

    case "COMMIT_WORD":
      return {
        ...state,
        activated: action.committed.activated,
        submittedWords: action.committed.submittedWords,
        scoreUniqueActivated: action.committed.scoreUniqueActivated,
        completed: action.committed.completed,
        currentPath: [],
        replayPath: [],
        isSubmitting: false,
        message: action.message,
        finishedAt: action.finishedAt ?? state.finishedAt,
        resultOpen: action.resultOpen ?? state.resultOpen,
        resultMode: action.resultMode ?? state.resultMode,
      };

    case "OPEN_HELP":
      return { ...state, helpOpen: true };

    case "CLOSE_HELP":
      return { ...state, helpOpen: false };

    case "OPEN_RESULT":
      return { ...state, resultOpen: true };

    case "CLOSE_RESULT":
      return { ...state, resultOpen: false };

    case "SET_ROUTE_LANGUAGE":
      return { ...state, routeLanguage: action.language };

    default:
      return state;
  }
}

// ─── App ──────────────────────────────────────────────────────────────────────

export default function App() {
  const [state, dispatch] = useReducer(gameReducer, initialGameState);
  const stateRef = useRef(state);
  // Keep stateRef current for gesture handlers that fire between renders.
  stateRef.current = state;

  const [streaks, setStreaks] = useState(() => loadStreaks());
  const [celebrating, setCelebrating] = useState(false);
  const [isDark, setIsDark] = useState(() => {
    return document.documentElement.getAttribute("data-theme") === "dark";
  });

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", isDark ? "dark" : "light");
    try { localStorage.setItem("gridly-theme", isDark ? "dark" : "light"); } catch { /* ignore */ }
  }, [isDark]);

  function toggleTheme() {
    setIsDark((prev) => !prev);
  }

  const boardRef = useRef(null);
  const connectionsRef = useRef(null);
  const currentWordRef = useRef(null);
  const submitTimeoutRef = useRef(null);
  const tileRefs = useRef(new Map());
  const gestureRef = useRef({ dragging: false, activePointerId: null, suppressClick: false });

  // Destructure for convenience in JSX.
  const {
    board, dictionary, dictionaryLoading, loading, loadError,
    routeLanguage, activated, currentPath, submittedWords,
    scoreUniqueActivated, completed, message, startedAt, finishedAt,
    replayPath, helpOpen, resultOpen, resultMode, isSubmitting,
  } = state;

  const isReady = !loading && !loadError && board.grid.length > 0;
  const hasStarted = startedAt !== null;
  const hasFinished = finishedAt !== null;
  const canInteract = isReady && hasStarted && !hasFinished && !isSubmitting;
  const totalCells = board.grid.length * (board.grid[0]?.length ?? 0);
  const elapsed = startedAt && finishedAt ? finishedAt - startedAt : 0;
  const displayWord = buildDisplayWord({ grid: board.grid, currentPath, loading, loadError, hasStarted });
  const shareText = board.dayIndex
    ? buildShareText({
      boardNumber: board.dayIndex,
      characterTotal: scoreUniqueActivated,
      totalCells,
      wordsUsed: submittedWords.length,
      elapsed,
      activated,
    })
    : "";

  // ── dispatchAndSync ──────────────────────────────────────────────────────────
  // Updates stateRef synchronously (for gesture handlers) then queues a React dispatch.

  function dispatchAndSync(action) {
    stateRef.current = gameReducer(stateRef.current, action);
    dispatch(action);
  }

  // ── Tile refs ────────────────────────────────────────────────────────────────

  function getTileElement(cell) {
    return tileRefs.current.get(serializeCell(cell));
  }

  function registerTileRef(cell, element) {
    const key = serializeCell(cell);
    if (element) {
      tileRefs.current.set(key, element);
    } else {
      tileRefs.current.delete(key);
    }
  }

  // ── Connection line ──────────────────────────────────────────────────────────

  function updateConnections() {
    const svg = connectionsRef.current;
    const boardElement = boardRef.current;
    const snapshot = stateRef.current;
    if (!svg || !boardElement || !snapshot.board.grid.length) return;

    const path = snapshot.replayPath.length > 0 ? snapshot.replayPath : snapshot.currentPath;
    const boardRect = boardElement.getBoundingClientRect();
    const points = path
      .map((cell) => {
        const tile = getTileElement(cell);
        if (!tile) return null;
        const rect = tile.getBoundingClientRect();
        return `${rect.left - boardRect.left + rect.width / 2},${rect.top - boardRect.top + rect.height / 2}`;
      })
      .filter(Boolean);

    svg.setAttribute("viewBox", `0 0 ${boardRect.width} ${boardRect.height}`);
    svg.innerHTML = points.length > 1 ? `<polyline points="${points.join(" ")}" />` : "";
  }

  // ── Animations ───────────────────────────────────────────────────────────────

  function animateTile(cell, className, delayMs) {
    const tile = getTileElement(cell);
    if (!tile) return;
    if (typeof delayMs === "number") {
      tile.style.setProperty("--tile-delay", `${delayMs}ms`);
    } else {
      tile.style.removeProperty("--tile-delay");
    }
    tile.classList.remove(className);
    void tile.offsetWidth;
    tile.classList.add(className);
  }

  function animateBacktrackedTiles(previousPath, nextLength) {
    previousPath.slice(nextLength).forEach((cell, index) => animateTile(cell, "trace-backtrack", index * 35));
  }

  function animateSubmittedTiles(path) {
    path.forEach((cell, index) => animateTile(cell, "submit-spin", index * TILE_DELAY_STEP_MS));
  }

  function animateInvalidTiles(path) {
    path.forEach((cell, index) => animateTile(cell, "invalid-flash", index * 20));
  }

  function handleTileAnimationEnd(event) {
    event.currentTarget.classList.remove("trace-enter", "trace-backtrack", "submit-spin", "invalid-flash", "pulse");
    event.currentTarget.style.removeProperty("--tile-delay");
  }

  function flashMessage(nextMessage) {
    dispatchAndSync({ type: "FLASH_MESSAGE", message: nextMessage });
    const wordElement = currentWordRef.current;
    if (!wordElement) return;
    wordElement.classList.remove("shake");
    window.requestAnimationFrame(() => wordElement.classList.add("shake"));
  }

  // ── Path message ─────────────────────────────────────────────────────────────

  function buildPathMessage(nextPath, nextSubmittedWords = stateRef.current.submittedWords, nextActivated = stateRef.current.activated) {
    if (nextPath.length === 0) return getIdleMessage(nextSubmittedWords.length);
    if (stateRef.current.dictionaryLoading) return "Loading word list...";

    const evaluation = evaluatePath({
      grid: stateRef.current.board.grid,
      activated: nextActivated,
      currentPath: nextPath,
      submittedWords: nextSubmittedWords,
      dictionary: stateRef.current.dictionary,
      minimumWordLength: stateRef.current.board.minimumWordLength,
    });

    if (evaluation.isValid) return "Word ready. Tap submit.";

    if (evaluation.reason === "Not in dictionary." && evaluation.word) {
      return `"${evaluation.word.toUpperCase()}" is not in the word list.`;
    }
    return evaluation.reason;
  }

  // ── Game flow ────────────────────────────────────────────────────────────────

  function startTimerIfNeeded() {
    if (!stateRef.current.startedAt) {
      dispatchAndSync({ type: "START_GAME", startedAt: Date.now() });
    }
  }

  function getInvalidStartMessage() {
    return stateRef.current.submittedWords.length === 0
      ? "Start on the bottom row."
      : "Start from an activated tile.";
  }

  function handleStartGame() {
    if (!isReady || hasStarted) return;
    startTimerIfNeeded();
    dispatchAndSync({ type: "FLASH_MESSAGE", message: getIdleMessage(0) });
  }

  function handleLanguageChange(language) {
    window.history.pushState(null, "", `${buildLanguagePath(language)}${window.location.search}${window.location.hash}`);
    dispatchAndSync({ type: "SET_ROUTE_LANGUAGE", language });
  }

  function startPath(cell) {
    startTimerIfNeeded();
    const path = [cell];
    dispatchAndSync({ type: "SET_PATH", path, message: buildPathMessage(path) });
    animateTile(cell, "trace-enter");
  }

  function stepPath(cell) {
    const previousPath = stateRef.current.currentPath;
    const nextPath = extendPath({ currentPath: previousPath, nextCell: cell });

    if (nextPath.length === previousPath.length && !isSameCell(cell, previousPath[previousPath.length - 1])) {
      flashMessage("Use adjacent tiles and do not reuse a tile in the same word.");
      return;
    }

    dispatchAndSync({ type: "SET_PATH", path: nextPath, message: buildPathMessage(nextPath) });

    if (nextPath.length > previousPath.length) {
      animateTile(nextPath[nextPath.length - 1], "trace-enter");
    } else if (nextPath.length < previousPath.length) {
      animateBacktrackedTiles(previousPath, nextPath.length);
    }
  }

  function beginGesture(cell) {
    dispatchAndSync({ type: "SET_REPLAY_PATH", path: [] });
    const snapshot = stateRef.current;

    if (snapshot.currentPath.length === 0) {
      if (!canStartPath({ grid: snapshot.board.grid, activated: snapshot.activated, submittedWords: snapshot.submittedWords }, cell)) {
        flashMessage(getInvalidStartMessage());
        return false;
      }
      startPath(cell);
      return true;
    }

    if (isSameCell(cell, snapshot.currentPath[snapshot.currentPath.length - 1])) {
      return true;
    }

    stepPath(cell);
    return true;
  }

  function suppressNextClick() {
    gestureRef.current.suppressClick = true;
  }

  // ── Pointer handlers ─────────────────────────────────────────────────────────

  function handlePointerDown(event) {
    if (!canInteract) return;
    const tile = event.target.closest(".tile");
    if (!tile) return;

    const cell = tileToCell(tile);
    const existingIndex = stateRef.current.currentPath.findIndex((pathCell) => isSameCell(pathCell, cell));

    if (existingIndex !== -1) {
      stepPath(cell);
      suppressNextClick();
      return;
    }

    const started = beginGesture(cell);
    if (!started) {
      suppressNextClick();
      return;
    }

    gestureRef.current.dragging = true;
    gestureRef.current.activePointerId = event.pointerId;
    gestureRef.current.suppressClick = false;
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event) {
    if (!canInteract || !gestureRef.current.dragging || gestureRef.current.activePointerId !== event.pointerId) return;

    const tile = document.elementFromPoint(event.clientX, event.clientY)?.closest(".tile");
    if (!tile) return;

    const previousLength = stateRef.current.currentPath.length;
    stepPath(tileToCell(tile));
    if (stateRef.current.currentPath.length !== previousLength) {
      suppressNextClick();
    }
  }

  function handlePointerUp(event) {
    if (gestureRef.current.activePointerId !== event.pointerId) return;
    gestureRef.current.dragging = false;
    gestureRef.current.activePointerId = null;
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      // Ignore pointer release issues.
    }
  }

  function handleTileClick(event) {
    if (!canInteract) return;
    if (gestureRef.current.suppressClick) {
      gestureRef.current.suppressClick = false;
      return;
    }
    const cell = tileToCell(event.currentTarget);
    if (stateRef.current.currentPath.length === 0) {
      beginGesture(cell);
    } else {
      stepPath(cell);
    }
  }

  // ── Submit ───────────────────────────────────────────────────────────────────

  function getCurrentEvaluation() {
    return evaluatePath({
      grid: board.grid,
      activated,
      currentPath,
      submittedWords,
      dictionary,
      minimumWordLength: board.minimumWordLength,
    });
  }

  function showInvalidSubmission(reason, word) {
    const displayReason = reason === "Not in dictionary." && word
      ? `"${word.toUpperCase()}" is not in the word list.`
      : reason;
    flashMessage(displayReason);
    animateInvalidTiles(currentPath);
  }

  function applyCommittedWord(pathToSubmit, committed) {
    let resultOpen = undefined;
    let resultMode = undefined;
    let finishedAt = undefined;
    let message;

    if (committed.completed) {
      finishedAt = Date.now();
      message = "Top reached. Share your run and view the results.";
      resultMode = "complete";
      resultOpen = true;
      setCelebrating(true);
    } else if (committed.submittedWords.length >= board.maxWords) {
      finishedAt = Date.now();
      message = "Out of moves.";
      resultMode = "out-of-moves";
      resultOpen = true;
    } else {
      message = "Word submitted. Build the next chain from an activated tile.";
    }

    dispatchAndSync({ type: "COMMIT_WORD", committed, message, finishedAt, resultOpen, resultMode });
    saveRunState(board.boardId, {
      activated: committed.activated,
      submittedWords: committed.submittedWords,
      scoreUniqueActivated: committed.scoreUniqueActivated,
      completed: committed.completed,
      startedAt,
      finishedAt: finishedAt ?? null,
    });
  }

  function queueSubmission(pathToSubmit, committed) {
    dispatchAndSync({ type: "BEGIN_SUBMISSION" });
    animateSubmittedTiles(pathToSubmit);

    if (submitTimeoutRef.current) {
      window.clearTimeout(submitTimeoutRef.current);
    }
    submitTimeoutRef.current = window.setTimeout(() => {
      submitTimeoutRef.current = null;
      applyCommittedWord(pathToSubmit, committed);
    }, getSubmitTimeout(pathToSubmit.length));
  }

  function handleSubmit() {
    if (!canInteract || currentPath.length === 0) return;
    if (dictionaryLoading) {
      dispatchAndSync({ type: "FLASH_MESSAGE", message: "Still loading word list." });
      return;
    }

    const evaluation = getCurrentEvaluation();
    if (!evaluation.isValid) {
      showInvalidSubmission(evaluation.reason, evaluation.word);
      return;
    }

    const pathToSubmit = clonePath(currentPath);
    const committed = commitWord({ activated, currentPath: pathToSubmit, submittedWords, word: evaluation.word });
    queueSubmission(pathToSubmit, committed);
  }

  function handleClear() {
    dispatchAndSync({ type: "CLEAR_PATH" });
  }

  // ── Share ────────────────────────────────────────────────────────────────────

  async function handleShare() {
    if (!shareText) return;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareText);
        dispatchAndSync({ type: "FLASH_MESSAGE", message: "Result copied to clipboard." });
      } else {
        throw new Error("clipboard unavailable");
      }
    } catch {
      dispatchAndSync({ type: "FLASH_MESSAGE", message: "Could not copy automatically. Try native share instead." });
    }
    if (navigator.share) {
      try {
        await navigator.share({ title: `Gridly Blitz #${board.dayIndex}`, text: shareText });
      } catch {
        // Ignore cancelled shares.
      }
    }
  }

  // ── Modal / sheet ─────────────────────────────────────────────────────────────

  function openResultSheet() {
    if (!hasFinished) return;
    dispatchAndSync({ type: "OPEN_RESULT" });
  }

  function handleReplaySelect(event) {
    const index = Number(event.currentTarget.dataset.index);
    const entry = submittedWords[index];
    if (!entry) return;
    dispatchAndSync({ type: "SET_REPLAY_PATH", path: clonePath(entry.path) });
  }

  // ── Load board ────────────────────────────────────────────────────────────────

  async function loadBoardData(isCancelled, language) {
    dispatchAndSync({ type: "LOAD_START" });
    try {
      const dailyBoard = await getDailyBoard(language);
      if (isCancelled()) return;

      const savedRun = loadRunState(dailyBoard.boardId);
      dispatchAndSync({ type: "LOAD_BOARD_SUCCESS", board: dailyBoard, savedRun });

      const dictionaryWords = await getDictionaryWords(language);
      if (isCancelled()) return;

      dispatchAndSync({ type: "LOAD_DICTIONARY_SUCCESS", dictionary: createDictionary(dictionaryWords) });
    } catch (error) {
      if (isCancelled()) return;
      const msg = error instanceof Error ? error.message : "Could not load the daily board.";
      dispatchAndSync({ type: "LOAD_ERROR", error: msg });
    }
  }

  // ── Effects ──────────────────────────────────────────────────────────────────

  // Load board on language change.
  useEffect(() => {
    let cancelled = false;
    loadBoardData(() => cancelled, routeLanguage);
    return () => { cancelled = true; };
  }, [routeLanguage]);

  // Normalize the URL on mount.
  useEffect(() => { ensureLanguagePath(); }, []);

  // React to browser back/forward navigation.
  useEffect(() => {
    function handlePopState() {
      dispatchAndSync({ type: "SET_ROUTE_LANGUAGE", language: ensureLanguagePath() });
    }
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  // Redraw connection line when path or board changes.
  useEffect(() => { updateConnections(); }, [currentPath, replayPath, board.grid]);

  useEffect(() => {
    window.addEventListener("resize", updateConnections);
    return () => window.removeEventListener("resize", updateConnections);
  }, []);

  // Clean up submit timeout on unmount.
  useEffect(() => {
    return () => {
      if (submitTimeoutRef.current) window.clearTimeout(submitTimeoutRef.current);
    };
  }, []);

  // Persist run state whenever meaningful run fields change.
  useEffect(() => {
    if (!loading && board.boardId && hasStarted) {
      saveRunState(board.boardId, { activated, submittedWords, scoreUniqueActivated, completed, startedAt, finishedAt });
    }
  }, [activated, submittedWords, scoreUniqueActivated, completed, startedAt, finishedAt, loading, board.boardId, hasStarted]);

  // Update streaks when the player completes the puzzle.
  useEffect(() => {
    if (completed && finishedAt && board.date) {
      setStreaks((prev) => {
        const next = computeNewStreaks(prev, board.date);
        saveStreaks(next);
        return next;
      });
    }
  }, [completed, finishedAt, board.date]);

  // Clear the celebrating flag after the animation finishes.
  useEffect(() => {
    if (!celebrating) return;
    const id = window.setTimeout(() => setCelebrating(false), 1000);
    return () => window.clearTimeout(id);
  }, [celebrating]);

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="app-shell">
      <GameHeader
        boardDate={board.date}
        dayIndex={board.dayIndex}
        loading={loading}
        loadError={loadError}
        routeLanguage={routeLanguage}
        isDark={isDark}
        onLanguageChange={handleLanguageChange}
        onThemeToggle={toggleTheme}
        onHelpOpen={() => dispatchAndSync({ type: "OPEN_HELP" })}
      />

      <StatusRow
        loading={loading}
        loadError={loadError}
        characterTotal={scoreUniqueActivated}
        submittedWordCount={submittedWords.length}
        maxWords={board.maxWords}
        startedAt={startedAt}
        finishedAt={finishedAt}
      />

      <BoardGrid
        board={board}
        activated={activated}
        currentPath={currentPath}
        replayPath={replayPath}
        celebrating={celebrating}
        isReady={isReady}
        hasStarted={hasStarted}
        submittedWords={submittedWords}
        boardRef={boardRef}
        connectionsRef={connectionsRef}
        registerTileRef={registerTileRef}
        onStart={handleStartGame}
        onHelpOpen={() => dispatchAndSync({ type: "OPEN_HELP" })}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onTileClick={handleTileClick}
        onTileAnimationEnd={handleTileAnimationEnd}
      />

      {!loading && !loadError && completed ? (
        <div className="celebration-banner">
          <span>Top reached. Share or view your results.</span>
          <button className="secondary-button celebration-results-button" type="button" onClick={openResultSheet}>
            Results
          </button>
        </div>
      ) : null}

      <ComposerPanel
        displayWord={displayWord}
        message={message}
        canSubmit={canInteract && currentPath.length > 0}
        onSubmit={handleSubmit}
        onClear={handleClear}
        currentWordRef={currentWordRef}
      />

      <HistoryPanel
        loading={loading}
        loadError={loadError}
        submittedWords={submittedWords}
        onReplaySelect={handleReplaySelect}
      />

      <HelpModal
        open={helpOpen}
        onClose={() => dispatchAndSync({ type: "CLOSE_HELP" })}
      />

      <ResultSheet
        open={resultOpen}
        resultMode={resultMode}
        completed={completed}
        characterTotal={scoreUniqueActivated}
        totalCells={totalCells}
        wordsUsed={submittedWords.length}
        elapsed={elapsed}
        shareText={shareText}
        streaks={streaks}
        onShare={handleShare}
        onClose={() => dispatchAndSync({ type: "CLOSE_RESULT" })}
      />
    </div>
  );
}
