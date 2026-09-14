export function AppHeader({ onOpenSettings }) {
  return (
    <header className="app-header">
      <a className="brand" href="/" aria-label="TypeSense home">
        <svg viewBox="0 0 28 28" aria-hidden="true">
          <rect x="2" y="6" width="24" height="16" rx="4" fill="none" stroke="currentColor" strokeWidth="2" />
          <path d="M7 11h2m3 0h2m3 0h2M7 16h3m3 0h8" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
        </svg>
        <span>TypeSense</span>
      </a>
      <button className="icon-button" onClick={onOpenSettings} aria-label="Open settings">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4Z" fill="none" stroke="currentColor" strokeWidth="1.8" />
          <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.9 2.9l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5v.2a2 2 0 1 1-4 0v-.2A1.7 1.7 0 0 0 9 19.4a1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.9-2.9l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.9-2.9l.1.1A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.9 2.9l-.1.1a1.7 1.7 0 0 0-.3 1.8 1.7 1.7 0 0 0 1.5 1h.2a2 2 0 1 1 0 4h-.2a1.7 1.7 0 0 0-1.5 1Z" fill="none" stroke="currentColor" strokeWidth="1.8" />
        </svg>
      </button>
    </header>
  );
}
