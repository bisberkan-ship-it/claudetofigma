const WebSocket = require("ws");

const ws = new WebSocket("ws://127.0.0.1:9000");
let reqId = 0;

function send(action, params = {}) {
  return new Promise((resolve, reject) => {
    const id = String(++reqId);
    const timeout = setTimeout(() => reject(new Error("Timeout")), 15000);

    ws.on("message", function handler(data) {
      const msg = JSON.parse(data.toString());
      if (msg.id === id) {
        clearTimeout(timeout);
        ws.off("message", handler);
        if (msg.error) reject(new Error(msg.error));
        else resolve(msg.result);
      }
    });

    ws.send(JSON.stringify({ id, action, params }));
  });
}

ws.on("open", async () => {
  try {
    // List library variables filtered for Base/FellowKit and level/surface
    const result = await send("list_library_variables", {
      libraryFilter: "Base",
      nameFilter: "surface",
      resolvedType: "COLOR"
    });
    console.log(JSON.stringify(result, null, 2));
  } catch (e) {
    console.error("Error:", e.message);
  }
  ws.close();
  process.exit(0);
});

ws.on("error", (e) => {
  console.error("WebSocket error:", e.message);
  process.exit(1);
});
