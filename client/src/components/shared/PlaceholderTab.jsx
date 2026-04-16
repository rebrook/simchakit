export function PlaceholderTab({ icon, title, description, version }) {
  return (
    <div className="placeholder-tab">
      <div className="placeholder-icon">{icon}</div>
      <div className="placeholder-title">{title}</div>
      <div className="placeholder-desc">{description}</div>
      <div className="placeholder-badge">Coming in {version}</div>
    </div>
  );
}
