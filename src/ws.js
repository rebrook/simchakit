"use strict";

const { getBoardState, saveState, ALLOWED_COLLECTIONS } = require("./state");

// ── SimchaKit FULL_STATE payload ──────────────────────────────────────────────
// Never includes adminPassword or archiveUnlockCode
function statePayload(boardId, bs) {
  return JSON.stringify({
    type:        "FULL_STATE",
    boardId:     boardId,
    adminConfig: bs.adminConfig || {},
    households:  bs.households  || [],
    people:      bs.people      || [],
    expenses:    bs.expenses    || [],
    vendors:     bs.vendors     || [],
    tasks:       bs.tasks       || [],
    prep:        bs.prep        || [],
    tables:      bs.tables      || [],
    gifts:       bs.gifts       || [],
    favors:      bs.favors      || [],
    seating:     bs.seating     || { config: {} },
    dayOf:       bs.dayOf       || {},
    auditLog:    bs.auditLog    || [],
    ceremonyRoles: bs.ceremonyRoles || [],
    quickNotes:  bs.quickNotes  || "",
    archived:    bs.archived    || false,
  });
}

// ── WebSocket message handler ─────────────────────────────────────────────────
function handleMessage(ws, msg, context) {
  var log          = context.log;
  var clientBoards = context.clientBoards;
  var broadcastToAll = context.broadcastToAll;

  if (msg.type === "SUBSCRIBE") {
    var boardId = msg.boardId;
    if (!boardId) { log("WARN", "[SimchaKit] SUBSCRIBE received with no boardId — ignoring"); return; }
    clientBoards.set(ws, boardId);
    var bs = getBoardState(boardId, log);
    log("INFO", "[SimchaKit] Client subscribed to board: " + boardId);
    ws.send(statePayload(boardId, bs));
  }

  if (msg.type === "UPDATE_DATA") {
    var boardId = clientBoards.get(ws);
    if (!boardId) { log("WARN", "[SimchaKit] UPDATE_DATA received from unsubscribed client — ignoring"); return; }
    if (!msg.collection || !ALLOWED_COLLECTIONS.includes(msg.collection)) {
      log("WARN", "[SimchaKit] UPDATE_DATA received with invalid collection: " + msg.collection + " — ignoring");
      return;
    }
    var bs = getBoardState(boardId, log);
    if (bs.archived) { log("WARN", "[SimchaKit] UPDATE_DATA rejected — board " + boardId + " is archived"); return; }
    bs[msg.collection] = msg.data;
    saveState(boardId, bs, log);
    var count = broadcastToAll(boardId, statePayload(boardId, bs));
    log("INFO", "[SimchaKit] UPDATE_DATA for board: " + boardId +
      " collection: " + msg.collection +
      " — broadcasted to " + count + " client(s)");
  }

  if (msg.type === "UPDATE_NOTES") {
    var boardId = clientBoards.get(ws);
    if (!boardId) { log("WARN", "[SimchaKit] UPDATE_NOTES received from unsubscribed client — ignoring"); return; }
    var bs = getBoardState(boardId, log);
    if (bs.archived) { log("WARN", "[SimchaKit] UPDATE_NOTES rejected — board " + boardId + " is archived"); return; }
    bs.quickNotes = msg.notes || "";
    saveState(boardId, bs, log);
    var count = broadcastToAll(boardId, statePayload(boardId, bs));
    log("INFO", "[SimchaKit] UPDATE_NOTES for board: " + boardId +
      " — broadcasted to " + count + " client(s)");
  }
}

module.exports = { handleMessage, statePayload };
