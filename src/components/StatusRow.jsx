import { useState, useEffect } from "react";
import { formatDuration } from "../game-engine.js";

/**
 * Self-contained live timer. Only ticks while the run is active.
 */
function GameTimer({ startedAt, finishedAt }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!startedAt || finishedAt) {
      return;
    }
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [startedAt, finishedAt]);

  const elapsed = startedAt ? (finishedAt ?? now) - startedAt : 0;
  return <strong>{formatDuration(elapsed)}</strong>;
}

/**
 * Renders the compact status metrics above the board.
 *
 * @param {object} props - Component props.
 * @param {boolean} props.loading - Whether the board is loading.
 * @param {string} props.loadError - The current load error message, if any.
 * @param {number} props.characterTotal - The number of unique activated tiles.
 * @param {number} props.submittedWordCount - The number of submitted words.
 * @param {number} props.maxWords - The move cap for the board.
 * @param {number | null} props.startedAt - Run start timestamp.
 * @param {number | null} props.finishedAt - Run finish timestamp.
 * @returns {JSX.Element} The rendered status row.
 */
export default function StatusRow({
  loading,
  loadError,
  characterTotal,
  submittedWordCount,
  maxWords,
  startedAt,
  finishedAt,
}) {
  const isUnavailable = loading || Boolean(loadError);

  return (
    <section className="status-row" aria-label="Puzzle status">
      <div className="status-pill">
        <span className="status-label">
          Characters <span className="status-hint">(lower&nbsp;=&nbsp;better)</span>
        </span>
        <strong>{isUnavailable ? "--" : characterTotal}</strong>
      </div>
      <div className="status-pill">
        <span className="status-label">Words</span>
        <strong>{isUnavailable ? "--/--" : `${submittedWordCount}/${maxWords}`}</strong>
      </div>
      <div className="status-pill">
        <span className="status-label">Time</span>
        {isUnavailable ? (
          <strong>--:--</strong>
        ) : (
          <GameTimer startedAt={startedAt} finishedAt={finishedAt} />
        )}
      </div>
    </section>
  );
}
