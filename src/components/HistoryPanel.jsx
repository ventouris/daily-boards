function getHistoryMessage(loading, loadError, submittedWordCount) {
  if (loading) return "Loading board...";
  if (loadError) return "Could not load the board data.";
  if (submittedWordCount === 0) return "No submitted words yet.";
  return null;
}

export default function HistoryPanel({ loading, loadError, submittedWords, onReplaySelect }) {
  const historyMessage = getHistoryMessage(loading, loadError, submittedWords.length);

  return (
    <section className="history-panel" aria-label="Submitted words">
      <div className="history-header">
        <h2>Route</h2>
        {submittedWords.length > 0 && (
          <span className="history-hint">Tap a word to replay its path</span>
        )}
      </div>
      <div className="history-list">
        {historyMessage ? (
          <p className="history-empty">{historyMessage}</p>
        ) : (
          submittedWords.map((entry, index) => (
            <button
              key={`${entry.word}-${index}`}
              type="button"
              className="history-item"
              data-index={index}
              onClick={onReplaySelect}
              aria-label={`Replay path for ${entry.word}`}
            >
              {index + 1}. {entry.word.toUpperCase()}
              <span className="history-replay-icon" aria-hidden="true">↺</span>
            </button>
          ))
        )}
      </div>
    </section>
  );
}
