"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mcp_js_1 = require("@modelcontextprotocol/sdk/server/mcp.js");
const stdio_js_1 = require("@modelcontextprotocol/sdk/server/stdio.js");
const ws_1 = require("ws");
const zod_1 = require("zod");
// --- WebSocket Server ---
const WS_PORT = 9000;
let figmaSocket = null;
let pendingRequests = new Map();
let requestId = 0;
const wss = new ws_1.WebSocketServer({ host: "0.0.0.0", port: WS_PORT });
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
                }
                else {
                    pending.resolve(msg.result);
                }
            }
        }
        catch (e) {
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
function sendToFigma(action, params) {
    return new Promise((resolve, reject) => {
        if (!figmaSocket || figmaSocket.readyState !== ws_1.WebSocket.OPEN) {
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
const server = new mcp_js_1.McpServer({
    name: "figma",
    version: "1.0.0",
});
// Helper to parse hex color to Figma RGB (0-1 range)
function hexToFigmaRGB(hex) {
    const h = hex.replace("#", "");
    return {
        r: parseInt(h.substring(0, 2), 16) / 255,
        g: parseInt(h.substring(2, 4), 16) / 255,
        b: parseInt(h.substring(4, 6), 16) / 255,
    };
}
// Helper: wrap sendToFigma with standard MCP response format
async function mcpCall(action, params) {
    try {
        const result = await sendToFigma(action, params);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
    catch (e) {
        return { content: [{ type: "text", text: `Error: ${e.message}` }], isError: true };
    }
}
// =====================
// Existing Tools
// =====================
server.tool("create_frame", "Create a new frame in Figma", {
    name: zod_1.z.string().describe("Frame name"),
    width: zod_1.z.number().describe("Frame width in pixels"),
    height: zod_1.z.number().describe("Frame height in pixels"),
    x: zod_1.z.number().optional().default(0).describe("X position"),
    y: zod_1.z.number().optional().default(0).describe("Y position"),
    fillColor: zod_1.z.string().optional().describe("Fill color as hex string, e.g. #FF5733"),
}, async (params) => {
    const fill = params.fillColor ? hexToFigmaRGB(params.fillColor) : undefined;
    return mcpCall("create_frame", { ...params, fillColor: fill });
});
server.tool("add_text", "Add a text node in Figma", {
    text: zod_1.z.string().describe("Text content"),
    fontSize: zod_1.z.number().optional().default(16).describe("Font size"),
    x: zod_1.z.number().optional().default(0).describe("X position"),
    y: zod_1.z.number().optional().default(0).describe("Y position"),
    fillColor: zod_1.z.string().optional().describe("Text color as hex string, e.g. #000000"),
    parentFrameId: zod_1.z.string().optional().describe("Parent frame node ID to place text inside"),
}, async (params) => {
    const fill = params.fillColor ? hexToFigmaRGB(params.fillColor) : undefined;
    return mcpCall("add_text", { ...params, fillColor: fill });
});
server.tool("add_rectangle", "Add a rectangle shape in Figma", {
    width: zod_1.z.number().describe("Rectangle width"),
    height: zod_1.z.number().describe("Rectangle height"),
    x: zod_1.z.number().optional().default(0).describe("X position"),
    y: zod_1.z.number().optional().default(0).describe("Y position"),
    fillColor: zod_1.z.string().optional().default("#C4C4C4").describe("Fill color as hex string"),
    parentFrameId: zod_1.z.string().optional().describe("Parent frame node ID"),
}, async (params) => {
    const fill = hexToFigmaRGB(params.fillColor);
    return mcpCall("add_rectangle", { ...params, fillColor: fill });
});
server.tool("list_nodes", "List all top-level nodes on the current Figma page", {}, async () => mcpCall("list_nodes", {}));
// =====================
// Phase 1: Read Tools
// =====================
server.tool("get_node_details", "Get full details of a node: position, size, fills, strokes, effects, text properties, and direct children list", {
    nodeId: zod_1.z.string().describe("The node ID to inspect"),
}, async (params) => mcpCall("get_node_details", params));
server.tool("get_children", "Get a node's children tree recursively up to a given depth, with summary info for each child", {
    nodeId: zod_1.z.string().describe("Parent node ID"),
    depth: zod_1.z.number().optional().default(1).describe("Recursion depth (default 1)"),
}, async (params) => mcpCall("get_children", params));
server.tool("get_selection", "Get details of the currently selected nodes in Figma (user must select elements in Figma first)", {}, async () => mcpCall("get_selection", {}));
server.tool("get_styles", "Get all local paint styles, text styles, and effect styles defined in the Figma file", {}, async () => mcpCall("get_styles", {}));
// =====================
// Phase 2: Edit Tools
// =====================
server.tool("update_node", "Update properties of an existing node. Only provided properties are changed; others remain untouched.", {
    nodeId: zod_1.z.string().describe("Node ID to update"),
    name: zod_1.z.string().optional().describe("New name"),
    x: zod_1.z.number().optional().describe("New X position"),
    y: zod_1.z.number().optional().describe("New Y position"),
    width: zod_1.z.number().optional().describe("New width"),
    height: zod_1.z.number().optional().describe("New height"),
    fillColor: zod_1.z.string().optional().describe("New fill color as hex, e.g. #FF5733"),
    opacity: zod_1.z.number().optional().describe("Opacity (0 to 1)"),
    cornerRadius: zod_1.z.number().optional().describe("Corner radius in pixels"),
    visible: zod_1.z.boolean().optional().describe("Visibility"),
    strokeColor: zod_1.z.string().optional().describe("Stroke color as hex"),
    strokeWeight: zod_1.z.number().optional().describe("Stroke weight in pixels"),
}, async (params) => {
    const mapped = { ...params };
    if (params.fillColor)
        mapped.fillColor = hexToFigmaRGB(params.fillColor);
    if (params.strokeColor)
        mapped.strokeColor = hexToFigmaRGB(params.strokeColor);
    return mcpCall("update_node", mapped);
});
server.tool("update_text", "Update an existing text node's content and style properties", {
    nodeId: zod_1.z.string().describe("Text node ID to update"),
    text: zod_1.z.string().optional().describe("New text content"),
    fontSize: zod_1.z.number().optional().describe("New font size"),
    fillColor: zod_1.z.string().optional().describe("Text color as hex"),
    fontFamily: zod_1.z.string().optional().describe("Font family, e.g. 'Inter'"),
    fontWeight: zod_1.z.string().optional().describe("Font style/weight, e.g. 'Bold', 'Regular'"),
    textAlign: zod_1.z.enum(["LEFT", "CENTER", "RIGHT", "JUSTIFIED"]).optional().describe("Horizontal text alignment"),
    lineHeight: zod_1.z.number().optional().describe("Line height in pixels"),
    letterSpacing: zod_1.z.number().optional().describe("Letter spacing in pixels"),
}, async (params) => {
    const mapped = { ...params };
    if (params.fillColor)
        mapped.fillColor = hexToFigmaRGB(params.fillColor);
    return mcpCall("update_text", mapped);
});
server.tool("delete_node", "Delete a node from the Figma canvas. Returns the deleted node's name and type for confirmation.", {
    nodeId: zod_1.z.string().describe("Node ID to delete"),
}, async (params) => mcpCall("delete_node", params));
server.tool("clone_node", "Deep-clone a node (including all children). If no position is given, places the clone 20px to the right of the original.", {
    nodeId: zod_1.z.string().describe("Node ID to clone"),
    x: zod_1.z.number().optional().describe("X position for the clone"),
    y: zod_1.z.number().optional().describe("Y position for the clone"),
}, async (params) => mcpCall("clone_node", params));
server.tool("move_node", "Move a node into a different parent container, optionally setting new coordinates", {
    nodeId: zod_1.z.string().describe("Node ID to move"),
    parentId: zod_1.z.string().describe("Target parent node ID"),
    x: zod_1.z.number().optional().describe("New X position inside parent"),
    y: zod_1.z.number().optional().describe("New Y position inside parent"),
}, async (params) => mcpCall("move_node", params));
// =====================
// Phase 3: Advanced Creation Tools
// =====================
server.tool("add_ellipse", "Create an ellipse (circle) shape in Figma", {
    width: zod_1.z.number().describe("Ellipse width"),
    height: zod_1.z.number().describe("Ellipse height"),
    x: zod_1.z.number().optional().default(0).describe("X position"),
    y: zod_1.z.number().optional().default(0).describe("Y position"),
    fillColor: zod_1.z.string().optional().describe("Fill color as hex string"),
    parentFrameId: zod_1.z.string().optional().describe("Parent frame node ID"),
}, async (params) => {
    const fill = params.fillColor ? hexToFigmaRGB(params.fillColor) : undefined;
    return mcpCall("add_ellipse", { ...params, fillColor: fill });
});
server.tool("add_line", "Create a line between two points in Figma", {
    startX: zod_1.z.number().optional().default(0).describe("Start X coordinate"),
    startY: zod_1.z.number().optional().default(0).describe("Start Y coordinate"),
    endX: zod_1.z.number().optional().default(100).describe("End X coordinate"),
    endY: zod_1.z.number().optional().default(0).describe("End Y coordinate"),
    strokeColor: zod_1.z.string().optional().describe("Stroke color as hex string"),
    strokeWeight: zod_1.z.number().optional().default(1).describe("Stroke weight in pixels"),
    parentFrameId: zod_1.z.string().optional().describe("Parent frame node ID"),
}, async (params) => {
    const stroke = params.strokeColor ? hexToFigmaRGB(params.strokeColor) : undefined;
    return mcpCall("add_line", { ...params, strokeColor: stroke });
});
server.tool("set_auto_layout", "Apply auto layout to a frame — the foundation of responsive Figma designs", {
    nodeId: zod_1.z.string().describe("Frame node ID to apply auto layout to"),
    direction: zod_1.z.enum(["HORIZONTAL", "VERTICAL"]).optional().default("VERTICAL").describe("Layout direction"),
    spacing: zod_1.z.number().optional().describe("Spacing between items in pixels"),
    padding: zod_1.z.number().optional().describe("Equal padding on all sides in pixels"),
    alignItems: zod_1.z.enum(["START", "CENTER", "END"]).optional().describe("Alignment of items"),
}, async (params) => mcpCall("set_auto_layout", params));
// =====================
// Phase 4: Design Kit Tools
// =====================
server.tool("search_components", "Search for components and component sets in the entire document (all pages) by name. Returns component IDs, keys, variant properties, and children.", {
    query: zod_1.z.string().optional().default("").describe("Search query to filter component names (case-insensitive, partial match). Leave empty to list all components."),
}, async (params) => mcpCall("search_components", params));
server.tool("list_library_components", "Discover components from external team libraries that are enabled in the current Figma file. Returns component keys and names for use with import_component_by_key.", {}, async () => mcpCall("list_library_components", {}));
server.tool("create_instance", "Create an instance of a component. Use search_components first to find the component ID.", {
    componentId: zod_1.z.string().describe("The component node ID to instantiate"),
    x: zod_1.z.number().optional().default(0).describe("X position"),
    y: zod_1.z.number().optional().default(0).describe("Y position"),
    parentFrameId: zod_1.z.string().optional().describe("Parent frame node ID to place the instance inside"),
}, async (params) => mcpCall("create_instance", params));
server.tool("set_variant", "Change the variant of a component instance. You can swap to a different variant component or set variant properties by name.", {
    nodeId: zod_1.z.string().describe("Instance node ID to modify"),
    swapComponentId: zod_1.z.string().optional().describe("Component ID to swap the instance to (use for switching to a specific variant)"),
    variantProperties: zod_1.z.record(zod_1.z.string(), zod_1.z.string()).optional().describe("Variant properties to set as key-value pairs, e.g. {\"Size\": \"Large\", \"State\": \"Hover\"}"),
}, async (params) => mcpCall("set_variant", params));
server.tool("apply_style", "Apply local paint, text, stroke, or effect styles to a node. Use get_styles first to find style IDs.", {
    nodeId: zod_1.z.string().describe("Node ID to apply styles to"),
    paintStyleId: zod_1.z.string().optional().describe("Paint style ID for fills"),
    strokeStyleId: zod_1.z.string().optional().describe("Paint style ID for strokes"),
    textStyleId: zod_1.z.string().optional().describe("Text style ID (only for text nodes)"),
    effectStyleId: zod_1.z.string().optional().describe("Effect style ID"),
}, async (params) => mcpCall("apply_style", params));
server.tool("group_nodes", "Group multiple nodes together. All nodes must share the same parent.", {
    nodeIds: zod_1.z.array(zod_1.z.string()).describe("Array of node IDs to group together"),
    name: zod_1.z.string().optional().default("Group").describe("Name for the group"),
}, async (params) => mcpCall("group_nodes", params));
server.tool("set_constraints", "Set responsive constraints on a node (how it behaves when its parent frame is resized)", {
    nodeId: zod_1.z.string().describe("Node ID to set constraints on"),
    horizontal: zod_1.z.enum(["MIN", "CENTER", "MAX", "STRETCH", "SCALE"]).optional().describe("Horizontal constraint: MIN (left), CENTER, MAX (right), STRETCH, or SCALE"),
    vertical: zod_1.z.enum(["MIN", "CENTER", "MAX", "STRETCH", "SCALE"]).optional().describe("Vertical constraint: MIN (top), CENTER, MAX (bottom), STRETCH, or SCALE"),
}, async (params) => mcpCall("set_constraints", params));
// =====================
// Phase 5: External Library Tools
// =====================
server.tool("import_component_by_key", "Import a component from an external team library by its key and create an instance. Use get_instance_info on an existing instance to find the key.", {
    key: zod_1.z.string().describe("Component key from the team library"),
    x: zod_1.z.number().optional().default(0).describe("X position"),
    y: zod_1.z.number().optional().default(0).describe("Y position"),
    parentFrameId: zod_1.z.string().optional().describe("Parent frame node ID to place the instance inside"),
}, async (params) => mcpCall("import_component_by_key", params));
server.tool("import_style_by_key", "Import a style from an external team library by its key and apply it to a node. Automatically detects style type (paint, text, effect).", {
    key: zod_1.z.string().describe("Style key from the team library"),
    nodeId: zod_1.z.string().describe("Node ID to apply the imported style to"),
    target: zod_1.z.enum(["fill", "stroke"]).optional().default("fill").describe("For paint styles: apply as fill or stroke (default: fill)"),
}, async (params) => mcpCall("import_style_by_key", params));
server.tool("get_instance_info", "Get detailed info about a component instance or component, including the main component's key (needed for import_component_by_key), remote status, and variant properties.", {
    nodeId: zod_1.z.string().describe("Instance or Component node ID"),
}, async (params) => mcpCall("get_instance_info", params));
// =====================
// Phase 6: Variable Binding Tools
// =====================
server.tool("list_variables", "List all local variables in the Figma file, optionally filtered by type (COLOR, FLOAT, STRING, BOOLEAN)", {
    resolvedType: zod_1.z.string().optional().describe("Filter by variable type: COLOR, FLOAT, STRING, BOOLEAN"),
}, async (params) => mcpCall("list_variables", params));
server.tool("bind_variable", "Bind a Figma variable (e.g. color token) to a node's fill or stroke. Uses the variable reference, not a hardcoded value.", {
    nodeId: zod_1.z.string().describe("Node ID to bind the variable to"),
    variableName: zod_1.z.string().optional().describe("Variable name to bind (e.g. 'level/surface') - searches local variables only"),
    variableId: zod_1.z.string().optional().describe("Variable ID to bind (alternative to variableName)"),
    variableKey: zod_1.z.string().optional().describe("Variable key from team library (use list_library_variables to find keys, then bind directly with this)"),
    field: zod_1.z.enum(["fills", "strokes"]).default("fills").describe("Which property to bind: fills or strokes"),
}, async (params) => mcpCall("bind_variable", params));
server.tool("list_library_variables", "List available variables from enabled team libraries (external/remote variables). Use this to find variable keys for binding.", {
    libraryFilter: zod_1.z.string().optional().describe("Filter by library name (e.g. 'FellowKit', 'Base')"),
    nameFilter: zod_1.z.string().optional().describe("Filter by variable name (e.g. 'surface', 'level')"),
    resolvedType: zod_1.z.string().optional().describe("Filter by variable type: COLOR, FLOAT, STRING, BOOLEAN"),
}, async (params) => mcpCall("list_library_variables", params));
server.tool("import_variable_by_key", "Import a variable from an external team library by its key. Returns the imported variable details.", {
    key: zod_1.z.string().describe("Variable key from the team library"),
}, async (params) => mcpCall("import_variable_by_key", params));
// --- Start ---
async function main() {
    const transport = new stdio_js_1.StdioServerTransport();
    await server.connect(transport);
    console.error("[MCP] Figma MCP server running (stdio)");
}
main().catch((e) => {
    console.error("[MCP] Fatal error:", e);
    process.exit(1);
});
