const { WebSocketServer } = require("ws");

const PORT = 9001;
let pluginWs = null;
let reqId = 0;
const pending = new Map();

const wss = new WebSocketServer({ host: "0.0.0.0", port: PORT });
console.log(`[WS] Listening on port ${PORT} — waiting for Figma plugin...`);

function send(action, params = {}) {
  return new Promise((resolve, reject) => {
    if (!pluginWs) {
      reject(new Error("Plugin not connected"));
      return;
    }
    const id = String(++reqId);
    const timeout = setTimeout(() => {
      pending.delete(id);
      reject(new Error("Timeout"));
    }, 30000);

    pending.set(id, {
      resolve: (v) => { clearTimeout(timeout); resolve(v); },
      reject: (e) => { clearTimeout(timeout); reject(e); },
    });

    pluginWs.send(JSON.stringify({ id, action, params }));
  });
}

wss.on("connection", async (ws) => {
  console.log("[WS] Plugin connected!");
  pluginWs = ws;

  ws.on("message", (data) => {
    const msg = JSON.parse(data.toString());
    const p = pending.get(msg.id);
    if (p) {
      pending.delete(msg.id);
      if (msg.error) p.reject(new Error(msg.error));
      else p.resolve(msg.result);
    }
  });

  ws.on("close", () => {
    console.log("[WS] Plugin disconnected");
    pluginWs = null;
  });

  // Wait a moment for the connection to stabilize
  await new Promise(r => setTimeout(r, 1000));

  try {
    // Step 1: List library variables to find level/surface
    console.log("\n[1] Listing library variables (filtering for 'surface')...");
    const result = await send("list_library_variables", {
      nameFilter: "surface",
      resolvedType: "COLOR"
    });
    console.log(JSON.stringify(result, null, 2));

    // Find the level/surface variable key
    let surfaceKey = null;
    if (result && result.collections) {
      for (const col of result.collections) {
        for (const v of col.variables || []) {
          if (v.name.includes("level") && v.name.includes("surface")) {
            surfaceKey = v.key;
            console.log(`\n[2] Found variable: "${v.name}" key="${v.key}" in "${col.libraryName}/${col.name}"`);
            break;
          }
        }
        if (surfaceKey) break;
      }
    }

    if (!surfaceKey) {
      // Try without filter to see all collections
      console.log("\n[!] 'level/surface' not found with filter. Listing ALL library variable collections...");
      const allResult = await send("list_library_variables", {});
      console.log(JSON.stringify(allResult, null, 2));

      // Search in all results
      if (allResult && allResult.collections) {
        for (const col of allResult.collections) {
          console.log(`  Collection: "${col.name}" from "${col.libraryName}" (${(col.variables || []).length} vars)`);
          for (const v of col.variables || []) {
            if (v.name.toLowerCase().includes("surface")) {
              surfaceKey = v.key;
              console.log(`  -> Found: "${v.name}" key="${v.key}"`);
            }
          }
        }
      }
    }

    if (surfaceKey) {
      // Step 3: Bind to Register frame (3:4561)
      console.log(`\n[3] Binding variable key="${surfaceKey}" to Register frame (3:4561)...`);
      const bindResult = await send("bind_variable", {
        nodeId: "3:4561",
        variableKey: surfaceKey,
        field: "fills"
      });
      console.log("Bind result:", JSON.stringify(bindResult, null, 2));
      console.log("\n✅ Done! Variable bound successfully.");
    } else {
      console.log("\n❌ Could not find 'level/surface' variable. Check the output above.");
    }

  } catch (e) {
    console.error("Error:", e.message);
  }

  // Keep server running so user can see results
  setTimeout(() => {
    console.log("\nClosing in 5s...");
    setTimeout(() => process.exit(0), 5000);
  }, 3000);
});
