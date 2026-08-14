// ─────────────────────────────────────────────────────────────────────────────
// SimchaKit V4.26.0 — EventLogoControl.jsx
// Optional per-event logo: display + upload/replace/remove.
// Renders nothing when there is no logo and the viewer cannot edit, so an
// event without a logo looks identical to today everywhere this is used.
// Storage: Supabase Storage bucket "event-logos", one file per event at
// "{eventId}/logo.{ext}", public-read (see 2026-08-14-event-logo-storage.sql).
// logoUrl itself is saved into events.admin_config, same column every other
// admin setting already lives in.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useRef, useEffect } from "react";
import { supabase } from "@/lib/supabase.js";
import { Icon } from "@/utils/iconMap.jsx";

const MAX_BYTES = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = {
  "image/png":     "png",
  "image/jpeg":    "jpg",
  "image/webp":    "webp",
  "image/gif":     "gif",
  "image/svg+xml": "svg",
};

export function EventLogoControl({ eventId, adminConfig, collaboratorRole, isArchived, onLogoSaved }) {
  const canEdit = (collaboratorRole === "owner" || collaboratorRole === "editor") && !isArchived;
  const logoUrl = adminConfig?.logoUrl || null;

  const [showPanel,  setShowPanel]  = useState(false);
  const [preview,    setPreview]    = useState(null);
  const [pendingFile, setPendingFile] = useState(null);
  const [uploading,  setUploading]  = useState(false);
  const [error,      setError]      = useState("");
  const fileInputRef = useRef(null);

  // Revoke the object URL used for local preview when it's replaced or unmounted
  useEffect(() => {
    return () => { if (preview) URL.revokeObjectURL(preview); };
  }, [preview]);

  // Nothing to show and nobody who can add one -- render nothing at all.
  if (!logoUrl && !canEdit) return null;

  function resetPanel() {
    setShowPanel(false);
    setError("");
    setPendingFile(null);
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleFileChosen(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError("");
    if (!ALLOWED_TYPES[file.type]) {
      setError("Please choose a PNG, JPG, WEBP, GIF, or SVG image.");
      return;
    }
    if (file.size > MAX_BYTES) {
      setError("Image must be smaller than 5MB.");
      return;
    }
    if (preview) URL.revokeObjectURL(preview);
    setPendingFile(file);
    setPreview(URL.createObjectURL(file));
  }

  async function clearExistingFiles() {
    const { data: existing } = await supabase.storage.from("event-logos").list(eventId);
    if (existing && existing.length > 0) {
      await supabase.storage.from("event-logos").remove(existing.map(f => `${eventId}/${f.name}`));
    }
  }

  async function saveLogoUrl(newUrl) {
    const { error: saveErr } = await supabase
      .from("events")
      .update({
        admin_config: { ...(adminConfig || {}), logoUrl: newUrl },
        updated_at:   new Date().toISOString(),
      })
      .eq("id", eventId);
    if (saveErr) throw saveErr;
  }

  async function handleSave() {
    if (!pendingFile) return;
    setUploading(true);
    setError("");
    try {
      // Clear any prior logo first so replacing with a different image type
      // (e.g. png -> jpg) doesn't leave an orphaned file behind.
      await clearExistingFiles();
      const ext  = ALLOWED_TYPES[pendingFile.type];
      const path = `${eventId}/logo.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("event-logos")
        .upload(path, pendingFile, { upsert: true, contentType: pendingFile.type });
      if (upErr) throw upErr;

      const { data: pub } = supabase.storage.from("event-logos").getPublicUrl(path);
      const newUrl = `${pub.publicUrl}?v=${Date.now()}`;
      await saveLogoUrl(newUrl);
      onLogoSaved(newUrl);
      resetPanel();
    } catch (e) {
      setError(e.message || "Could not upload logo. Check your connection.");
      setUploading(false);
      return;
    }
    setUploading(false);
  }

  async function handleRemove() {
    setUploading(true);
    setError("");
    try {
      await clearExistingFiles();
      await saveLogoUrl(null);
      onLogoSaved(null);
      resetPanel();
    } catch (e) {
      setError(e.message || "Could not remove logo.");
      setUploading(false);
      return;
    }
    setUploading(false);
  }

  return (
    <div className="sidebar-event-logo-wrap">
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {logoUrl && (
          <img src={logoUrl} alt="Event logo" className="sidebar-event-logo-img" />
        )}
        {canEdit && (
          <button
            type="button"
            className="sidebar-event-logo-btn"
            onClick={() => setShowPanel(s => !s)}
          >
            {logoUrl ? <><Icon name="pencil" context="inline" /> Change logo</> : "+ Add event logo"}
          </button>
        )}
      </div>

      {showPanel && canEdit && (
        <div className="sidebar-event-logo-panel">
          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)", marginBottom: 6 }}>
            Event logo
          </div>
          <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 10, lineHeight: 1.5 }}>
            A square or near-square image works best. PNG, JPG, WEBP, GIF, or SVG, up to 5MB.
          </div>

          {preview && (
            <img src={preview} alt="Logo preview" style={{ width: 56, height: 56, borderRadius: 10, objectFit: "cover", border: "1px solid var(--border)", marginBottom: 10, display: "block" }} />
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
            onChange={handleFileChosen}
            style={{ fontSize: 12, marginBottom: 10, display: "block", width: "100%" }}
          />

          {error && (
            <div style={{ fontSize: 11, color: "var(--red)", marginBottom: 10 }}>{error}</div>
          )}

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              className="btn btn-primary"
              style={{ fontSize: 12, padding: "6px 12px" }}
              onClick={handleSave}
              disabled={!pendingFile || uploading}
            >
              {uploading ? "Saving…" : "Save"}
            </button>
            {logoUrl && (
              <button
                className="btn btn-ghost"
                style={{ fontSize: 12, padding: "6px 12px", color: "var(--red)" }}
                onClick={handleRemove}
                disabled={uploading}
              >
                Remove logo
              </button>
            )}
            <button
              className="btn btn-ghost"
              style={{ fontSize: 12, padding: "6px 12px" }}
              onClick={resetPanel}
              disabled={uploading}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
