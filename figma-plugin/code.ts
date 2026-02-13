// Claude to Figma — Plugin Backend
// Communicates with ui.html (WebSocket bridge) and Figma API

figma.showUI(__html__, { width: 320, height: 340 });

interface WsMessage {
  id: string;
  action: string;
  params: Record<string, any>;
}

interface WsResponse {
  id: string;
  result?: any;
  error?: string;
}

function sendResponse(id: string, result?: any, error?: string) {
  const response: WsResponse = { id };
  if (error) response.error = error;
  else response.result = result;
  figma.ui.postMessage({ type: "ws_response", data: response });
}

// --- Helpers ---

function extractFills(node: SceneNode): any[] | undefined {
  if (!("fills" in node)) return undefined;
  const fills = (node as GeometryMixin).fills;
  if (fills === figma.mixed || !Array.isArray(fills)) return undefined;
  return fills.map((f: Paint) => {
    if (f.type === "SOLID") {
      const s = f as SolidPaint;
      return {
        type: "SOLID",
        color: { r: s.color.r, g: s.color.g, b: s.color.b },
        opacity: s.opacity,
      };
    }
    return { type: f.type };
  });
}

function extractStrokes(node: SceneNode): any[] | undefined {
  if (!("strokes" in node)) return undefined;
  const strokes = (node as GeometryMixin).strokes;
  if (!Array.isArray(strokes)) return undefined;
  return strokes.map((s: Paint) => {
    if (s.type === "SOLID") {
      const solid = s as SolidPaint;
      return {
        type: "SOLID",
        color: { r: solid.color.r, g: solid.color.g, b: solid.color.b },
        opacity: solid.opacity,
      };
    }
    return { type: s.type };
  });
}

function extractEffects(node: SceneNode): any[] | undefined {
  if (!("effects" in node)) return undefined;
  const effects = (node as BlendMixin).effects;
  if (!Array.isArray(effects)) return undefined;
  return effects.map((e: Effect) => ({
    type: e.type,
    visible: e.visible,
  }));
}

function extractTextProps(node: TextNode): Record<string, any> {
  return {
    characters: node.characters,
    fontSize: node.fontSize !== figma.mixed ? node.fontSize : "mixed",
    fontName: node.fontName !== figma.mixed ? node.fontName : "mixed",
    textAlignHorizontal: node.textAlignHorizontal,
    textAlignVertical: node.textAlignVertical,
    lineHeight: node.lineHeight !== figma.mixed ? node.lineHeight : "mixed",
    letterSpacing: node.letterSpacing !== figma.mixed ? node.letterSpacing : "mixed",
  };
}

function getNodeSummary(node: SceneNode): Record<string, any> {
  const summary: Record<string, any> = {
    nodeId: node.id,
    name: node.name,
    type: node.type,
    x: node.x,
    y: node.y,
    visible: node.visible,
    opacity: "opacity" in node ? (node as BlendMixin).opacity : undefined,
  };
  if ("width" in node) summary.width = (node as any).width;
  if ("height" in node) summary.height = (node as any).height;
  summary.fills = extractFills(node);
  return summary;
}

function getNodeDetails(node: SceneNode): Record<string, any> {
  const details: Record<string, any> = {
    nodeId: node.id,
    name: node.name,
    type: node.type,
    x: node.x,
    y: node.y,
    visible: node.visible,
    locked: node.locked,
  };

  if ("width" in node) details.width = (node as any).width;
  if ("height" in node) details.height = (node as any).height;
  if ("opacity" in node) details.opacity = (node as BlendMixin).opacity;
  if ("cornerRadius" in node) {
    details.cornerRadius = (node as any).cornerRadius !== figma.mixed
      ? (node as any).cornerRadius
      : "mixed";
  }

  details.fills = extractFills(node);
  details.strokes = extractStrokes(node);
  details.effects = extractEffects(node);

  if ("strokeWeight" in node) {
    details.strokeWeight = (node as GeometryMixin).strokeWeight;
  }

  if (node.type === "TEXT") {
    Object.assign(details, extractTextProps(node as TextNode));
  }

  if ("children" in node) {
    details.children = (node as ChildrenMixin).children.map((c: SceneNode) => ({
      nodeId: c.id,
      name: c.name,
      type: c.type,
    }));
  }

  return details;
}

function getChildrenRecursive(node: SceneNode, depth: number): Record<string, any> {
  const info = getNodeSummary(node);
  if (depth > 0 && "children" in node) {
    info.children = (node as ChildrenMixin).children.map((c: SceneNode) =>
      getChildrenRecursive(c, depth - 1)
    );
  }
  return info;
}

// --- Message Handler ---

figma.ui.onmessage = async (msg: any) => {
  if (msg.type !== "ws_message") return;

  const { id, action, params } = msg.data as WsMessage;

  try {
    switch (action) {
      // Existing actions
      case "create_frame":
        await handleCreateFrame(id, params);
        break;
      case "add_text":
        await handleAddText(id, params);
        break;
      case "add_rectangle":
        await handleAddRectangle(id, params);
        break;
      case "list_nodes":
        handleListNodes(id);
        break;

      // Phase 1: Read
      case "get_node_details":
        handleGetNodeDetails(id, params);
        break;
      case "get_children":
        handleGetChildren(id, params);
        break;
      case "get_selection":
        handleGetSelection(id);
        break;
      case "get_styles":
        handleGetStyles(id);
        break;

      // Phase 2: Edit
      case "update_node":
        handleUpdateNode(id, params);
        break;
      case "update_text":
        await handleUpdateText(id, params);
        break;
      case "delete_node":
        handleDeleteNode(id, params);
        break;
      case "clone_node":
        handleCloneNode(id, params);
        break;
      case "move_node":
        handleMoveNode(id, params);
        break;

      // Phase 3: Advanced creation
      case "add_ellipse":
        handleAddEllipse(id, params);
        break;
      case "add_line":
        handleAddLine(id, params);
        break;
      case "set_auto_layout":
        handleSetAutoLayout(id, params);
        break;

      // Phase 4: Design Kit
      case "search_components":
        handleSearchComponents(id, params);
        break;
      case "create_instance":
        handleCreateInstance(id, params);
        break;
      case "set_variant":
        handleSetVariant(id, params);
        break;
      case "apply_style":
        await handleApplyStyle(id, params);
        break;
      case "group_nodes":
        handleGroupNodes(id, params);
        break;
      case "set_constraints":
        handleSetConstraints(id, params);
        break;

      default:
        sendResponse(id, undefined, `Unknown action: ${action}`);
    }
  } catch (e: any) {
    sendResponse(id, undefined, e.message || String(e));
  }
};

// --- Existing Handlers ---

async function handleCreateFrame(id: string, params: any) {
  const frame = figma.createFrame();
  frame.name = params.name || "Frame";
  frame.resize(params.width || 400, params.height || 300);
  frame.x = params.x || 0;
  frame.y = params.y || 0;

  if (params.fillColor) {
    frame.fills = [{ type: "SOLID", color: params.fillColor }];
  }

  figma.currentPage.appendChild(frame);
  figma.viewport.scrollAndZoomIntoView([frame]);

  sendResponse(id, {
    nodeId: frame.id,
    name: frame.name,
    width: frame.width,
    height: frame.height,
  });
}

async function handleAddText(id: string, params: any) {
  const text = figma.createText();

  // Load font before setting characters
  await figma.loadFontAsync({ family: "Inter", style: "Regular" });

  text.characters = params.text || "Hello";
  text.fontSize = params.fontSize || 16;
  text.x = params.x || 0;
  text.y = params.y || 0;

  if (params.fillColor) {
    text.fills = [{ type: "SOLID", color: params.fillColor }];
  }

  if (params.parentFrameId) {
    const parent = figma.getNodeById(params.parentFrameId);
    if (parent && "appendChild" in parent) {
      (parent as FrameNode).appendChild(text);
    } else {
      sendResponse(id, undefined, `Parent node ${params.parentFrameId} not found or is not a container`);
      return;
    }
  }

  sendResponse(id, {
    nodeId: text.id,
    characters: text.characters,
    fontSize: text.fontSize,
  });
}

async function handleAddRectangle(id: string, params: any) {
  const rect = figma.createRectangle();
  rect.resize(params.width || 100, params.height || 100);
  rect.x = params.x || 0;
  rect.y = params.y || 0;

  if (params.fillColor) {
    rect.fills = [{ type: "SOLID", color: params.fillColor }];
  }

  if (params.parentFrameId) {
    const parent = figma.getNodeById(params.parentFrameId);
    if (parent && "appendChild" in parent) {
      (parent as FrameNode).appendChild(rect);
    } else {
      sendResponse(id, undefined, `Parent node ${params.parentFrameId} not found or is not a container`);
      return;
    }
  }

  sendResponse(id, {
    nodeId: rect.id,
    width: rect.width,
    height: rect.height,
  });
}

function handleListNodes(id: string) {
  const nodes = figma.currentPage.children.map((node) => ({
    nodeId: node.id,
    name: node.name,
    type: node.type,
    x: node.x,
    y: node.y,
    width: "width" in node ? (node as any).width : undefined,
    height: "height" in node ? (node as any).height : undefined,
  }));

  sendResponse(id, { nodes });
}

// --- Phase 1: Read Handlers ---

function handleGetNodeDetails(id: string, params: any) {
  const node = figma.getNodeById(params.nodeId);
  if (!node || node.type === "DOCUMENT" || node.type === "PAGE") {
    sendResponse(id, undefined, `Node ${params.nodeId} not found`);
    return;
  }
  sendResponse(id, getNodeDetails(node as SceneNode));
}

function handleGetChildren(id: string, params: any) {
  const node = figma.getNodeById(params.nodeId);
  if (!node || node.type === "DOCUMENT" || node.type === "PAGE") {
    sendResponse(id, undefined, `Node ${params.nodeId} not found`);
    return;
  }
  const sceneNode = node as SceneNode;
  if (!("children" in sceneNode)) {
    sendResponse(id, undefined, `Node ${params.nodeId} (${sceneNode.type}) has no children`);
    return;
  }
  const depth = params.depth ?? 1;
  const children = (sceneNode as ChildrenMixin).children.map((c: SceneNode) =>
    getChildrenRecursive(c, depth - 1)
  );
  sendResponse(id, { nodeId: params.nodeId, children });
}

function handleGetSelection(id: string) {
  const selection = figma.currentPage.selection;
  if (selection.length === 0) {
    sendResponse(id, { selection: [] });
    return;
  }
  const details = selection.map((node) => getNodeDetails(node));
  sendResponse(id, { selection: details });
}

function handleGetStyles(id: string) {
  const paintStyles = figma.getLocalPaintStyles().map((s) => ({
    id: s.id,
    name: s.name,
    paints: s.paints.map((p: Paint) => {
      if (p.type === "SOLID") {
        const solid = p as SolidPaint;
        return {
          type: "SOLID",
          color: { r: solid.color.r, g: solid.color.g, b: solid.color.b },
          opacity: solid.opacity,
        };
      }
      return { type: p.type };
    }),
  }));

  const textStyles = figma.getLocalTextStyles().map((s) => ({
    id: s.id,
    name: s.name,
    fontSize: s.fontSize,
    fontName: s.fontName,
    lineHeight: s.lineHeight,
    letterSpacing: s.letterSpacing,
    textCase: s.textCase,
    textDecoration: s.textDecoration,
  }));

  const effectStyles = figma.getLocalEffectStyles().map((s) => ({
    id: s.id,
    name: s.name,
    effects: s.effects.map((e: Effect) => ({
      type: e.type,
      visible: e.visible,
    })),
  }));

  sendResponse(id, { paintStyles, textStyles, effectStyles });
}

// --- Phase 2: Edit Handlers ---

function handleUpdateNode(id: string, params: any) {
  const node = figma.getNodeById(params.nodeId);
  if (!node || node.type === "DOCUMENT" || node.type === "PAGE") {
    sendResponse(id, undefined, `Node ${params.nodeId} not found`);
    return;
  }
  const sceneNode = node as SceneNode;

  if (params.name !== undefined) sceneNode.name = params.name;
  if (params.x !== undefined) sceneNode.x = params.x;
  if (params.y !== undefined) sceneNode.y = params.y;
  if (params.visible !== undefined) sceneNode.visible = params.visible;

  if (params.width !== undefined || params.height !== undefined) {
    if ("resize" in sceneNode) {
      const w = params.width ?? (sceneNode as any).width;
      const h = params.height ?? (sceneNode as any).height;
      (sceneNode as any).resize(w, h);
    }
  }

  if (params.opacity !== undefined && "opacity" in sceneNode) {
    (sceneNode as BlendMixin).opacity = params.opacity;
  }

  if (params.fillColor && "fills" in sceneNode) {
    (sceneNode as GeometryMixin).fills = [{ type: "SOLID", color: params.fillColor }];
  }

  if (params.cornerRadius !== undefined && "cornerRadius" in sceneNode) {
    (sceneNode as RectangleNode).cornerRadius = params.cornerRadius;
  }

  if (params.strokeColor && "strokes" in sceneNode) {
    (sceneNode as GeometryMixin).strokes = [{ type: "SOLID", color: params.strokeColor }];
  }

  if (params.strokeWeight !== undefined && "strokeWeight" in sceneNode) {
    (sceneNode as GeometryMixin).strokeWeight = params.strokeWeight;
  }

  sendResponse(id, getNodeDetails(sceneNode));
}

async function handleUpdateText(id: string, params: any) {
  const node = figma.getNodeById(params.nodeId);
  if (!node || node.type !== "TEXT") {
    sendResponse(id, undefined, `Text node ${params.nodeId} not found`);
    return;
  }
  const textNode = node as TextNode;

  // Determine the font to load
  const family = params.fontFamily || (textNode.fontName !== figma.mixed ? (textNode.fontName as FontName).family : "Inter");
  const style = params.fontWeight || (textNode.fontName !== figma.mixed ? (textNode.fontName as FontName).style : "Regular");
  await figma.loadFontAsync({ family, style });

  if (params.text !== undefined) textNode.characters = params.text;
  if (params.fontSize !== undefined) textNode.fontSize = params.fontSize;
  if (params.fontFamily !== undefined || params.fontWeight !== undefined) {
    textNode.fontName = { family, style };
  }
  if (params.fillColor) {
    textNode.fills = [{ type: "SOLID", color: params.fillColor }];
  }
  if (params.textAlign !== undefined) {
    textNode.textAlignHorizontal = params.textAlign;
  }
  if (params.lineHeight !== undefined) {
    textNode.lineHeight = typeof params.lineHeight === "number"
      ? { value: params.lineHeight, unit: "PIXELS" }
      : params.lineHeight;
  }
  if (params.letterSpacing !== undefined) {
    textNode.letterSpacing = typeof params.letterSpacing === "number"
      ? { value: params.letterSpacing, unit: "PIXELS" }
      : params.letterSpacing;
  }

  sendResponse(id, getNodeDetails(textNode));
}

function handleDeleteNode(id: string, params: any) {
  const node = figma.getNodeById(params.nodeId);
  if (!node || node.type === "DOCUMENT" || node.type === "PAGE") {
    sendResponse(id, undefined, `Node ${params.nodeId} not found`);
    return;
  }
  const sceneNode = node as SceneNode;
  const info = { nodeId: sceneNode.id, name: sceneNode.name, type: sceneNode.type };
  sceneNode.remove();
  sendResponse(id, { deleted: true, ...info });
}

function handleCloneNode(id: string, params: any) {
  const node = figma.getNodeById(params.nodeId);
  if (!node || node.type === "DOCUMENT" || node.type === "PAGE") {
    sendResponse(id, undefined, `Node ${params.nodeId} not found`);
    return;
  }
  const sceneNode = node as SceneNode;
  const clone = sceneNode.clone();
  clone.x = params.x ?? sceneNode.x + 20;
  clone.y = params.y ?? sceneNode.y;

  sendResponse(id, getNodeDetails(clone));
}

function handleMoveNode(id: string, params: any) {
  const node = figma.getNodeById(params.nodeId);
  if (!node || node.type === "DOCUMENT" || node.type === "PAGE") {
    sendResponse(id, undefined, `Node ${params.nodeId} not found`);
    return;
  }
  const parentNode = figma.getNodeById(params.parentId);
  if (!parentNode || !("appendChild" in parentNode)) {
    sendResponse(id, undefined, `Parent node ${params.parentId} not found or is not a container`);
    return;
  }
  const sceneNode = node as SceneNode;
  (parentNode as ChildrenMixin).appendChild(sceneNode);
  if (params.x !== undefined) sceneNode.x = params.x;
  if (params.y !== undefined) sceneNode.y = params.y;

  sendResponse(id, getNodeDetails(sceneNode));
}

// --- Phase 3: Advanced Creation Handlers ---

function handleAddEllipse(id: string, params: any) {
  const ellipse = figma.createEllipse();
  ellipse.resize(params.width || 100, params.height || 100);
  ellipse.x = params.x || 0;
  ellipse.y = params.y || 0;

  if (params.fillColor) {
    ellipse.fills = [{ type: "SOLID", color: params.fillColor }];
  }

  if (params.parentFrameId) {
    const parent = figma.getNodeById(params.parentFrameId);
    if (parent && "appendChild" in parent) {
      (parent as FrameNode).appendChild(ellipse);
    } else {
      sendResponse(id, undefined, `Parent node ${params.parentFrameId} not found or is not a container`);
      return;
    }
  }

  sendResponse(id, {
    nodeId: ellipse.id,
    width: ellipse.width,
    height: ellipse.height,
  });
}

function handleAddLine(id: string, params: any) {
  const line = figma.createLine();
  const startX = params.startX || 0;
  const startY = params.startY || 0;
  const endX = params.endX || 100;
  const endY = params.endY || 0;

  line.x = startX;
  line.y = startY;

  const dx = endX - startX;
  const dy = endY - startY;
  const length = Math.sqrt(dx * dx + dy * dy);
  const angle = Math.atan2(dy, dx) * (180 / Math.PI);

  line.resize(length, 0);
  line.rotation = -angle;

  if (params.strokeColor) {
    line.strokes = [{ type: "SOLID", color: params.strokeColor }];
  } else {
    line.strokes = [{ type: "SOLID", color: { r: 0, g: 0, b: 0 } }];
  }
  line.strokeWeight = params.strokeWeight || 1;

  if (params.parentFrameId) {
    const parent = figma.getNodeById(params.parentFrameId);
    if (parent && "appendChild" in parent) {
      (parent as FrameNode).appendChild(line);
    } else {
      sendResponse(id, undefined, `Parent node ${params.parentFrameId} not found or is not a container`);
      return;
    }
  }

  sendResponse(id, {
    nodeId: line.id,
    length,
    angle,
  });
}

function handleSetAutoLayout(id: string, params: any) {
  const node = figma.getNodeById(params.nodeId);
  if (!node || !("layoutMode" in node)) {
    sendResponse(id, undefined, `Node ${params.nodeId} not found or does not support auto layout`);
    return;
  }
  const frame = node as FrameNode;

  frame.layoutMode = params.direction || "VERTICAL";

  if (params.spacing !== undefined) frame.itemSpacing = params.spacing;

  if (params.padding !== undefined) {
    frame.paddingTop = params.padding;
    frame.paddingRight = params.padding;
    frame.paddingBottom = params.padding;
    frame.paddingLeft = params.padding;
  }

  if (params.alignItems !== undefined) {
    frame.primaryAxisAlignItems = params.alignItems === "CENTER" ? "CENTER" :
      params.alignItems === "END" ? "MAX" : "MIN";
    frame.counterAxisAlignItems = params.alignItems === "CENTER" ? "CENTER" :
      params.alignItems === "END" ? "MAX" : "MIN";
  }

  sendResponse(id, {
    nodeId: frame.id,
    name: frame.name,
    layoutMode: frame.layoutMode,
    itemSpacing: frame.itemSpacing,
    paddingTop: frame.paddingTop,
    paddingRight: frame.paddingRight,
    paddingBottom: frame.paddingBottom,
    paddingLeft: frame.paddingLeft,
  });
}

// --- Phase 4: Design Kit Handlers ---

function findComponentsRecursive(node: BaseNode, query: string, results: any[]) {
  if (node.type === "COMPONENT" || node.type === "COMPONENT_SET") {
    if (!query || node.name.toLowerCase().includes(query.toLowerCase())) {
      const info: Record<string, any> = {
        nodeId: node.id,
        name: node.name,
        type: node.type,
      };
      if (node.type === "COMPONENT") {
        const comp = node as ComponentNode;
        info.key = comp.key;
        info.width = comp.width;
        info.height = comp.height;
      }
      if (node.type === "COMPONENT_SET") {
        const cs = node as ComponentSetNode;
        info.variantGroupProperties = cs.variantGroupProperties;
        info.children = cs.children.map((c) => ({
          nodeId: c.id,
          name: c.name,
          type: c.type,
        }));
      }
      results.push(info);
    }
  }
  if ("children" in node) {
    for (const child of (node as ChildrenMixin).children) {
      findComponentsRecursive(child, query, results);
    }
  }
}

function handleSearchComponents(id: string, params: any) {
  const query = params.query || "";
  const results: any[] = [];
  findComponentsRecursive(figma.currentPage, query, results);
  sendResponse(id, { components: results, count: results.length });
}

function handleCreateInstance(id: string, params: any) {
  const node = figma.getNodeById(params.componentId);
  if (!node || node.type !== "COMPONENT") {
    sendResponse(id, undefined, `Component ${params.componentId} not found`);
    return;
  }
  const component = node as ComponentNode;
  const instance = component.createInstance();
  instance.x = params.x ?? 0;
  instance.y = params.y ?? 0;

  if (params.parentFrameId) {
    const parent = figma.getNodeById(params.parentFrameId);
    if (parent && "appendChild" in parent) {
      (parent as ChildrenMixin).appendChild(instance);
    } else {
      sendResponse(id, undefined, `Parent node ${params.parentFrameId} not found or is not a container`);
      return;
    }
  }

  sendResponse(id, {
    nodeId: instance.id,
    name: instance.name,
    componentId: component.id,
    width: instance.width,
    height: instance.height,
  });
}

function handleSetVariant(id: string, params: any) {
  const node = figma.getNodeById(params.nodeId);
  if (!node || node.type !== "INSTANCE") {
    sendResponse(id, undefined, `Instance node ${params.nodeId} not found`);
    return;
  }
  const instance = node as InstanceNode;

  // If swapComponentId is provided, swap to a specific variant component
  if (params.swapComponentId) {
    const swapTarget = figma.getNodeById(params.swapComponentId);
    if (!swapTarget || swapTarget.type !== "COMPONENT") {
      sendResponse(id, undefined, `Swap target component ${params.swapComponentId} not found`);
      return;
    }
    instance.swapComponent(swapTarget as ComponentNode);
  }

  // If variantProperties is provided, set them individually
  if (params.variantProperties && typeof params.variantProperties === "object") {
    const props = params.variantProperties;
    const keys = Object.keys(props);
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      const value = props[key];
      try {
        instance.setProperties({ [key]: value as string });
      } catch (e: any) {
        // Continue setting other properties even if one fails
      }
    }
  }

  sendResponse(id, {
    nodeId: instance.id,
    name: instance.name,
    mainComponentId: instance.mainComponent?.id,
    mainComponentName: instance.mainComponent?.name,
    componentProperties: instance.componentProperties,
  });
}

async function handleApplyStyle(id: string, params: any) {
  const node = figma.getNodeById(params.nodeId);
  if (!node || node.type === "DOCUMENT" || node.type === "PAGE") {
    sendResponse(id, undefined, `Node ${params.nodeId} not found`);
    return;
  }
  const sceneNode = node as SceneNode;
  const applied: string[] = [];

  if (params.paintStyleId && "fillStyleId" in sceneNode) {
    try {
      (sceneNode as any).fillStyleId = params.paintStyleId;
      applied.push("paintStyle");
    } catch (e: any) {
      // style might not be compatible
    }
  }

  if (params.strokeStyleId && "strokeStyleId" in sceneNode) {
    try {
      (sceneNode as any).strokeStyleId = params.strokeStyleId;
      applied.push("strokeStyle");
    } catch (e: any) {
      // style might not be compatible
    }
  }

  if (params.textStyleId && node.type === "TEXT") {
    const textNode = node as TextNode;
    // Load font from the text style first
    const style = figma.getStyleById(params.textStyleId);
    if (style && style.type === "TEXT") {
      const textStyle = style as TextStyle;
      await figma.loadFontAsync(textStyle.fontName);
      textNode.textStyleId = params.textStyleId;
      applied.push("textStyle");
    }
  }

  if (params.effectStyleId && "effectStyleId" in sceneNode) {
    try {
      (sceneNode as any).effectStyleId = params.effectStyleId;
      applied.push("effectStyle");
    } catch (e: any) {
      // style might not be compatible
    }
  }

  sendResponse(id, {
    nodeId: sceneNode.id,
    appliedStyles: applied,
    details: getNodeDetails(sceneNode),
  });
}

function handleGroupNodes(id: string, params: any) {
  const nodeIds: string[] = params.nodeIds;
  if (!nodeIds || nodeIds.length < 1) {
    sendResponse(id, undefined, "At least one node ID is required");
    return;
  }

  const nodes: SceneNode[] = [];
  for (const nid of nodeIds) {
    const n = figma.getNodeById(nid);
    if (!n || n.type === "DOCUMENT" || n.type === "PAGE") {
      sendResponse(id, undefined, `Node ${nid} not found`);
      return;
    }
    nodes.push(n as SceneNode);
  }

  // All nodes must share the same parent
  const parent = nodes[0].parent;
  if (!parent) {
    sendResponse(id, undefined, "Cannot group: node has no parent");
    return;
  }
  for (const n of nodes) {
    if (n.parent !== parent) {
      sendResponse(id, undefined, "All nodes must share the same parent to be grouped");
      return;
    }
  }

  const group = figma.group(nodes, parent as ChildrenMixin & BaseNode);
  group.name = params.name || "Group";

  sendResponse(id, {
    nodeId: group.id,
    name: group.name,
    childCount: group.children.length,
  });
}

function handleSetConstraints(id: string, params: any) {
  const node = figma.getNodeById(params.nodeId);
  if (!node || node.type === "DOCUMENT" || node.type === "PAGE") {
    sendResponse(id, undefined, `Node ${params.nodeId} not found`);
    return;
  }
  const sceneNode = node as SceneNode;

  if (!("constraints" in sceneNode)) {
    sendResponse(id, undefined, `Node ${params.nodeId} (${sceneNode.type}) does not support constraints`);
    return;
  }

  const constraintNode = sceneNode as ConstraintMixin;
  const current = constraintNode.constraints;

  constraintNode.constraints = {
    horizontal: params.horizontal || current.horizontal,
    vertical: params.vertical || current.vertical,
  };

  sendResponse(id, {
    nodeId: sceneNode.id,
    name: sceneNode.name,
    constraints: constraintNode.constraints,
  });
}
