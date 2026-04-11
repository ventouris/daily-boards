import { supportedLanguages } from "../data-client.js";

function formatHeaderTitle(boardDate, loading, loadError) {
  if (loading) return "Loading...";
  if (loadError) return "Unavailable";
  return new Date(`${boardDate}T00:00:00`).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function SunIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="17"
      height="17"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="12" cy="12" r="4" />
      <line x1="12" y1="2"    x2="12" y2="5" />
      <line x1="12" y1="19"   x2="12" y2="22" />
      <line x1="4.93" y1="4.93"   x2="7.05" y2="7.05" />
      <line x1="16.95" y1="16.95" x2="19.07" y2="19.07" />
      <line x1="2"  y1="12" x2="5"  y2="12" />
      <line x1="19" y1="12" x2="22" y2="12" />
      <line x1="4.93" y1="19.07"  x2="7.05" y2="16.95" />
      <line x1="16.95" y1="7.05"  x2="19.07" y2="4.93" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="17"
      height="17"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

function GridlyLogo() {
  return (
    <svg
      className="brand-logo"
      viewBox="-8 -2 234 204"
      aria-hidden="true"
      focusable="false"
      shapeRendering="geometricPrecision"
    >
      {/* Empty (light) tiles */}
      <polygon className="logo-empty-tile" strokeWidth="4" points="12,0 76,0 70,56 6,56" />
      <polygon className="logo-empty-tile" strokeWidth="4" points="86,0 150,0 144,56 80,56" />
      <polygon className="logo-empty-tile" strokeWidth="4" points="160,0 224,0 218,56 154,56" />
      <polygon className="logo-empty-tile" strokeWidth="4" points="6,72 70,72 64,128 0,128" />
      <polygon className="logo-empty-tile" strokeWidth="4" points="80,72 144,72 138,128 74,128" />
      {/* Active (dark) tiles */}
      <polygon className="logo-active-tile" strokeWidth="4" points="154,72 218,72 212,128 148,128" />
      <polygon className="logo-active-tile" strokeWidth="4" points="0,144 64,144 58,200 -6,200" />
      <polygon className="logo-active-tile" strokeWidth="4" points="74,144 138,144 132,200 68,200" />
      <polygon className="logo-active-tile" strokeWidth="4" points="148,144 212,144 206,200 142,200" />
    </svg>
  );
}

export default function GameHeader({
  boardDate,
  dayIndex,
  loading,
  loadError,
  routeLanguage,
  isDark,
  onLanguageChange,
  onThemeToggle,
  onHelpOpen,
}) {
  const title = formatHeaderTitle(boardDate, loading, loadError);
  const eyebrow = dayIndex ? `Grid #${dayIndex}` : "Grid";

  return (
    <header className="topbar">
      <div className="brand-slot">
        <GridlyLogo />
      </div>
      <div className="title-block">
        <p className="eyebrow">{eyebrow}</p>
        <h1 className="title">{title}</h1>
      </div>
      <div className="header-actions">
        {supportedLanguages.length > 1 && (
          <select
            className="lang-select"
            value={routeLanguage}
            onChange={(e) => onLanguageChange(e.target.value)}
            aria-label="Select language"
          >
            {supportedLanguages.map((lang) => (
              <option key={lang} value={lang}>
                {lang.toUpperCase()}
              </option>
            ))}
          </select>
        )}
        <button
          className="icon-button"
          type="button"
          aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
          onClick={onThemeToggle}
        >
          {isDark ? <SunIcon /> : <MoonIcon />}
        </button>
        <button
          className="icon-button"
          type="button"
          aria-label="Open help"
          onClick={onHelpOpen}
        >
          ?
        </button>
      </div>
    </header>
  );
}
