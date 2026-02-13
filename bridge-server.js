const http = require('http');
const { WebSocketServer } = require('ws');

const WS_PORT = 9000;
const HTTP_PORT = 9001;
let figmaSocket = null;
let reqId = 0;

// --- WebSocket Server (Figma plugin connects here) ---
const wss = new WebSocketServer({ host: '0.0.0.0', port: WS_PORT });

wss.on('connection', (ws) => {
  console.log('[WS] Figma plugin connected');
  figmaSocket = ws;

  ws.on('close', () => {
    console.log('[WS] Figma plugin disconnected');
    if (figmaSocket === ws) figmaSocket = null;
  });

  ws.on('error', (err) => {
    console.log('[WS] Error:', err.message);
  });
});

console.log(`[WS] Listening on port ${WS_PORT}`);

// --- Send command to Figma and wait for response ---
function sendToFigma(action, params) {
  return new Promise((resolve, reject) => {
    if (!figmaSocket || figmaSocket.readyState !== 1) {
      reject(new Error('Figma plugin is not connected'));
      return;
    }
    const id = String(++reqId);
    const timeout = setTimeout(() => {
      figmaSocket.removeListener('message', handler);
      reject(new Error('Timeout (10s)'));
    }, 10000);

    function handler(data) {
      try {
        const msg = JSON.parse(data.toString());
        if (msg.id === id) {
          figmaSocket.removeListener('message', handler);
          clearTimeout(timeout);
          if (msg.error) reject(new Error(msg.error));
          else resolve(msg.result);
        }
      } catch(e) {}
    }
    figmaSocket.on('message', handler);
    figmaSocket.send(JSON.stringify({ id, action, params }));
  });
}

// --- HTTP Server (commands come here) ---
const httpServer = http.createServer(async (req, res) => {
  // GET /status
  if (req.method === 'GET' && req.url === '/status') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ connected: figmaSocket !== null }));
    return;
  }

  // POST /run  { "action": "...", "params": {...} }
  if (req.method === 'POST' && req.url === '/run') {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', async () => {
      try {
        const { action, params } = JSON.parse(body);
        console.log(`[HTTP] -> ${action}`);
        const result = await sendToFigma(action, params || {});
        console.log(`[HTTP] <- OK`);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, result }));
      } catch(e) {
        console.log(`[HTTP] <- ERROR: ${e.message}`);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: e.message }));
      }
    });
    return;
  }

  res.writeHead(404);
  res.end('Not found');
});

httpServer.listen(HTTP_PORT, () => {
  console.log(`[HTTP] Listening on port ${HTTP_PORT}`);
  console.log('');
  console.log('Ready! Figma plugin will auto-connect to ws://localhost:9000');
  console.log('Send commands via: curl -X POST http://localhost:9001/run -d \'{"action":"...","params":{...}}\'');
  console.log('Check status via: curl http://localhost:9001/status');
});
