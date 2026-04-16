"use strict";

const fs   = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "..", "data");

// ── Ensure data directory exists ──────────────────────────────────────────────
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// ── Fresh state defaults ──────────────────────────────────────────────────────
const DEFAULTS = {
  adminPassword:    "admin",
  adminConfig:      null,
  households:       [],
  people:           [],
  expenses:         [],
  vendors:          [],
  tasks:            [],
  prep:             [],
  tables:           [],
  gifts:            [],
  favors:           [],
  seating:          { config: {} },
  dayOf:            {},
  auditLog:         [],
  ceremonyRoles:    [],
  quickNotes:       "",
  archived:         false,
  archiveUnlockCode: null,
};

// ── Allowed collection names for UPDATE_DATA ──────────────────────────────────
const ALLOWED_COLLECTIONS = [
  "households", "people", "expenses", "vendors",
  "tasks", "prep", "tables", "gifts", "favors", "seating", "dayOf", "auditLog", "ceremonyRoles",
];

// ── In-memory cache ───────────────────────────────────────────────────────────
var boardStates = {};

// ── Helpers ───────────────────────────────────────────────────────────────────
function stateFile(boardId) {
  var safe = boardId.replace(/[^a-zA-Z0-9_-]/g, "");
  return path.join(DATA_DIR, safe + ".json");
}

function loadState(boardId, log) {
  try {
    var file = stateFile(boardId);
    if (fs.existsSync(file)) {
      var saved = JSON.parse(fs.readFileSync(file, "utf8"));
      log("INFO", "[SimchaKit] Loaded state for board: " + boardId);
      return Object.assign({}, DEFAULTS, saved);
    }
    log("INFO", "[SimchaKit] No saved state for board: " + boardId + " — starting fresh");
  } catch (e) {
    log("ERROR", "[SimchaKit] Could not read state for board " + boardId + ": " + e.message);
  }
  return Object.assign({}, DEFAULTS);
}

function saveState(boardId, bs, log) {
  try {
    fs.writeFileSync(stateFile(boardId), JSON.stringify(bs, null, 2));
    log("INFO", "[SimchaKit] Saved state for board: " + boardId +
      " (archived: " + bs.archived + ")");
  } catch (e) {
    log("ERROR", "[SimchaKit] Could not save state for board " + boardId + ": " + e.message);
  }
}

function getBoardState(boardId, log) {
  if (!boardStates[boardId]) {
    boardStates[boardId] = loadState(boardId, log);
  }
  return boardStates[boardId];
}

function clearBoardState(boardId) {
  delete boardStates[boardId];
}

module.exports = { getBoardState, saveState, clearBoardState, DEFAULTS, ALLOWED_COLLECTIONS };
