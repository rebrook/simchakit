import { useState, useEffect, useCallback, useRef } from "react";

// WebSocket sync hook — manages connection, state, reconnect, and outbound queue
// 
// Parameters:
//   eventId - the board/event ID to subscribe to
//   enabled - when false, no WebSocket connection is opened and state remains null
//             (used to gate data fetching behind passcode verification)

function useSimchaSync(eventId, enabled = true) {
  const [state, setState]           = useState(null);
  const [syncStatus, setSyncStatus] = useState(enabled ? "connecting" : "disconnected");
  const [queueSize, setQueueSize]   = useState(0);
  const [lastSavedAt, setLastSavedAt] = useState(null);
  const wsRef          = useRef(null);
  const reconnectTimer = useRef(null);
  const messageQueue   = useRef([]);   // outbound queue for messages sent while disconnected
  const connectRef     = useRef(null); // stable ref so onclose closure always calls latest connect
  const enabledRef     = useRef(enabled); // track enabled state for reconnect logic

  // Keep enabledRef in sync
  useEffect(() => { enabledRef.current = enabled; }, [enabled]);

  const flushQueue = useCallback(() => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    while (messageQueue.current.length > 0) {
      const msg = messageQueue.current.shift();
      ws.send(JSON.stringify(msg));
    }
    setQueueSize(0);
  }, []);

  const connect = useCallback(() => {
    // Don't connect if not enabled
    if (!enabledRef.current) return;
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) return;
    
    const protocol = location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${protocol}//${location.host}`);
    wsRef.current = ws;

    ws.onopen = () => {
      setSyncStatus("connected");
      ws.send(JSON.stringify({ type: "SUBSCRIBE", boardId: eventId }));
      // Flush queued messages after SUBSCRIBE has been processed
      setTimeout(flushQueue, 150);
    };

    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === "FULL_STATE" && msg.boardId === eventId) {
          setState(msg);
        }
      } catch {}
    };

    ws.onclose = () => {
      setSyncStatus("disconnected");
      wsRef.current = null;
      // Only reconnect if still enabled
      if (enabledRef.current) {
        reconnectTimer.current = setTimeout(() => {
          if (connectRef.current) connectRef.current();
        }, 3000);
      }
    };

    ws.onerror = () => { ws.close(); };
  }, [eventId, flushQueue]);

  // Keep connectRef in sync with latest connect callback
  useEffect(() => { connectRef.current = connect; }, [connect]);

  // Connect when enabled becomes true, disconnect when false
  useEffect(() => {
    if (enabled) {
      setSyncStatus("connecting");
      connect();
    } else {
      // Disconnect and clean up
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      setSyncStatus("disconnected");
      setState(null);
    }
    return () => {
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      if (wsRef.current) wsRef.current.close();
    };
  }, [enabled, connect]);

  // Send immediately if connected, otherwise queue
  const send = useCallback((msg) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
      if (msg.type === "UPDATE_DATA" || msg.type === "UPDATE_NOTES") {
        setLastSavedAt(Date.now());
      }
    } else {
      // For UPDATE_DATA, deduplicate by collection — last write wins
      if (msg.type === "UPDATE_DATA") {
        messageQueue.current = messageQueue.current.filter(
          m => !(m.type === "UPDATE_DATA" && m.collection === msg.collection)
        );
      }
      messageQueue.current.push(msg);
      setQueueSize(messageQueue.current.length);
    }
  }, []);

  const updateNotes = useCallback((notes) => {
    send({ type: "UPDATE_NOTES", notes });
  }, [send]);

  const updateData = useCallback((collection, data) => {
    send({ type: "UPDATE_DATA", collection, data });
  }, [send]);

  return { state, syncStatus, queueSize, send, updateNotes, updateData, lastSavedAt };
}

export { useSimchaSync };
