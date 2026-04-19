import { useState } from "react";

export function SuggestionsPanel({ suggestions, onAdd, onDismiss, dismissedCount, onRestore, onNavigate }) {
  const [open, setOpen] = useState(false);

  if (suggestions.length === 0 && dismissedCount === 0) return null;

  return (
    <div className="suggestions-panel">
      <div className="suggestions-header" onClick={() => setOpen(o => !o)}>
        <div className="suggestions-title">
          <span>💡</span>
          <span>Suggested Tasks</span>
          {suggestions.length > 0 && <span className="suggestions-count">{suggestions.length}</span>}
        </div>
        <span className="suggestions-caret">{open ? "▴ collapse" : "▾ expand"}</span>
      </div>
      {open && (
        <div>
          {suggestions.length === 0 && dismissedCount > 0 && (
            <div style={{padding:"16px",textAlign:"center",color:"var(--text-muted)",fontSize:13}}>
              All suggestions dismissed.
            </div>
          )}
          {suggestions.map(s => (
            <div key={s.id} className="suggestion-row">
              <span className="suggestion-icon">{s.icon}</span>
              <div className="suggestion-body">
                <div className="suggestion-text">{s.text}</div>
                {s.meta && (
                  <div className={`suggestion-meta ${s.metaCls==="urgent"?"suggestion-due-urgent":s.metaCls==="soon"?"suggestion-due-soon":""}`}>
                    {s.meta}
                  </div>
                )}
              </div>
              {s.sourceTab && onNavigate && (
                <button className="btn btn-secondary btn-sm"
                  style={{flexShrink:0,fontSize:12,padding:"4px 10px"}}
                  onClick={() => onNavigate(s.sourceTab, s.sourceId, s.sourceCollection)}>
                  → View
                </button>
              )}
              <button className="btn btn-secondary btn-sm"
                style={{flexShrink:0,fontSize:12,padding:"4px 10px"}}
                onClick={() => onAdd(s)}>
                + Add
              </button>
              <button className="icon-btn" title="Dismiss suggestion"
                style={{flexShrink:0,width:26,height:26,fontSize:12,color:"var(--text-muted)"}}
                onClick={() => onDismiss(s)}>
                ✕
              </button>
            </div>
          ))}
          {dismissedCount > 0 && (
            <div style={{padding:"8px 14px",borderTop:"1px solid var(--border)",display:"flex",alignItems:"center",justifyContent:"flex-end"}}>
              <button
                style={{background:"none",border:"none",cursor:"pointer",fontSize:12,color:"var(--text-muted)",padding:0}}
                onClick={onRestore}>
                Restore {dismissedCount} dismissed suggestion{dismissedCount !== 1 ? "s" : ""}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
