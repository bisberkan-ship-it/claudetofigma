#!/usr/bin/env node
/**
 * Hisse Search Frames Builder
 * Creates two frames: Default (popular list) and Typed (search results)
 * Uses Hisse Local Library components
 */

const BRIDGE = "http://localhost:9001/command";

async function cmd(action, params) {
  const res = await fetch(BRIDGE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, params }),
  });
  const data = await res.json();
  if (data.error) throw new Error(`[${action}] ${data.error}`);
  return data.result;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// ── Component keys from Hisse Local Library (DBmpxv9QiETKI5IcUcm4Ai) ──
const KEYS = {
  header:  "0cca7dfdac76c37d2d2742c8396a3024800fd6b1", // Page=Main, Type=Search  (h=88)
  tags:    "8e303bbdbf640b5de9d044bbe79118ccfb0dedae", // Search [Tags]           (h=148)
  popular: "5c824f43eee645b926b8f74c7aad5a71995746f2", // Type=Popular            (h=848)
  search:  "fcd29bc0facedd7364b3f4f3b57f674de3c1538a", // Type=Search             (h=840)
};

// Heights
const H_HEADER  = 88;
const H_TAGS    = 148;
const H_POPULAR = 848;
const H_SEARCH  = 840;
const W         = 375;

// Canvas placement — place side by side with gap
const CANVAS_X_DEFAULT = 0;
const CANVAS_X_TYPED   = W + 48;
const CANVAS_Y         = 0;

// #0b0f1a → level/surface (Hisse Dark)
const SURFACE_FILL = { r: 11/255, g: 15/255, b: 26/255 };

async function checkConnection() {
  const res = await fetch("http://localhost:9001/status");
  const { pluginConnected } = await res.json();
  if (!pluginConnected) {
    throw new Error("Figma plugin not connected. Open Figma → run the Claude plugin.");
  }
  console.log("✅ Plugin connected");
}

async function buildDefaultFrame() {
  const frameH = H_HEADER + H_TAGS + H_POPULAR; // 88 + 148 + 848 = 1084

  console.log("\n📱 Creating Frame A: Hisse Search — Default");
  const frame = await cmd("create_frame", {
    name: "Hisse Search — Default",
    width: W,
    height: frameH,
    x: CANVAS_X_DEFAULT,
    y: CANVAS_Y,
    fillColor: SURFACE_FILL,
  });
  const frameId = frame.nodeId;
  console.log("  Frame created:", frameId);

  // 1. Header
  console.log("  Importing header...");
  await cmd("import_component_by_key", {
    key: KEYS.header,
    x: 0,
    y: 0,
    parentFrameId: frameId,
  });
  await sleep(800);

  // 2. Search Tags
  console.log("  Importing Search [Tags]...");
  await cmd("import_component_by_key", {
    key: KEYS.tags,
    x: 0,
    y: H_HEADER,
    parentFrameId: frameId,
  });
  await sleep(800);

  // 3. Popular list
  console.log("  Importing Type=Popular...");
  await cmd("import_component_by_key", {
    key: KEYS.popular,
    x: 0,
    y: H_HEADER + H_TAGS,
    parentFrameId: frameId,
  });
  await sleep(800);

  console.log("  ✅ Frame A done (h=" + frameH + ")");
  return frameId;
}

async function buildTypedFrame() {
  const frameH = H_HEADER + H_SEARCH; // 88 + 840 = 928

  console.log("\n📱 Creating Frame B: Hisse Search — Typed");
  const frame = await cmd("create_frame", {
    name: "Hisse Search — Typed",
    width: W,
    height: frameH,
    x: CANVAS_X_TYPED,
    y: CANVAS_Y,
    fillColor: SURFACE_FILL,
  });
  const frameId = frame.nodeId;
  console.log("  Frame created:", frameId);

  // 1. Header
  console.log("  Importing header...");
  await cmd("import_component_by_key", {
    key: KEYS.header,
    x: 0,
    y: 0,
    parentFrameId: frameId,
  });
  await sleep(800);

  // 2. Search results (Typed state)
  console.log("  Importing Type=Search...");
  await cmd("import_component_by_key", {
    key: KEYS.search,
    x: 0,
    y: H_HEADER,
    parentFrameId: frameId,
  });
  await sleep(800);

  console.log("  ✅ Frame B done (h=" + frameH + ")");
  return frameId;
}

async function main() {
  console.log("═══════════════════════════════════════");
  console.log("  Hisse Search Frames Builder");
  console.log("═══════════════════════════════════════");

  await checkConnection();

  const frameAId = await buildDefaultFrame();
  const frameBId = await buildTypedFrame();

  console.log("\n🎉 Done!");
  console.log("  Frame A (Default):", frameAId);
  console.log("  Frame B (Typed):", frameBId);
  console.log("\n  Layout:");
  console.log("  ┌─────────────────────┐  ┌─────────────────────┐");
  console.log("  │  Hisse Search       │  │  Hisse Search       │");
  console.log("  │  Default (1084px)   │  │  Typed (928px)      │");
  console.log("  │                     │  │                     │");
  console.log("  │  ▸ Header (88)      │  │  ▸ Header (88)      │");
  console.log("  │  ▸ Tags (148)       │  │  ▸ Search List(840) │");
  console.log("  │  ▸ Popular (848)    │  │                     │");
  console.log("  └─────────────────────┘  └─────────────────────┘");
}

main().catch((e) => {
  console.error("❌ Error:", e.message);
  process.exit(1);
});
