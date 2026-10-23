// Moved verbatim from AppShell.jsx (V4.47.0 module split) — no behavior changes.


export function AppFooter({ syncDisplay }) {
  return (
    <footer className="app-footer">
      <span style={{ fontSize:11, color:"var(--text-muted)" }}>
        Designed &amp; Built by{" "}
        <a href="mailto:hello@simcha-kit.com" className="footer-link">Brook Creative LLC</a>
      </span>
      <span>&middot;</span>
      <a href="https://about.simcha-kit.com" target="_blank" rel="noopener" className="footer-link" style={{ fontSize:11 }}>about.simcha-kit.com</a>
      <span>&middot;</span>
      <div className="footer-sync" title={syncDisplay.label} aria-label={syncDisplay.label}>
        <div className={`sync-dot ${syncDisplay.dotClass}`} />
      </div>
    </footer>
  );
}
