export default function ComposerPanel({ displayWord, message, canSubmit, onSubmit, onClear, currentWordRef }) {
  return (
    <section className="composer" aria-label="Current word builder">
      <div className="composer-copy">
        <p className="composer-label">Current word</p>
        <div ref={currentWordRef} className="current-word">{displayWord}</div>
      </div>
      <p className="message-line">{message}</p>
      <div className="action-row">
        <button
          className="secondary-button"
          type="button"
          disabled={!canSubmit}
          onClick={onClear}
          aria-label="Clear current word"
        >
          Clear
        </button>
        <button
          className="primary-button"
          type="button"
          disabled={!canSubmit}
          onClick={onSubmit}
        >
          Submit
        </button>
      </div>
    </section>
  );
}
