import { useState, useEffect } from "react";

export function TorahPortionCard({ adminConfig }) {
  const [status,   setStatus]   = useState("idle");   // idle | loading | loaded | error
  const [parasha,  setParasha]  = useState(null);
  const [expanded, setExpanded] = useState(true);

  // Derive main event date from timeline
  const mainEvent = (adminConfig?.timeline || []).find(e => e.isMainEvent) || null;
  const eventDate = mainEvent?.startDate || "";

  // Find the Saturday on or before a given date (Shabbat of that week)
  function getShabbatDate(dateStr) {
    if (!dateStr) return null;
    const d    = new Date(dateStr + "T12:00:00");
    const day  = d.getDay(); // 0=Sun, 6=Sat
    const diff = day === 6 ? 0 : -(day + 1);
    d.setDate(d.getDate() + diff);
    return d;
  }

  function formatDateISO(d) {
    if (!d) return "";
    const m  = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return d.getFullYear() + "-" + m + "-" + dd;
  }

  useEffect(() => {
    if (!eventDate) return;
    setStatus("loading");

    const shabbat = getShabbatDate(eventDate);
    if (!shabbat) { setStatus("error"); return; }

    const year       = shabbat.getFullYear();
    const month      = shabbat.getMonth() + 1;
    const shabbatISO = formatDateISO(shabbat);

    const url = "https://www.hebcal.com/hebcal?v=1&cfg=json&s=on&maj=off&min=off&mod=off&nx=off&ss=off&mf=off&leyning=on"
              + "&year=" + year + "&month=" + month;

    fetch(url)
      .then(r => {
        if (!r.ok) throw new Error("Hebcal returned " + r.status);
        return r.json();
      })
      .then(data => {
        const items = data.items || [];
        let match = items.find(item => item.category === "parashat" && item.date === shabbatISO);
        if (!match) match = items.find(item => item.category === "parashat");
        if (!match) throw new Error("No parasha found for " + shabbatISO);
        setParasha(match);
        setStatus("loaded");
      })
      .catch(err => {
        console.error("Hebcal fetch error:", err);
        setStatus("error");
      });
  }, [eventDate]);

  if (!eventDate) return (
    <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-md)", padding: "16px 18px", marginBottom: 24, color: "var(--text-muted)", fontSize: 13 }}>
      <span style={{ fontSize: 18, marginRight: 8 }}>📜</span>
      Torah portion will appear here once a main event date is set in Admin Mode.
    </div>
  );

  return (
    <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-md)", marginBottom: 24, overflow: "hidden" }}>
      {/* Header row */}
      <div
        onClick={() => setExpanded(e => !e)}
        style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 18px", cursor: "pointer", userSelect: "none", borderBottom: expanded ? "1px solid var(--border)" : "none" }}
      >
        <span style={{ fontSize: 20 }}>📜</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 16, fontWeight: 600, color: "var(--text-primary)" }}>
            {status === "loaded" && parasha
              ? parasha.title + (parasha.hebrew ? "  " + parasha.hebrew : "")
              : "Torah Portion"}
          </div>
          {status === "loaded" && parasha?.hdate && (
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{parasha.hdate}</div>
          )}
        </div>
        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{expanded ? "▲" : "▼"}</span>
      </div>

      {expanded && (
        <div style={{ padding: "16px 18px" }}>
          {/* Loading state */}
          {status === "loading" && (
            <div style={{ display: "flex", alignItems: "center", gap: 10, color: "var(--text-muted)", fontSize: 13 }}>
              <div style={{ width: 16, height: 16, border: "2px solid var(--border)", borderTopColor: "var(--accent-primary)", borderRadius: "50%", animation: "spin 0.8s linear infinite", flexShrink: 0 }} />
              Looking up Torah portion for {eventDate}…
            </div>
          )}

          {/* Error state */}
          {status === "error" && (
            <div style={{ color: "var(--red)", fontSize: 13 }}>
              ⚠ Could not load Torah portion from Hebcal. Check your connection and try refreshing.
            </div>
          )}

          {/* Loaded state */}
          {status === "loaded" && parasha && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
                {parasha.leyning?.torah && (
                  <div style={{ background: "var(--bg-subtle)", borderRadius: "var(--radius-sm)", padding: "10px 14px" }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>Torah</div>
                    <div style={{ fontSize: 13, color: "var(--text-primary)", fontWeight: 500 }}>{parasha.leyning.torah}</div>
                  </div>
                )}
                {parasha.leyning?.haftarah && (
                  <div style={{ background: "var(--bg-subtle)", borderRadius: "var(--radius-sm)", padding: "10px 14px" }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>Haftarah</div>
                    <div style={{ fontSize: 13, color: "var(--text-primary)", fontWeight: 500 }}>{parasha.leyning.haftarah}</div>
                  </div>
                )}
                {parasha.leyning?.maftir && (
                  <div style={{ background: "var(--bg-subtle)", borderRadius: "var(--radius-sm)", padding: "10px 14px" }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>Maftir</div>
                    <div style={{ fontSize: 13, color: "var(--text-primary)", fontWeight: 500 }}>{parasha.leyning.maftir}</div>
                  </div>
                )}
              </div>
              {/* Footer */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8, paddingTop: 8, borderTop: "1px solid var(--border)" }}>
                {parasha.link && (
                  <a href={parasha.link} target="_blank" rel="noopener noreferrer"
                    style={{ fontSize: 12, color: "var(--accent-primary)", textDecoration: "none", fontWeight: 600 }}>
                    Full reading on Hebcal →
                  </a>
                )}
                <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                  Torah data via <a href="https://www.hebcal.com" target="_blank" rel="noopener noreferrer" style={{ color: "var(--text-muted)" }}>Hebcal.com</a> · <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener noreferrer" style={{ color: "var(--text-muted)" }}>CC BY 4.0</a>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
