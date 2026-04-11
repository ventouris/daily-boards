import { useState, useEffect, useRef } from "react";
import { formatDuration } from "../game-engine.js";

function getMsUntilNextPuzzle() {
  const now = new Date();
  const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
  return Math.max(0, next - now);
}

function useNextPuzzleCountdown() {
  const [ms, setMs] = useState(getMsUntilNextPuzzle);
  useEffect(() => {
    const id = window.setInterval(() => setMs(getMsUntilNextPuzzle()), 1000);
    return () => window.clearInterval(id);
  }, []);
  return ms;
}

function getResultTitle(resultMode, completed) {
  if (resultMode === "out-of-moves" && !completed) {
    return "Out of moves";
  }
  return "You reached the top!";
}

export default function ResultSheet({
  open,
  resultMode,
  completed,
  characterTotal,
  totalCells,
  wordsUsed,
  elapsed,
  shareText,
  streaks,
  onShare,
  onClose,
}) {
  const dialogRef = useRef(null);
  const countdown = useNextPuzzleCountdown();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  function handleDialogClick(event) {
    if (event.target === dialogRef.current) {
      onClose();
    }
  }

  const tileLabel = totalCells ? `${characterTotal} / ${totalCells}` : characterTotal;

  return (
    <dialog ref={dialogRef} className="result-dialog" onClose={onClose} onClick={handleDialogClick}>
      <section className="sheet-panel" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle" aria-hidden="true" />
        <header className="sheet-header">
          <div>
            <h2>{getResultTitle(resultMode, completed)}</h2>
          </div>
        </header>

        <div className="result-stats">
          <div className="result-stat-block">
            <strong>{formatDuration(elapsed)}</strong>
            <span>Time</span>
          </div>
          <div className="result-stat-block">
            <strong>{wordsUsed}</strong>
            <span>Words</span>
          </div>
          <div className="result-stat-block">
            <strong>{tileLabel}</strong>
            <span>Tiles (lower = better)</span>
          </div>
        </div>

        {streaks && (
          <div className="result-streaks">
            <div className="result-streak-block">
              <strong>{streaks.currentStreak}</strong>
              <span>Current streak</span>
            </div>
            <div className="result-streak-block">
              <strong>{streaks.bestStreak}</strong>
              <span>Best streak</span>
            </div>
          </div>
        )}

        <pre className="share-preview">{shareText}</pre>

        <p className="result-countdown">
          Next puzzle in <strong>{formatDuration(countdown)}</strong>
        </p>

        <footer className="sheet-actions">
          <button className="primary-button" type="button" onClick={onShare}>Share</button>
          <button className="secondary-button" type="button" onClick={onClose}>Close</button>
        </footer>
      </section>
    </dialog>
  );
}
