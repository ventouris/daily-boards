import { canStartPath, serializeCell } from "../game-engine.js";

function pathContainsCell(path, cell) {
  return path.some((pathCell) => pathCell.row === cell.row && pathCell.col === cell.col);
}

function buildTileClassName({ isCurrent, isActivated, isStart, isReplay }) {
  return [
    "tile",
    isCurrent ? "is-current" : "",
    isActivated ? "is-activated" : "",
    isStart ? "is-start" : "",
    isReplay ? "is-replay" : "",
  ].filter(Boolean).join(" ");
}

/**
 * Pre-computes the set of serialized cell keys that are valid start tiles.
 * Avoids calling canStartPath O(n²) times inside the render map.
 */
function buildValidStartKeys({ grid, activated, submittedWords, isReady, hasStarted, currentPath }) {
  if (!isReady || !hasStarted || currentPath.length > 0) {
    return null;
  }
  const keys = new Set();
  grid.forEach((row, rowIndex) => {
    row.forEach((_, colIndex) => {
      const cell = { row: rowIndex, col: colIndex };
      if (canStartPath({ grid, activated, submittedWords }, cell)) {
        keys.add(serializeCell(cell));
      }
    });
  });
  return keys;
}

export default function BoardGrid({
  board,
  activated,
  currentPath,
  replayPath,
  celebrating,
  isReady,
  hasStarted,
  submittedWords,
  boardRef,
  connectionsRef,
  registerTileRef,
  onStart,
  onHelpOpen,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onTileClick,
  onTileAnimationEnd,
}) {
  const validStartKeys = buildValidStartKeys({
    grid: board.grid,
    activated,
    submittedWords,
    isReady,
    hasStarted,
    currentPath,
  });

  const boardClassName = [
    "board",
    celebrating ? "is-celebrating" : "",
  ].filter(Boolean).join(" ");

  return (
    <main className="board-panel">
      <div className={`board-frame${isReady && !hasStarted ? " has-start-overlay" : ""}`}>
        <svg ref={connectionsRef} className="connections-layer" aria-hidden="true" />
        <div
          ref={boardRef}
          className={boardClassName}
          role="grid"
          aria-label="Gridly board"
          style={board.grid.length ? { "--board-size": board.grid[0].length } : undefined}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          {board.grid.map((row, rowIndex) =>
            row.map((letter, colIndex) => {
              const cell = { row: rowIndex, col: colIndex };
              const key = serializeCell(cell);
              const isCurrent = pathContainsCell(currentPath, cell);
              const isActivated = Boolean(activated[rowIndex]?.[colIndex]);
              const isStart = validStartKeys ? validStartKeys.has(key) : false;
              const isReplay = pathContainsCell(replayPath, cell);
              const className = buildTileClassName({ isCurrent, isActivated, isStart, isReplay });

              return (
                <button
                  key={key}
                  ref={(element) => registerTileRef(cell, element)}
                  type="button"
                  className={className}
                  data-row={rowIndex}
                  data-col={colIndex}
                  role="gridcell"
                  aria-label={`Row ${rowIndex + 1}, column ${colIndex + 1}, letter ${letter}`}
                  onClick={onTileClick}
                  onAnimationEnd={onTileAnimationEnd}
                >
                  {letter}
                </button>
              );
            })
          )}
        </div>
        {isReady && !hasStarted ? (
          <div className="board-start-overlay">
            <div className="board-start-actions">
              <button type="button" className="primary-button board-start-button" onClick={onStart}>
                Start
              </button>
              <button type="button" className="secondary-button board-start-help-button" onClick={onHelpOpen}>
                How To Play
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </main>
  );
}
