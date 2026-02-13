import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { WebSocketServer, WebSocket } from "ws";
import { z } from "zod";

// --- WebSocket Server ---
const WS_PORT = 9000;
let figmaSocket: WebSocket | null = null;
let pendingRequests = new Map<string, { resolve: (value: any) => void; reject: (reason: any) => void }>();
let requestId = 0;

const wss = new WebSocketServer({ port: WS_PORT });

wss.on("connection", (ws) => {
  console.error(`[WS] Figma plugin connected`);
  figmaSocket = ws;

  ws.on("message", (data) => {
    try {
      const msg = JSON.parse(data.toString());
      const pending = pendingRequests.get(msg.id);
      if (pending) {
        pendingRequests.delete(msg.id);
        if (msg.error) {
          pending.reject(new Error(msg.error));
        } else {
          pending.resolve(msg.result);
        }
      }
    } catch (e) {
      console.error("[WS] Failed to parse message:", e);
    }
  });

  ws.on("close", () => {
    console.error(`[WS] Figma plugin disconnected`);
    figmaSocket = null;
    // Reject all pending requests
    for (const [id, pending] of pendingRequests) {
      pending.reject(new Error("Figma plugin disconnected"));
    }
    pendingRequests.clear();
  });
});

console.error(`[WS] WebSocket server listening on port ${WS_PORT}`);

function sendToFigma(action: string, params: Record<string, any>): Promise<any> {
  return new Promise((resolve, reject) => {
    if (!figmaSocket || figmaSocket.readyState !== WebSocket.OPEN) {
      reject(new Error("Figma plugin is not connected. Please open the plugin in Figma first."));
      return;
    }

    const id = String(++requestId);
    const timeout = setTimeout(() => {
      pendingRequests.delete(id);
      reject(new Error("Request to Figma timed out (10s)"));
    }, 10000);

    pendingRequests.set(id, {
      resolve: (value) => { clearTimeout(timeout); resolve(value); },
      reject: (reason) => { clearTimeout(timeout); reject(reason); },
    });

    figmaSocket.send(JSON.stringify({ id, action, params }));
  });
}

// --- MCP Server ---
const server = new McpServer({
  name: "figma",
  version: "1.0.0",
});

// Helper to parse hex color to Figma RGB (0-1 range)
function hexToFigmaRGB(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace("#", "");
  return {
    r: parseInt(h.substring(0, 2), 16) / 255,
    g: parseInt(h.substring(2, 4), 16) / 255,
    b: parseInt(h.substring(4, 6), 16) / 255,
  };
}

// Helper: wrap sendToFigma with standard MCP response format
async function mcpCall(action: string, params: Record<string, any>) {
  try {
    const result = await sendToFigma(action, params);
    return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
  } catch (e: any) {
    return { content: [{ type: "text" as const, text: `Error: ${e.message}` }], isError: true };
  }
}

// =====================
// Existing Tools
// =====================

server.tool(
  "create_frame",
  "Create a new frame in Figma",
  {
    name: z.string().describe("Frame name"),
    width: z.number().describe("Frame width in pixels"),
    height: z.number().describe("Frame height in pixels"),
    x: z.number().optional().default(0).describe("X position"),
    y: z.number().optional().default(0).describe("Y position"),
    fillColor: z.string().optional().describe("Fill color as hex string, e.g. #FF5733"),
  },
  async (params) => {
    const fill = params.fillColor ? hexToFigmaRGB(params.fillColor) : undefined;
    return mcpCall("create_frame", { ...params, fillColor: fill });
  }
);

server.tool(
  "add_text",
  "Add a text node in Figma",
  {
    text: z.string().describe("Text content"),
    fontSize: z.number().optional().default(16).describe("Font size"),
    x: z.number().optional().default(0).describe("X position"),
    y: z.number().optional().default(0).describe("Y position"),
    fillColor: z.string().optional().describe("Text color as hex string, e.g. #000000"),
    parentFrameId: z.string().optional().describe("Parent frame node ID to place text inside"),
  },
  async (params) => {
    const fill = params.fillColor ? hexToFigmaRGB(params.fillColor) : undefined;
    return mcpCall("add_text", { ...params, fillColor: fill });
  }
);

server.tool(
  "add_rectangle",
  "Add a rectangle shape in Figma",
  {
    width: z.number().describe("Rectangle width"),
    height: z.number().describe("Rectangle height"),
    x: z.number().optional().default(0).describe("X position"),
    y: z.number().optional().default(0).describe("Y position"),
    fillColor: z.string().optional().default("#C4C4C4").describe("Fill color as hex string"),
    parentFrameId: z.string().optional().describe("Parent frame node ID"),
  },
  async (params) => {
    const fill = hexToFigmaRGB(params.fillColor);
    return mcpCall("add_rectangle", { ...params, fillColor: fill });
  }
);

server.tool(
  "list_nodes",
  "List all top-level nodes on the current Figma page",
  {},
  async () => mcpCall("list_nodes", {})
);

// =====================
// Phase 1: Read Tools
// =====================

server.tool(
  "get_node_details",
  "Get full details of a node: position, size, fills, strokes, effects, text properties, and direct children list",
  {
    nodeId: z.string().describe("The node ID to inspect"),
  },
  async (params) => mcpCall("get_node_details", params)
);

server.tool(
  "get_children",
  "Get a node's children tree recursively up to a given depth, with summary info for each child",
  {
    nodeId: z.string().describe("Parent node ID"),
    depth: z.number().optional().default(1).describe("Recursion depth (default 1)"),
  },
  async (params) => mcpCall("get_children", params)
);

server.tool(
  "get_selection",
  "Get details of the currently selected nodes in Figma (user must select elements in Figma first)",
  {},
  async () => mcpCall("get_selection", {})
);

server.tool(
  "get_styles",
  "Get all local paint styles, text styles, and effect styles defined in the Figma file",
  {},
  async () => mcpCall("get_styles", {})
);

// =====================
// Phase 2: Edit Tools
// =====================

server.tool(
  "update_node",
  "Update properties of an existing node. Only provided properties are changed; others remain untouched.",
  {
    nodeId: z.string().describe("Node ID to update"),
    name: z.string().optional().describe("New name"),
    x: z.number().optional().describe("New X position"),
    y: z.number().optional().describe("New Y position"),
    width: z.number().optional().describe("New width"),
    height: z.number().optional().describe("New height"),
    fillColor: z.string().optional().describe("New fill color as hex, e.g. #FF5733"),
    opacity: z.number().optional().describe("Opacity (0 to 1)"),
    cornerRadius: z.number().optional().describe("Corner radius in pixels"),
    visible: z.boolean().optional().describe("Visibility"),
    strokeColor: z.string().optional().describe("Stroke color as hex"),
    strokeWeight: z.number().optional().describe("Stroke weight in pixels"),
  },
  async (params) => {
    const mapped: Record<string, any> = { ...params };
    if (params.fillColor) mapped.fillColor = hexToFigmaRGB(params.fillColor);
    if (params.strokeColor) mapped.strokeColor = hexToFigmaRGB(params.strokeColor);
    return mcpCall("update_node", mapped);
  }
);

server.tool(
  "update_text",
  "Update an existing text node's content and style properties",
  {
    nodeId: z.string().describe("Text node ID to update"),
    text: z.string().optional().describe("New text content"),
    fontSize: z.number().optional().describe("New font size"),
    fillColor: z.string().optional().describe("Text color as hex"),
    fontFamily: z.string().optional().describe("Font family, e.g. 'Inter'"),
    fontWeight: z.string().optional().describe("Font style/weight, e.g. 'Bold', 'Regular'"),
    textAlign: z.enum(["LEFT", "CENTER", "RIGHT", "JUSTIFIED"]).optional().describe("Horizontal text alignment"),
    lineHeight: z.number().optional().describe("Line height in pixels"),
    letterSpacing: z.number().optional().describe("Letter spacing in pixels"),
  },
  async (params) => {
    const mapped: Record<string, any> = { ...params };
    if (params.fillColor) mapped.fillColor = hexToFigmaRGB(params.fillColor);
    return mcpCall("update_text", mapped);
  }
);

server.tool(
  "delete_node",
  "Delete a node from the Figma canvas. Returns the deleted node's name and type for confirmation.",
  {
    nodeId: z.string().describe("Node ID to delete"),
  },
  async (params) => mcpCall("delete_node", params)
);

server.tool(
  "clone_node",
  "Deep-clone a node (including all children). If no position is given, places the clone 20px to the right of the original.",
  {
    nodeId: z.string().describe("Node ID to clone"),
    x: z.number().optional().describe("X position for the clone"),
    y: z.number().optional().describe("Y position for the clone"),
  },
  async (params) => mcpCall("clone_node", params)
);

server.tool(
  "move_node",
  "Move a node into a different parent container, optionally setting new coordinates",
  {
    nodeId: z.string().describe("Node ID to move"),
    parentId: z.string().describe("Target parent node ID"),
    x: z.number().optional().describe("New X position inside parent"),
    y: z.number().optional().describe("New Y position inside parent"),
  },
  async (params) => mcpCall("move_node", params)
);

// =====================
// Phase 3: Advanced Creation Tools
// =====================

server.tool(
  "add_ellipse",
  "Create an ellipse (circle) shape in Figma",
  {
    width: z.number().describe("Ellipse width"),
    height: z.number().describe("Ellipse height"),
    x: z.number().optional().default(0).describe("X position"),
    y: z.number().optional().default(0).describe("Y position"),
    fillColor: z.string().optional().describe("Fill color as hex string"),
    parentFrameId: z.string().optional().describe("Parent frame node ID"),
  },
  async (params) => {
    const fill = params.fillColor ? hexToFigmaRGB(params.fillColor) : undefined;
    return mcpCall("add_ellipse", { ...params, fillColor: fill });
  }
);

server.tool(
  "add_line",
  "Create a line between two points in Figma",
  {
    startX: z.number().optional().default(0).describe("Start X coordinate"),
    startY: z.number().optional().default(0).describe("Start Y coordinate"),
    endX: z.number().optional().default(100).describe("End X coordinate"),
    endY: z.number().optional().default(0).describe("End Y coordinate"),
    strokeColor: z.string().optional().describe("Stroke color as hex string"),
    strokeWeight: z.number().optional().default(1).describe("Stroke weight in pixels"),
    parentFrameId: z.string().optional().describe("Parent frame node ID"),
  },
  async (params) => {
    const stroke = params.strokeColor ? hexToFigmaRGB(params.strokeColor) : undefined;
    return mcpCall("add_line", { ...params, strokeColor: stroke });
  }
);

server.tool(
  "set_auto_layout",
  "Apply auto layout to a frame — the foundation of responsive Figma designs",
  {
    nodeId: z.string().describe("Frame node ID to apply auto layout to"),
    direction: z.enum(["HORIZONTAL", "VERTICAL"]).optional().default("VERTICAL").describe("Layout direction"),
    spacing: z.number().optional().describe("Spacing between items in pixels"),
    padding: z.number().optional().describe("Equal padding on all sides in pixels"),
    alignItems: z.enum(["START", "CENTER", "END"]).optional().describe("Alignment of items"),
  },
  async (params) => mcpCall("set_auto_layout", params)
);

// --- Start ---
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("[MCP] Figma MCP server running (stdio)");
}

main().catch((e) => {
  console.error("[MCP] Fatal error:", e);
  process.exit(1);
});
