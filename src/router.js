"use strict";

const express = require("express");
const fs      = require("fs");
const path    = require("path");
const router  = express.Router();

const { getBoardState, saveState } = require("./state");
const { statePayload } = require("./ws");

var _log       = function() {};
var _broadcast = function() {};

router.setLog       = function(logFn) { _log = logFn; };
router.setBroadcast = function(fn)    { _broadcast = fn; };

function log(level, msg) { _log(level, msg); }

// ── Event Picker: list all events ────────────────────────────────────────────
router.get("/api/events", (req, res) => {
  var { DEFAULTS } = require("./state");
  try {
    var dataDir = path.join(__dirname, "..", "data");
    if (!fs.existsSync(dataDir)) return res.json({ events: [] });
    var files = fs.readdirSync(dataDir).filter(f => f.endsWith(".json"));
    var events = [];
    files.forEach(function(file) {
      try {
        var boardId = file.replace(/\.json$/, "");
        var raw     = JSON.parse(fs.readFileSync(path.join(dataDir, file), "utf8"));
        var cfg     = raw.adminConfig || {};
        // Derive main event date from timeline
        var mainEvent = (cfg.timeline || []).find(function(e) { return e.isMainEvent; }) || null;
        events.push({
          boardId:        boardId,
          name:           cfg.name           || "",
          type:           cfg.type           || "other",
          archived:       raw.archived       || false,
          palette:        (cfg.theme && cfg.theme.palette) || "rose",
          themeName:      (cfg.theme && cfg.theme.name)    || "",
          themeIcon:      (cfg.theme && cfg.theme.icon)    || "",
          eventDate:      mainEvent ? mainEvent.startDate  : "",
          eventTitle:     mainEvent ? mainEvent.title      : "",
          householdCount: (raw.households || []).length,
          peopleCount:    (raw.people     || []).length,
        });
      } catch (e) {
        log("WARN", "[SimchaKit] Could not parse event file: " + file + " — " + e.message);
      }
    });
    // Sort: active events first by date, archived last
    events.sort(function(a, b) {
      if (a.archived !== b.archived) return a.archived ? 1 : -1;
      if (a.eventDate && b.eventDate) return a.eventDate.localeCompare(b.eventDate);
      if (a.eventDate) return -1;
      if (b.eventDate) return 1;
      return (a.name || "").localeCompare(b.name || "");
    });
    log("INFO", "[SimchaKit] Event picker: returned " + events.length + " event(s)");
    res.json({ events: events });
  } catch (e) {
    log("ERROR", "[SimchaKit] Event picker failed: " + e.message);
    res.status(500).json({ error: "Could not load events" });
  }
});

// ── Changelog ─────────────────────────────────────────────────────────────────
router.get("/changelog", (req, res) => {
  try {
    var data = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "changelog.json"), "utf8"));
    res.json(data);
  } catch (e) {
    log("ERROR", "[SimchaKit] Could not read changelog: " + e.message);
    res.status(404).json({ error: "changelog.json not found" });
  }
});

// ── Public config (no auth required) ──────────────────────────────────────────
// Returns only non-sensitive display fields for the passcode lock screen.
// This endpoint allows the app to show event name/icon while gating all data
// behind passcode verification.
router.get("/:boardId/api/public-config", (req, res) => {
  // Prepend "simcha-" to match the boardId convention used in state files
  var boardId = "simcha-" + req.params.boardId;
  var bs      = getBoardState(boardId, log);
  var cfg     = bs.adminConfig || {};
  log("INFO", "[SimchaKit] Public config requested for board: " + boardId);
  res.json({
    requiresPasscode: !!cfg.accessPasscode,
    name:             cfg.name || "",
    type:             cfg.type || "other",
    themeIcon:        (cfg.theme && cfg.theme.icon) || "",
    palette:          (cfg.theme && cfg.theme.palette) || "rose",
  });
});

// ── Verify access passcode (for passcode-protected events) ───────────────────
// This endpoint verifies the access passcode without returning any sensitive data.
// Used by the lock screen to authenticate before initiating WebSocket connection.
router.post("/:boardId/api/verify-passcode", (req, res) => {
  // Prepend "simcha-" to match the boardId convention used in state files
  var boardId  = "simcha-" + req.params.boardId;
  var bs       = getBoardState(boardId, log);
  var cfg      = bs.adminConfig || {};
  var provided = (req.body && req.body.passcode) ? req.body.passcode : "";
  
  // If no passcode is configured, always succeed
  if (!cfg.accessPasscode) {
    log("INFO", "[SimchaKit] Passcode verify: no passcode configured for board: " + boardId);
    return res.json({ ok: true });
  }
  
  if (provided === cfg.accessPasscode) {
    log("INFO", "[SimchaKit] Passcode verified for board: " + boardId);
    res.json({ ok: true });
  } else {
    log("WARN", "[SimchaKit] Passcode verify failed for board: " + boardId);
    res.status(401).json({ ok: false, error: "Incorrect passcode" });
  }
});

// ── Admin: verify password ────────────────────────────────────────────────────
router.post("/:boardId/api/admin/verify", (req, res) => {
  var boardId  = req.params.boardId;
  var bs       = getBoardState(boardId, log);
  var provided = (req.body && req.body.password) ? req.body.password : "";
  if (provided === bs.adminPassword) {
    log("INFO", "[SimchaKit] Admin verified for board: " + boardId);
    res.json({ ok: true });
  } else {
    log("WARN", "[SimchaKit] Admin verify failed for board: " + boardId);
    res.status(401).json({ ok: false, error: "Incorrect password" });
  }
});

// ── Admin: save config ────────────────────────────────────────────────────────
router.post("/:boardId/api/admin/settings", (req, res) => {
  var boardId  = req.params.boardId;
  var bs       = getBoardState(boardId, log);
  var provided = (req.body && req.body.password) ? req.body.password : "";
  if (provided !== bs.adminPassword) {
    log("WARN", "[SimchaKit] Admin settings rejected for board: " + boardId);
    return res.status(401).json({ ok: false, error: "Incorrect password" });
  }
  var cfg = req.body.config;
  if (!cfg || typeof cfg !== "object") return res.status(400).json({ ok: false, error: "Missing config payload" });
  bs.adminConfig = cfg;
  saveState(boardId, bs, log);
  _broadcast(boardId);
  log("INFO", "[SimchaKit] Admin config saved for board: " + boardId);
  res.json({ ok: true });
});

// ── Admin: change password ────────────────────────────────────────────────────
router.post("/:boardId/api/admin/password", (req, res) => {
  var boardId = req.params.boardId;
  var bs      = getBoardState(boardId, log);
  var current = (req.body && req.body.currentPassword) ? req.body.currentPassword : "";
  var newPass = (req.body && req.body.newPassword)      ? req.body.newPassword      : "";
  if (current !== bs.adminPassword) {
    log("WARN", "[SimchaKit] Password change rejected for board: " + boardId);
    return res.status(401).json({ ok: false, error: "Current password is incorrect" });
  }
  if (!newPass || newPass.trim().length < 4) return res.status(400).json({ ok: false, error: "New password must be at least 4 characters" });
  bs.adminPassword = newPass.trim();
  saveState(boardId, bs, log);
  log("INFO", "[SimchaKit] Admin password changed for board: " + boardId);
  res.json({ ok: true });
});

// ── Admin: reset password (no auth required — confirmation phrase only) ───────
router.post("/:boardId/api/admin/reset-password", (req, res) => {
  var boardId       = req.params.boardId;
  var bs            = getBoardState(boardId, log);
  var confirmPhrase = (req.body && req.body.confirmPhrase) ? req.body.confirmPhrase.trim() : "";
  if (confirmPhrase !== "RESET PASSWORD") {
    log("WARN", "[SimchaKit] Password reset rejected — bad confirmation phrase for board: " + boardId);
    return res.status(400).json({ ok: false, error: "Incorrect confirmation phrase" });
  }
  bs.adminPassword = "admin";
  saveState(boardId, bs, log);
  log("INFO", "[SimchaKit] Admin password reset to default for board: " + boardId);
  res.json({ ok: true });
});

// ── Admin: archive ────────────────────────────────────────────────────────────
router.post("/:boardId/api/admin/archive", (req, res) => {
  var boardId    = req.params.boardId;
  var bs         = getBoardState(boardId, log);
  var provided   = (req.body && req.body.password)   ? req.body.password   : "";
  var unlockCode = (req.body && req.body.unlockCode) ? req.body.unlockCode.trim() : "";
  if (provided !== bs.adminPassword) {
    log("WARN", "[SimchaKit] Archive rejected for board: " + boardId);
    return res.status(401).json({ ok: false, error: "Incorrect password" });
  }
  if (!unlockCode || unlockCode.length < 4) return res.status(400).json({ ok: false, error: "Archive unlock code must be at least 4 characters" });
  bs.archived = true;
  bs.archiveUnlockCode = unlockCode;
  saveState(boardId, bs, log);
  _broadcast(boardId);
  log("INFO", "[SimchaKit] Board archived: " + boardId);
  res.json({ ok: true });
});

// ── Admin: unarchive ──────────────────────────────────────────────────────────
router.post("/:boardId/api/admin/unarchive", (req, res) => {
  var boardId    = req.params.boardId;
  var bs         = getBoardState(boardId, log);
  var provided   = (req.body && req.body.password)   ? req.body.password   : "";
  var unlockCode = (req.body && req.body.unlockCode) ? req.body.unlockCode.trim() : "";
  if (provided !== bs.adminPassword) {
    log("WARN", "[SimchaKit] Unarchive rejected for board: " + boardId);
    return res.status(401).json({ ok: false, error: "Incorrect password" });
  }
  if (!bs.archived) return res.status(400).json({ ok: false, error: "Board is not archived" });
  if (unlockCode !== bs.archiveUnlockCode) {
    log("WARN", "[SimchaKit] Unarchive rejected — bad unlock code for board: " + boardId);
    return res.status(401).json({ ok: false, error: "Incorrect archive unlock code" });
  }
  bs.archived = false;
  bs.archiveUnlockCode = null;
  saveState(boardId, bs, log);
  _broadcast(boardId);
  log("INFO", "[SimchaKit] Board unarchived: " + boardId);
  res.json({ ok: true });
});

// ── Admin: download backup as JSON file ───────────────────────────────────────
router.get("/:boardId/api/admin/backup", (req, res) => {
  var boardId  = req.params.boardId;
  var bs       = getBoardState(boardId, log);
  var provided = req.query.password || "";
  if (provided !== bs.adminPassword) {
    log("WARN", "[SimchaKit] Backup download rejected — bad password for board: " + boardId);
    return res.status(401).json({ ok: false, error: "Incorrect password" });
  }
  if (bs.archived) {
    log("WARN", "[SimchaKit] Backup download rejected — board is archived: " + boardId);
    return res.status(403).json({ ok: false, error: "Cannot download backup of an archived event" });
  }
  // Build payload — never include adminPassword or archiveUnlockCode
  var payload = {
    exportedAt:  new Date().toISOString(),
    eventId:     boardId,
    adminConfig: bs.adminConfig  || {},
    households:  bs.households   || [],
    people:      bs.people       || [],
    expenses:    bs.expenses     || [],
    vendors:     bs.vendors      || [],
    tasks:       bs.tasks        || [],
    prep:        bs.prep         || [],
    tables:      bs.tables       || [],
    gifts:       bs.gifts        || [],
    favors:      bs.favors       || {},
    seating:     bs.seating      || {},
    dayOf:       bs.dayOf        || {},
    auditLog:    bs.auditLog     || [],
    ceremonyRoles: bs.ceremonyRoles || [],
    quickNotes:  bs.quickNotes   || "",
  };
  var date     = new Date().toISOString().slice(0, 10);
  var filename = "simchakit-" + boardId + "-" + date + ".json";
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Content-Disposition", "attachment; filename=\"" + filename + "\"");
  log("INFO", "[SimchaKit] Backup downloaded for board: " + boardId);
  res.send(JSON.stringify(payload, null, 2));
});

// ── Admin: restore from backup ────────────────────────────────────────────────
router.post("/:boardId/api/admin/restore", (req, res) => {
  var boardId  = req.params.boardId;
  var bs       = getBoardState(boardId, log);
  var provided = (req.body && req.body.password) ? req.body.password : "";
  var backup   = (req.body && req.body.backup)   ? req.body.backup   : null;
  if (provided !== bs.adminPassword) {
    log("WARN", "[SimchaKit] Restore rejected — bad password for board: " + boardId);
    return res.status(401).json({ ok: false, error: "Incorrect password" });
  }
  if (bs.archived) {
    log("WARN", "[SimchaKit] Restore rejected — board is archived: " + boardId);
    return res.status(403).json({ ok: false, error: "Cannot restore an archived event" });
  }
  if (!backup || typeof backup !== "object") {
    return res.status(400).json({ ok: false, error: "Invalid backup payload" });
  }
  // Validate: must have at least one recognizable collection
  var KNOWN = ["households","people","expenses","vendors","tasks","prep","tables","gifts","favors","dayOf","auditLog","ceremonyRoles","seating"];
  var hasData = KNOWN.some(function(k) { return Array.isArray(backup[k]) || (backup[k] && typeof backup[k] === "object"); });
  if (!hasData) {
    return res.status(400).json({ ok: false, error: "Backup file does not appear to contain valid SimchaKit data" });
  }
  // Restore all known collections — preserve adminPassword and archiveUnlockCode
  KNOWN.forEach(function(k) {
    if (backup[k] !== undefined) bs[k] = backup[k];
  });
  if (backup.adminConfig !== undefined) bs.adminConfig = backup.adminConfig;
  if (backup.quickNotes  !== undefined) bs.quickNotes  = backup.quickNotes;
  saveState(boardId, bs, log);
  _broadcast(boardId);
  log("INFO", "[SimchaKit] Backup restored for board: " + boardId);
  res.json({ ok: true });
});

module.exports = router;
