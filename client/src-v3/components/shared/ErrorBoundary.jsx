// ─────────────────────────────────────────────────────────────────────────────
// SimchaKit V4.20.0 — components/shared/ErrorBoundary.jsx
// Reusable Error Boundary. Catches errors thrown during rendering, lifecycle
// methods, and constructors anywhere in its child tree (React's documented
// scope for error boundaries) and shows a fallback instead of leaving a
// blank screen.
//
// Does NOT catch: errors in event handlers, or async code (a .then() that
// rejects without being caught). Those are covered separately by the
// window "error"/"unhandledrejection" listeners registered in App.v3.jsx,
// both funneling into the same utils/errorReporting.js.
//
// Usage:
//   <ErrorBoundary
//     source="tab:budget"
//     title="Something went wrong with this tab"
//     onNavigateAway={() => navigateTo("overview")}
//     navigateAwayLabel="Back to Overview"
//     eventId={eventId}
//     activeTab={activeTab}
//     collaboratorRole={collaboratorRole}
//     session={session}
//   >
//     {children}
//   </ErrorBoundary>
//
// Give it a `key` that changes when its subtree's identity changes (e.g.
// `key={activeTab}` when wrapping a tab-switch block) so navigating away
// and back automatically remounts a fresh boundary instead of carrying
// stale error state.
// ─────────────────────────────────────────────────────────────────────────────

import { Component } from "react";
import { Icon } from "@/utils/iconMap.jsx";
import { reportClientError } from "@/utils/errorReporting.js";

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorId: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    reportClientError(error, {
      source:           this.props.source || "unknown",
      componentStack:   errorInfo?.componentStack,
      eventId:          this.props.eventId,
      activeTab:        this.props.activeTab,
      collaboratorRole: this.props.collaboratorRole,
      session:          this.props.session,
    }).then((errorId) => {
      if (errorId) this.setState({ errorId });
    });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorId: null });
    if (this.props.onReset) this.props.onReset();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: "flex", flexDirection: "column", alignItems: "center",
          justifyContent: "center", minHeight: "40vh", gap: 14,
          padding: 24, textAlign: "center",
        }}>
          <div style={{ fontSize: 36 }}><Icon name="alertTriangle" context="empty" /></div>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 18, color: "var(--text-primary)" }}>
            {this.props.title || "Something went wrong"}
          </div>
          <div style={{ fontSize: 13, color: "var(--text-muted)", maxWidth: 360 }}>
            {this.props.message || "This part of SimchaKit hit an unexpected error. You can try again, or head back and continue elsewhere."}
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button className="btn btn-secondary" onClick={this.handleReset}>Try again</button>
            {this.props.onNavigateAway && (
              <button className="btn btn-secondary" onClick={this.props.onNavigateAway}>
                {this.props.navigateAwayLabel || "Go back"}
              </button>
            )}
          </div>
          {this.state.errorId && (
            <div style={{ fontSize: 11, color: "var(--text-muted)", opacity: 0.6 }}>
              Error ID: {this.state.errorId}
            </div>
          )}
        </div>
      );
    }
    return this.props.children;
  }
}
