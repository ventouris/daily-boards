import { useEffect, useRef } from "react";

function ExampleTile({ letter, tone, label }) {
  return (
    <div className="help-example">
      <div className={`help-example-tile ${tone}`}>{letter}</div>
      <span>{label}</span>
    </div>
  );
}

export default function HelpModal({ open, onClose }) {
  const dialogRef = useRef(null);

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

  return (
    <dialog ref={dialogRef} className="help-dialog" onClose={onClose} onClick={handleDialogClick}>
      <section className="overlay-card" onClick={(e) => e.stopPropagation()}>
        <header className="modal-header">
          <h2>How To Play</h2>
          <button className="icon-button close-button" type="button" aria-label="Close help" onClick={onClose}>
            ×
          </button>
        </header>
        <div className="modal-body">
          <p>Start from any bottom-row tile. Swipe or tap through touching letters to build a word.</p>

          <section className="help-visual-section" aria-label="Tile color guide">
            <h3>Tile Colors</h3>
            <div className="help-example-grid">
              <ExampleTile letter="A" tone="current" label="Gold — part of your current word" />
              <ExampleTile letter="E" tone="activated" label="Green — already activated by a submitted word" />
              <ExampleTile letter="T" tone="start" label="Outlined — valid place to start the next word" />
            </div>
          </section>

          <p>After your first submit, every next word must begin on a green activated tile.</p>

          <section className="help-visual-section" aria-label="Backtracking example">
            <h3>Going Back Mid Word</h3>
            <div className="help-backtrack-demo" aria-hidden="true">
              <div className="help-backtrack-path">
                <span className="help-example-tile current">C</span>
                <span className="help-backtrack-arrow">→</span>
                <span className="help-example-tile current">A</span>
                <span className="help-backtrack-arrow">→</span>
                <span className="help-example-tile current">T</span>
                <span className="help-backtrack-arrow">→</span>
                <span className="help-example-tile current">S</span>
              </div>
              <div className="help-backtrack-rewind">
                <span>Tap or drag back to</span>
                <span className="help-example-tile rewind">T</span>
                <span>to remove it and everything after it.</span>
              </div>
            </div>
            <p>If you make a mistake, drag onto a letter already in your current path to rewind from that point and keep building.</p>
          </section>

          <p>Reach the top row before you run out of words. Lower character count is better.</p>
        </div>
      </section>
    </dialog>
  );
}
