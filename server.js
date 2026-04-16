"use strict";

const express   = require("express");
const http      = require("http");
const WebSocket = require("ws");
const path      = require("path");
const os        = require("os");

// ── App modules ───────────────────────────────────────────────────────────────
const simchaKitRouter = require("./src/router");
const simchaKitWS     = require("./src/ws");
const simchaKitState  = require("./src/state");

// ── Resolve local IP for startup logging ──────────────────────────────────────
function getLocalIP() {
  var interfaces = os.networkInterfaces();
  for (var name of Object.keys(interfaces)) {
    for (var iface of interfaces[name]) {
      if (iface.family === "IPv4" && !iface.internal) return iface.address;
    }
  }
  return "localhost";
}

const PORT = process.env.PORT || 3000;

// ── In-memory log buffer ──────────────────────────────────────────────────────
const LOG_MAX = 500;
var logBuffer = [];
var serverStartTime = Date.now();

function log(level, message) {
  var entry = { ts: new Date().toISOString(), level: level, message: message };
  logBuffer.push(entry);
  if (logBuffer.length > LOG_MAX) logBuffer.shift();
  var prefix = "[" + entry.ts + "] [" + level + "] ";
  if (level === "ERROR") console.error(prefix + message);
  else console.log(prefix + message);
}

// ── Express app ───────────────────────────────────────────────────────────────
const app    = express();
const server = http.createServer(app);

app.use(express.json());

// Redirect bare root to SimchaKit
app.get("/", (req, res) => {
  res.redirect("/simcha/");
});

// ── Mount SimchaKit ───────────────────────────────────────────────────────────
simchaKitRouter.setLog(log);
app.use("/simcha", express.static(path.join(__dirname, "public")));
app.use("/simcha", simchaKitRouter);

// ── Log viewer ────────────────────────────────────────────────────────────────
app.get("/api/logs", (req, res) => {
  res.json({
    uptime:  Math.floor((Date.now() - serverStartTime) / 1000),
    count:   logBuffer.length,
    max:     LOG_MAX,
    entries: logBuffer.slice().reverse(),
  });
});

app.get("/logs", (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>SimchaKit Server — Logs</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #f8fafc; color: #111827; }
    header { background: linear-gradient(135deg, #831843 0%, #be185d 100%); padding: 16px 24px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px; }
    header h1 { font-size: 18px; font-weight: 800; color: #fff; }
    header .meta { font-size: 12px; color: rgba(255,255,255,0.7); margin-top: 2px; }
    .toolbar { background: #fff; border-bottom: 1px solid #e5e7eb; padding: 10px 24px; display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
    button { padding: 6px 14px; border-radius: 6px; font-size: 12px; font-weight: 700; cursor: pointer; border: 1px solid #d1d5db; background: #fff; color: #374151; }
    button:hover { background: #f3f4f6; }
    button.primary { background: #be185d; color: #fff; border-color: #be185d; }
    button.primary:hover { background: #9d174d; }
    .status { font-size: 12px; color: #6b7280; margin-left: auto; }
    .status .dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: #16a34a; margin-right: 5px; animation: pulse 2s infinite; }
    .status .dot.paused { background: #f59e0b; animation: none; }
    @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }
    .stats { display: flex; gap: 12px; padding: 12px 24px; background: #fff; border-bottom: 1px solid #e5e7eb; flex-wrap: wrap; }
    .stat { background: #f8fafc; border: 1px solid #e5e7eb; border-radius: 8px; padding: 8px 16px; text-align: center; min-width: 100px; }
    .stat .val { font-size: 20px; font-weight: 800; color: #111827; }
    .stat .lbl { font-size: 10px; font-weight: 600; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.06em; margin-top: 2px; }
    .filters { padding: 10px 24px; background: #fff; border-bottom: 1px solid #e5e7eb; display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
    .filters label { font-size: 12px; font-weight: 600; color: #6b7280; }
    .filters select, .filters input { padding: 5px 10px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 12px; background: #fff; }
    .filters input { width: 220px; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    th { background: #f3f4f6; padding: 8px 12px; text-align: left; font-size: 11px; font-weight: 700; color: #6b7280; text-transform: uppercase; letter-spacing: 0.06em; position: sticky; top: 0; z-index: 1; border-bottom: 1px solid #e5e7eb; }
    td { padding: 7px 12px; border-bottom: 1px solid #f3f4f6; vertical-align: top; }
    tr:hover td { background: #f9fafb; }
    .ts { color: #9ca3af; white-space: nowrap; font-family: monospace; font-size: 11px; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 20px; font-size: 10px; font-weight: 800; white-space: nowrap; }
    .badge.INFO  { background: #dbeafe; color: #1e40af; }
    .badge.WARN  { background: #fef3c7; color: #92400e; }
    .badge.ERROR { background: #fee2e2; color: #dc2626; }
    .msg { color: #111827; line-height: 1.5; word-break: break-word; }
    .msg.ERROR { color: #dc2626; font-weight: 600; }
    .empty { text-align: center; padding: 48px; color: #9ca3af; font-size: 14px; }
    .wrap { padding: 0 24px 24px; overflow-x: auto; }
    .toast { position: fixed; bottom: 20px; right: 20px; background: #111827; color: #fff; padding: 10px 18px; border-radius: 8px; font-size: 13px; font-weight: 600; opacity: 0; transition: opacity 0.3s; pointer-events: none; z-index: 999; }
    .toast.show { opacity: 1; }
  </style>
</head>
<body>
  <header>
    <div>
      <h1>SimchaKit Server — Logs</h1>
      <div class="meta" id="server-meta">Loading...</div>
    </div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;">
      <button onclick="copyLog()" style="background:rgba(255,255,255,0.15);color:#fff;border-color:rgba(255,255,255,0.3);">📋 Copy Log</button>
      <button onclick="downloadLog()" style="background:rgba(255,255,255,0.15);color:#fff;border-color:rgba(255,255,255,0.3);">⬇ Download Log</button>
    </div>
  </header>
  <div class="toolbar">
    <button class="primary" onclick="fetchLogs()">↺ Refresh</button>
    <button id="pause-btn" onclick="togglePause()">⏸ Pause Auto-Refresh</button>
    <span class="status"><span class="dot" id="status-dot"></span><span id="status-text">Auto-refreshing every 5s</span></span>
  </div>
  <div class="stats">
    <div class="stat"><div class="val" id="stat-uptime">—</div><div class="lbl">Uptime</div></div>
    <div class="stat"><div class="val" id="stat-total">—</div><div class="lbl">Total Entries</div></div>
    <div class="stat"><div class="val" id="stat-info" style="color:#1e40af">—</div><div class="lbl">Info</div></div>
    <div class="stat"><div class="val" id="stat-warn" style="color:#92400e">—</div><div class="lbl">Warn</div></div>
    <div class="stat"><div class="val" id="stat-error" style="color:#dc2626">—</div><div class="lbl">Errors</div></div>
    <div class="stat"><div class="val" id="stat-buf">—</div><div class="lbl">Buffer</div></div>
  </div>
  <div class="filters">
    <label>Level:</label>
    <select id="filter-level" onchange="renderTable()">
      <option value="ALL">All Levels</option>
      <option value="INFO">INFO only</option>
      <option value="WARN">WARN only</option>
      <option value="ERROR">ERROR only</option>
      <option value="WARN_ERROR">WARN + ERROR</option>
    </select>
    <label>Search:</label>
    <input type="text" id="filter-search" placeholder="Filter by message..." oninput="renderTable()" />
    <button onclick="clearFilters()">Clear Filters</button>
  </div>
  <div class="wrap">
    <table>
      <thead><tr><th style="width:170px">Timestamp</th><th style="width:70px">Level</th><th>Message</th></tr></thead>
      <tbody id="log-body"></tbody>
    </table>
    <div id="empty-msg" class="empty" style="display:none">No log entries match your filters.</div>
  </div>
  <div class="toast" id="toast"></div>
  <script>
    var allEntries = [], paused = false, timer = null;
    function formatUptime(s) {
      var d=Math.floor(s/86400),h=Math.floor((s%86400)/3600),m=Math.floor((s%3600)/60),sec=s%60;
      if(d>0) return d+"d "+h+"h "+m+"m";
      if(h>0) return h+"h "+m+"m "+sec+"s";
      if(m>0) return m+"m "+sec+"s";
      return sec+"s";
    }
    function formatTs(iso) { var d=new Date(iso); return d.toLocaleDateString()+" "+d.toLocaleTimeString(); }
    function fetchLogs() {
      fetch("/api/logs").then(r=>r.json()).then(data=>{
        allEntries=data.entries||[];
        document.getElementById("stat-uptime").textContent=formatUptime(data.uptime);
        document.getElementById("stat-total").textContent=data.count;
        document.getElementById("stat-buf").textContent=data.count+"/"+data.max;
        document.getElementById("stat-info").textContent=allEntries.filter(e=>e.level==="INFO").length;
        document.getElementById("stat-warn").textContent=allEntries.filter(e=>e.level==="WARN").length;
        document.getElementById("stat-error").textContent=allEntries.filter(e=>e.level==="ERROR").length;
        document.getElementById("server-meta").textContent="Uptime: "+formatUptime(data.uptime)+"  ·  Buffer: "+data.count+"/"+data.max+" entries";
        renderTable();
      }).catch(()=>{ document.getElementById("server-meta").textContent="⚠️ Could not reach server"; });
    }
    function renderTable() {
      var level=document.getElementById("filter-level").value;
      var search=document.getElementById("filter-search").value.toLowerCase();
      var filtered=allEntries.filter(e=>{
        if(level==="WARN_ERROR"&&e.level!=="WARN"&&e.level!=="ERROR") return false;
        if(level!=="ALL"&&level!=="WARN_ERROR"&&e.level!==level) return false;
        if(search&&e.message.toLowerCase().indexOf(search)===-1) return false;
        return true;
      });
      var tbody=document.getElementById("log-body");
      var empty=document.getElementById("empty-msg");
      if(!filtered.length){tbody.innerHTML="";empty.style.display="block";return;}
      empty.style.display="none";
      tbody.innerHTML=filtered.map(e=>"<tr><td class='ts'>"+formatTs(e.ts)+"</td><td><span class='badge "+e.level+"'>"+e.level+"</span></td><td class='msg "+(e.level==="ERROR"?"ERROR":"")+"'>"+escHtml(e.message)+"</td></tr>").join("");
    }
    function escHtml(s){return s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");}
    function togglePause(){
      paused=!paused;
      document.getElementById("pause-btn").textContent=paused?"▶ Resume Auto-Refresh":"⏸ Pause Auto-Refresh";
      document.getElementById("status-dot").className="dot"+(paused?" paused":"");
      document.getElementById("status-text").textContent=paused?"Paused":"Auto-refreshing every 5s";
      if(!paused){fetchLogs();startTimer();}else{clearInterval(timer);}
    }
    function clearFilters(){document.getElementById("filter-level").value="ALL";document.getElementById("filter-search").value="";renderTable();}
    function buildPlainText(){return allEntries.map(e=>"["+e.ts+"] ["+e.level+"] "+e.message).join("\\n");}
    function copyLog(){navigator.clipboard.writeText(buildPlainText()).then(()=>showToast("✅ Log copied to clipboard")).catch(()=>showToast("⚠️ Copy failed"));}
    function downloadLog(){
      var a=document.createElement("a");
      a.href="data:text/plain;charset=utf-8,"+encodeURIComponent(buildPlainText());
      a.download="server-log-"+new Date().toISOString().slice(0,10)+".txt";
      a.click();
      showToast("⬇ Log downloaded");
    }
    function showToast(msg){var t=document.getElementById("toast");t.textContent=msg;t.classList.add("show");setTimeout(()=>t.classList.remove("show"),2500);}
    function startTimer(){timer=setInterval(fetchLogs,5000);}
    fetchLogs();startTimer();
  </script>
</body>
</html>`);
});

// ── WebSocket server ──────────────────────────────────────────────────────────
const wss = new WebSocket.Server({ server });
const clientBoards = new Map();

// Broadcast to all clients on a board except sender
function broadcastToBoard(boardId, payload, senderSocket) {
  var msg = typeof payload === "string" ? payload : JSON.stringify(payload);
  var count = 0;
  wss.clients.forEach(function(client) {
    if (client !== senderSocket && client.readyState === WebSocket.OPEN && clientBoards.get(client) === boardId) {
      client.send(msg);
      count++;
    }
  });
  return count;
}

// Broadcast to ALL clients on a board including sender
function broadcastToAll(boardId, payload) {
  var msg = typeof payload === "string" ? payload : JSON.stringify(payload);
  var count = 0;
  wss.clients.forEach(function(client) {
    if (client.readyState === WebSocket.OPEN && clientBoards.get(client) === boardId) {
      client.send(msg);
      count++;
    }
  });
  return count;
}

// Shared context passed to WebSocket handler
var wsContext = {
  log:             log,
  wss:             wss,
  clientBoards:    clientBoards,
  broadcastToBoard: broadcastToBoard,
  broadcastToAll:   broadcastToAll,
};

// Inject broadcast into router (for REST endpoints that need to push state)
simchaKitRouter.setBroadcast(function(boardId) {
  var bs      = simchaKitState.getBoardState(boardId, log);
  var payload = simchaKitWS.statePayload(boardId, bs);
  broadcastToAll(boardId, payload);
});

wss.on("connection", function(ws) {
  log("INFO", "Client connected — total connections: " + wss.clients.size);

  ws.on("message", function(raw) {
    var msg;
    try { msg = JSON.parse(raw); } catch(e) {
      log("WARN", "Received malformed WebSocket message — ignoring");
      return;
    }

    var boardId = msg.boardId || clientBoards.get(ws) || "";
    
    // Only handle simcha- prefixed boards
    if (!boardId.startsWith("simcha-")) {
      log("WARN", "Invalid boardId prefix: " + boardId + " — ignoring");
      return;
    }

    simchaKitWS.handleMessage(ws, msg, wsContext);
  });

  ws.on("close", function() {
    var boardId = clientBoards.get(ws) || "unknown";
    clientBoards.delete(ws);
    log("INFO", "Client disconnected from board: " + boardId + " — total connections: " + wss.clients.size);
  });

  ws.on("error", function(err) {
    log("ERROR", "WebSocket error: " + err.message);
  });
});

// ── Start server ──────────────────────────────────────────────────────────────
server.listen(PORT, function() {
  var localIP = getLocalIP();
  log("INFO", "═══════════════════════════════════════════════════");
  log("INFO", "SimchaKit server started on port " + PORT);
  log("INFO", "App:        http://" + localIP + ":" + PORT + "/simcha/");
  log("INFO", "Log viewer: http://" + localIP + ":" + PORT + "/logs");
  log("INFO", "Log buffer: " + LOG_MAX + " entries max");
  log("INFO", "═══════════════════════════════════════════════════");
});
