// Standalone WebSocket bridge server — keeps running independently
const { WebSocketServer } = require("ws");

const WS_PORT = 9000;
const wss = new WebSocketServer({ host: "0.0.0.0", port: WS_PORT });

console.log(`[WS Bridge] Listening on port ${WS_PORT}`);

wss.on("connection", (ws) => {
  console.log("[WS Bridge] Figma plugin connected");
  ws.on("message", (data) => {
    console.log("[WS Bridge] ← " + data.toString().substring(0, 200));
  });
  ws.on("close", () => {
    console.log("[WS Bridge] Figma plugin disconnected");
  });
});

// Keep process alive
setInterval(() => {}, 60000);
