"use strict";

const express  = require("express");
const fs       = require("fs");
const path     = require("path");
const bcrypt   = require("bcryptjs");
const router   = express.Router();

const { getBoardState, saveState, clearBoardState } = require("./state");
const { statePayload } = require("./ws");

var _log       = function() {};
var _broadcast = function() {};

// ── Picker config helpers ─────────────────────────────────────────────────────
var PICKER_CONFIG_FILE = path.join(__dirname, "..", "picker-config.json");

function loadPickerConfig() {
  try {
    if (fs.existsSync(PICKER_CONFIG_FILE)) {
      return JSON.parse(fs.readFileSync(PICKER_CONFIG_FILE, "utf8"));
    }
  } catch (e) { /* fall through to default */ }
  return { pickerPassword: "" };
}

function savePickerConfig(cfg) {
  fs.writeFileSync(PICKER_CONFIG_FILE, JSON.stringify(cfg, null, 2));
}

// ── Rate limiter — 5 attempts per IP per 60s ─────────────────────────────────
var pickerRateLimiter = {};
function checkRateLimit(ip) {
  var now = Date.now();
  var entry = pickerRateLimiter[ip];
  if (!entry || now - entry.windowStart > 60000) {
    pickerRateLimiter[ip] = { windowStart: now, count: 1 };
    return true;
  }
  if (entry.count >= 5) return false;
  entry.count++;
  return true;
}
function resetRateLimit(ip) {
  delete pickerRateLimiter[ip];
}

router.setLog       = function(logFn) { _log = logFn; };
router.setBroadcast = function(fn)    { _broadcast = fn; };

function log(level, msg) { _log(level, msg); }

// ── Event Picker: list all events ────────────────────────────────────────────
router.get("/api/events", (req, res) => {
  try {
    var dataDir   = path.join(__dirname, "..", "data");
    var publicDir = path.join(__dirname, "..", "public");
    var events    = [];
    var seenIds   = {};

    // 1. Read configured events from data/ directory
    if (fs.existsSync(dataDir)) {
      var files = fs.readdirSync(dataDir).filter(f => f.endsWith(".json"));
      files.forEach(function(file) {
        try {
          var boardId = file.replace(/\.json$/, "");
          var raw     = JSON.parse(fs.readFileSync(path.join(dataDir, file), "utf8"));
          var cfg     = raw.adminConfig || {};
          var mainEvent = (cfg.timeline || []).find(function(e) { return e.isMainEvent; }) || null;
          events.push({
            boardId:           boardId,
            name:              cfg.name           || "",
            type:              cfg.type           || "other",
            archived:          raw.archived       || false,
            passcodeProtected: !!(cfg.accessPasscode),
            palette:           (cfg.theme && cfg.theme.palette) || "rose",
            themeName:         (cfg.theme && cfg.theme.name)    || "",
            themeIcon:         (cfg.theme && cfg.theme.icon)    || "",
            eventDate:         mainEvent ? mainEvent.startDate  : "",
            eventTitle:        mainEvent ? mainEvent.title      : "",
            householdCount:    (raw.households || []).length,
            peopleCount:       (raw.people     || []).length,
          });
          seenIds[boardId] = true;
        } catch (e) {
          log("WARN", "[SimchaKit] Could not parse event file: " + file + " — " + e.message);
        }
      });
    }

    // 2. Scan public/ for provisioned folders with no data file yet
    if (fs.existsSync(publicDir)) {
      var folders = fs.readdirSync(publicDir).filter(function(f) {
        if (f === "assets") return false;
        var folderPath = path.join(publicDir, f);
        return fs.statSync(folderPath).isDirectory() &&
               fs.existsSync(path.join(folderPath, "index.html"));
      });
      folders.forEach(function(folder) {
        var boardId = "simcha-" + folder;
        if (!seenIds[boardId]) {
          events.push({
            boardId:        boardId,
            name:           "",
            type:           "other",
            archived:       false,
            palette:        "rose",
            themeName:      "",
            themeIcon:      "",
            eventDate:      "",
            eventTitle:     "",
            householdCount: 0,
            peopleCount:    0,
          });
        }
      });
    }

    // Sort: active events first by date, then unnamed, archived last
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

// ── Picker: status ────────────────────────────────────────────────────────────
// Returns whether the picker is password-protected. No auth required.
router.get("/api/picker/status", (req, res) => {
  var cfg = loadPickerConfig();
  res.json({ protected: !!(cfg.pickerPassword) });
});

// ── Picker: verify password ───────────────────────────────────────────────────
router.post("/api/picker/verify", (req, res) => {
  var ip = req.ip || req.connection.remoteAddress || "unknown";
  if (!checkRateLimit(ip)) {
    log("WARN", "[SimchaKit] Picker verify rate limited for IP: " + ip);
    return res.status(429).json({ ok: false, error: "Too many attempts. Please wait a minute and try again." });
  }
  var cfg = loadPickerConfig();
  var provided = (req.body && req.body.password) ? req.body.password : "";
  if (!cfg.pickerPassword) {
    // No password set — always allow
    resetRateLimit(ip);
    return res.json({ ok: true });
  }
  var match = bcrypt.compareSync(provided, cfg.pickerPassword);
  if (match) {
    resetRateLimit(ip);
    log("INFO", "[SimchaKit] Picker verified for IP: " + ip);
    return res.json({ ok: true });
  }
  log("WARN", "[SimchaKit] Picker verify failed for IP: " + ip);
  res.status(401).json({ ok: false, error: "Incorrect password" });
});

// ── Picker: set / change password ─────────────────────────────────────────────
router.post("/api/picker/password", (req, res) => {
  var cfg         = loadPickerConfig();
  var current     = (req.body && req.body.currentPassword) ? req.body.currentPassword : "";
  var newPassword = (req.body && req.body.newPassword)     ? req.body.newPassword     : "";
  // If a password is already set, verify current password first
  if (cfg.pickerPassword) {
    if (!bcrypt.compareSync(current, cfg.pickerPassword)) {
      log("WARN", "[SimchaKit] Picker password change rejected — incorrect current password");
      return res.status(401).json({ ok: false, error: "Current password is incorrect" });
    }
  }
  // Allow empty newPassword to remove protection
  if (newPassword && newPassword.trim().length < 8) {
    return res.status(400).json({ ok: false, error: "Password must be at least 8 characters" });
  }
  cfg.pickerPassword = newPassword ? bcrypt.hashSync(newPassword.trim(), 10) : "";
  savePickerConfig(cfg);
  var action = newPassword ? "set" : "removed";
  log("INFO", "[SimchaKit] Picker password " + action);
  res.json({ ok: true });
});

// ── Event Picker: create new event ───────────────────────────────────────────
router.post("/api/events", (req, res) => {
  var eventId = (req.body && req.body.eventId) ? req.body.eventId.trim() : "";
  if (!eventId) {
    return res.status(400).json({ ok: false, error: "Event ID is required." });
  }
  if (!/^[a-z0-9][a-z0-9-]{0,48}[a-z0-9]$/.test(eventId) && !/^[a-z0-9]$/.test(eventId)) {
    return res.status(400).json({ ok: false, error: "Event ID may only contain lowercase letters, numbers, and hyphens, and cannot start or end with a hyphen." });
  }
  if (eventId.length < 2 || eventId.length > 50) {
    return res.status(400).json({ ok: false, error: "Event ID must be between 2 and 50 characters." });
  }
  var publicDir  = path.join(__dirname, "..", "public");
  var eventDir   = path.join(publicDir, eventId);
  var distIndex  = path.join(__dirname, "..", "client", "dist", "index.html");
  if (fs.existsSync(eventDir)) {
    return res.status(409).json({ ok: false, error: "An event with that ID already exists." });
  }
  if (!fs.existsSync(distIndex)) {
    return res.status(500).json({ ok: false, error: "Build output not found. Run 'npm run build' inside client/ first." });
  }
  try {
    fs.mkdirSync(eventDir, { recursive: true });
    fs.copyFileSync(distIndex, path.join(eventDir, "index.html"));
    log("INFO", "[SimchaKit] Created new event folder: " + eventId);
    res.json({ ok: true, eventId: eventId, url: "/simcha/" + eventId + "/" });
  } catch (e) {
    log("ERROR", "[SimchaKit] Could not create event folder: " + eventId + " — " + e.message);
    res.status(500).json({ ok: false, error: "Could not create event folder: " + e.message });
  }
});

// ── Event Picker: delete event ────────────────────────────────────────────────
router.delete("/api/events/:eventId", (req, res) => {
  var eventId = req.params.eventId;
  if (!eventId || (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(eventId) && !/^[a-z0-9]$/.test(eventId))) {
    return res.status(400).json({ ok: false, error: "Invalid event ID." });
  }
  var publicDir = path.join(__dirname, "..", "public");
  var eventDir  = path.join(publicDir, eventId);
  var dataFile  = path.join(__dirname, "..", "data", "simcha-" + eventId + ".json");
  var boardId   = "simcha-" + eventId;
  if (!fs.existsSync(eventDir)) {
    return res.status(404).json({ ok: false, error: "Event folder not found." });
  }
  try {
    fs.rmSync(eventDir, { recursive: true, force: true });
    if (fs.existsSync(dataFile)) fs.unlinkSync(dataFile);
    clearBoardState(boardId);
    log("INFO", "[SimchaKit] Deleted event: " + eventId);
    res.json({ ok: true });
  } catch (e) {
    log("ERROR", "[SimchaKit] Could not delete event: " + eventId + " — " + e.message);
    res.status(500).json({ ok: false, error: "Could not delete event: " + e.message });
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
  if (!newPass || newPass.trim().length < 8) return res.status(400).json({ ok: false, error: "New password must be at least 8 characters" });
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

module.exports = router;
