'use client';

// ACARS Bridge — connects to the local ACARS desktop app WebSocket
// and pushes session credentials automatically when available.
// Runs silently in the background — no user interaction needed.

const ACARS_WS_URL = 'ws://127.0.0.1:7437';
const RECONNECT_DELAY_MS = 10000;

let ws: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let currentCredentials: AcarsCredentials | null = null;
let isStarted = false;

export interface AcarsCredentials {
  token: string;
  refresh_token?: string;
  airline_id: string;
  display_name: string;
  api_url: string;
}

function connect(creds: AcarsCredentials) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    sendCredentials(creds);
    return;
  }

  try {
    ws = new WebSocket(ACARS_WS_URL);

    ws.onopen = () => {
      console.log('[ACARS Bridge] Connected to ACARS desktop app');
      if (currentCredentials) sendCredentials(currentCredentials);
    };

    ws.onmessage = (evt) => {
      try {
        const msg = JSON.parse(evt.data) as { type: string };
        if (msg.type === 'connected') {
          // ACARS confirmed connection — send credentials immediately
          if (currentCredentials) sendCredentials(currentCredentials);
        }
      } catch { /* ignore */ }
    };

    ws.onclose = () => {
      ws = null;
      // Only reconnect if ACARS bridge is still active and user is logged in
      if (isStarted && currentCredentials) {
        reconnectTimer = setTimeout(() => connect(currentCredentials!), RECONNECT_DELAY_MS);
      }
    };

    ws.onerror = () => {
      // ACARS not running — silent fail, will retry on next reconnect cycle
      ws = null;
    };
  } catch { /* WebSocket not available (SSR) */ }
}

function sendCredentials(creds: AcarsCredentials) {
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  ws.send(JSON.stringify({
    type: 'set_credentials',
    token: creds.token,
    refresh_token: creds.refresh_token,
    airline_id: creds.airline_id,
    display_name: creds.display_name,
    api_url: creds.api_url,
  }));
}

export function startAcarsBridge(creds: AcarsCredentials) {
  if (typeof window === 'undefined') return; // SSR guard
  currentCredentials = creds;
  isStarted = true;
  if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
  connect(creds);
}

export function stopAcarsBridge() {
  isStarted = false;
  currentCredentials = null;
  if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
  ws?.close();
  ws = null;
}

export function sendFlightId(flightId: string) {
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  ws.send(JSON.stringify({ type: 'set_flight_id', flight_id: flightId }));
}

export function isAcarsConnected(): boolean {
  return ws !== null && ws.readyState === WebSocket.OPEN;
}
