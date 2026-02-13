"use strict";
var __plugin = (() => {
  // figma-plugin/code.ts
  figma.showUI(__html__, { width: 320, height: 340 });
  function sendResponse(id, result, error) {
    const response = { id };
    if (error) response.error = error;
    else response.result = result;
    figma.ui.postMessage({ type: "ws_response", data: response });
  }
  function extractFills(node) {
    if (!("fills" in node)) return void 0;
    const fills = node.fills;
    if (fills === figma.mixed || !Array.isArray(fills)) return void 0;
    return fills.map((f) => {
      if (f.type === "SOLID") {
        const s = f;
        return {
          type: "SOLID",
          color: { r: s.color.r, g: s.color.g, b: s.color.b },
          opacity: s.opacity
        };
      }
      return { type: f.type };
    });
  }
  function extractStrokes(node) {
    if (!("strokes" in node)) return void 0;
    const strokes = node.strokes;
    if (!Array.isArray(strokes)) return void 0;
    return strokes.map((s) => {
      if (s.type === "SOLID") {
        const solid = s;
        return {
          type: "SOLID",
          color: { r: solid.color.r, g: solid.color.g, b: solid.color.b },
          opacity: solid.opacity
        };
      }
      return { type: s.type };
    });
  }
  function extractEffects(node) {
    if (!("effects" in node)) return void 0;
    const effects = node.effects;
    if (!Array.isArray(effects)) return void 0;
    return effects.map((e) => ({
      type: e.type,
      visible: e.visible
    }));
  }
  function extractTextProps(node) {
    return {
      characters: node.characters,
      fontSize: node.fontSize !== figma.mixed ? node.fontSize : "mixed",
      fontName: node.fontName !== figma.mixed ? node.fontName : "mixed",
      textAlignHorizontal: node.textAlignHorizontal,
      textAlignVertical: node.textAlignVertical,
      lineHeight: node.lineHeight !== figma.mixed ? node.lineHeight : "mixed",
      letterSpacing: node.letterSpacing !== figma.mixed ? node.letterSpacing : "mixed"
    };
  }
  function getNodeSummary(node) {
    const summary = {
      nodeId: node.id,
      name: node.name,
      type: node.type,
      x: node.x,
      y: node.y,
      visible: node.visible,
      opacity: "opacity" in node ? node.opacity : void 0
    };
    if ("width" in node) summary.width = node.width;
    if ("height" in node) summary.height = node.height;
    summary.fills = extractFills(node);
    return summary;
  }
  function getNodeDetails(node) {
    const details = {
      nodeId: node.id,
      name: node.name,
      type: node.type,
      x: node.x,
      y: node.y,
      visible: node.visible,
      locked: node.locked
    };
    if ("width" in node) details.width = node.width;
    if ("height" in node) details.height = node.height;
    if ("opacity" in node) details.opacity = node.opacity;
    if ("cornerRadius" in node) {
      details.cornerRadius = node.cornerRadius !== figma.mixed ? node.cornerRadius : "mixed";
    }
    details.fills = extractFills(node);
    details.strokes = extractStrokes(node);
    details.effects = extractEffects(node);
    if ("strokeWeight" in node) {
      details.strokeWeight = node.strokeWeight;
    }
    if (node.type === "TEXT") {
      Object.assign(details, extractTextProps(node));
    }
    if ("children" in node) {
      details.children = node.children.map((c) => ({
        nodeId: c.id,
        name: c.name,
        type: c.type
      }));
    }
    return details;
  }
  function getChildrenRecursive(node, depth) {
    const info = getNodeSummary(node);
    if (depth > 0 && "children" in node) {
      info.children = node.children.map(
        (c) => getChildrenRecursive(c, depth - 1)
      );
    }
    return info;
  }
  figma.ui.onmessage = async (msg) => {
    if (msg.type !== "ws_message") return;
    const { id, action, params } = msg.data;
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
        default:
          sendResponse(id, void 0, `Unknown action: ${action}`);
      }
    } catch (e) {
      sendResponse(id, void 0, e.message || String(e));
    }
  };
  async function handleCreateFrame(id, params) {
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
      height: frame.height
    });
  }
  async function handleAddText(id, params) {
    const text = figma.createText();
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
        parent.appendChild(text);
      } else {
        sendResponse(id, void 0, `Parent node ${params.parentFrameId} not found or is not a container`);
        return;
      }
    }
    sendResponse(id, {
      nodeId: text.id,
      characters: text.characters,
      fontSize: text.fontSize
    });
  }
  async function handleAddRectangle(id, params) {
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
        parent.appendChild(rect);
      } else {
        sendResponse(id, void 0, `Parent node ${params.parentFrameId} not found or is not a container`);
        return;
      }
    }
    sendResponse(id, {
      nodeId: rect.id,
      width: rect.width,
      height: rect.height
    });
  }
  function handleListNodes(id) {
    const nodes = figma.currentPage.children.map((node) => ({
      nodeId: node.id,
      name: node.name,
      type: node.type,
      x: node.x,
      y: node.y,
      width: "width" in node ? node.width : void 0,
      height: "height" in node ? node.height : void 0
    }));
    sendResponse(id, { nodes });
  }
  function handleGetNodeDetails(id, params) {
    const node = figma.getNodeById(params.nodeId);
    if (!node || node.type === "DOCUMENT" || node.type === "PAGE") {
      sendResponse(id, void 0, `Node ${params.nodeId} not found`);
      return;
    }
    sendResponse(id, getNodeDetails(node));
  }
  function handleGetChildren(id, params) {
    const node = figma.getNodeById(params.nodeId);
    if (!node || node.type === "DOCUMENT" || node.type === "PAGE") {
      sendResponse(id, void 0, `Node ${params.nodeId} not found`);
      return;
    }
    const sceneNode = node;
    if (!("children" in sceneNode)) {
      sendResponse(id, void 0, `Node ${params.nodeId} (${sceneNode.type}) has no children`);
      return;
    }
    const depth = params.depth ?? 1;
    const children = sceneNode.children.map(
      (c) => getChildrenRecursive(c, depth - 1)
    );
    sendResponse(id, { nodeId: params.nodeId, children });
  }
  function handleGetSelection(id) {
    const selection = figma.currentPage.selection;
    if (selection.length === 0) {
      sendResponse(id, { selection: [] });
      return;
    }
    const details = selection.map((node) => getNodeDetails(node));
    sendResponse(id, { selection: details });
  }
  function handleGetStyles(id) {
    const paintStyles = figma.getLocalPaintStyles().map((s) => ({
      id: s.id,
      name: s.name,
      paints: s.paints.map((p) => {
        if (p.type === "SOLID") {
          const solid = p;
          return {
            type: "SOLID",
            color: { r: solid.color.r, g: solid.color.g, b: solid.color.b },
            opacity: solid.opacity
          };
        }
        return { type: p.type };
      })
    }));
    const textStyles = figma.getLocalTextStyles().map((s) => ({
      id: s.id,
      name: s.name,
      fontSize: s.fontSize,
      fontName: s.fontName,
      lineHeight: s.lineHeight,
      letterSpacing: s.letterSpacing,
      textCase: s.textCase,
      textDecoration: s.textDecoration
    }));
    const effectStyles = figma.getLocalEffectStyles().map((s) => ({
      id: s.id,
      name: s.name,
      effects: s.effects.map((e) => ({
        type: e.type,
        visible: e.visible
      }))
    }));
    sendResponse(id, { paintStyles, textStyles, effectStyles });
  }
  function handleUpdateNode(id, params) {
    const node = figma.getNodeById(params.nodeId);
    if (!node || node.type === "DOCUMENT" || node.type === "PAGE") {
      sendResponse(id, void 0, `Node ${params.nodeId} not found`);
      return;
    }
    const sceneNode = node;
    if (params.name !== void 0) sceneNode.name = params.name;
    if (params.x !== void 0) sceneNode.x = params.x;
    if (params.y !== void 0) sceneNode.y = params.y;
    if (params.visible !== void 0) sceneNode.visible = params.visible;
    if (params.width !== void 0 || params.height !== void 0) {
      if ("resize" in sceneNode) {
        const w = params.width ?? sceneNode.width;
        const h = params.height ?? sceneNode.height;
        sceneNode.resize(w, h);
      }
    }
    if (params.opacity !== void 0 && "opacity" in sceneNode) {
      sceneNode.opacity = params.opacity;
    }
    if (params.fillColor && "fills" in sceneNode) {
      sceneNode.fills = [{ type: "SOLID", color: params.fillColor }];
    }
    if (params.cornerRadius !== void 0 && "cornerRadius" in sceneNode) {
      sceneNode.cornerRadius = params.cornerRadius;
    }
    if (params.strokeColor && "strokes" in sceneNode) {
      sceneNode.strokes = [{ type: "SOLID", color: params.strokeColor }];
    }
    if (params.strokeWeight !== void 0 && "strokeWeight" in sceneNode) {
      sceneNode.strokeWeight = params.strokeWeight;
    }
    sendResponse(id, getNodeDetails(sceneNode));
  }
  async function handleUpdateText(id, params) {
    const node = figma.getNodeById(params.nodeId);
    if (!node || node.type !== "TEXT") {
      sendResponse(id, void 0, `Text node ${params.nodeId} not found`);
      return;
    }
    const textNode = node;
    const family = params.fontFamily || (textNode.fontName !== figma.mixed ? textNode.fontName.family : "Inter");
    const style = params.fontWeight || (textNode.fontName !== figma.mixed ? textNode.fontName.style : "Regular");
    await figma.loadFontAsync({ family, style });
    if (params.text !== void 0) textNode.characters = params.text;
    if (params.fontSize !== void 0) textNode.fontSize = params.fontSize;
    if (params.fontFamily !== void 0 || params.fontWeight !== void 0) {
      textNode.fontName = { family, style };
    }
    if (params.fillColor) {
      textNode.fills = [{ type: "SOLID", color: params.fillColor }];
    }
    if (params.textAlign !== void 0) {
      textNode.textAlignHorizontal = params.textAlign;
    }
    if (params.lineHeight !== void 0) {
      textNode.lineHeight = typeof params.lineHeight === "number" ? { value: params.lineHeight, unit: "PIXELS" } : params.lineHeight;
    }
    if (params.letterSpacing !== void 0) {
      textNode.letterSpacing = typeof params.letterSpacing === "number" ? { value: params.letterSpacing, unit: "PIXELS" } : params.letterSpacing;
    }
    sendResponse(id, getNodeDetails(textNode));
  }
  function handleDeleteNode(id, params) {
    const node = figma.getNodeById(params.nodeId);
    if (!node || node.type === "DOCUMENT" || node.type === "PAGE") {
      sendResponse(id, void 0, `Node ${params.nodeId} not found`);
      return;
    }
    const sceneNode = node;
    const info = { nodeId: sceneNode.id, name: sceneNode.name, type: sceneNode.type };
    sceneNode.remove();
    sendResponse(id, { deleted: true, ...info });
  }
  function handleCloneNode(id, params) {
    const node = figma.getNodeById(params.nodeId);
    if (!node || node.type === "DOCUMENT" || node.type === "PAGE") {
      sendResponse(id, void 0, `Node ${params.nodeId} not found`);
      return;
    }
    const sceneNode = node;
    const clone = sceneNode.clone();
    clone.x = params.x ?? sceneNode.x + 20;
    clone.y = params.y ?? sceneNode.y;
    sendResponse(id, getNodeDetails(clone));
  }
  function handleMoveNode(id, params) {
    const node = figma.getNodeById(params.nodeId);
    if (!node || node.type === "DOCUMENT" || node.type === "PAGE") {
      sendResponse(id, void 0, `Node ${params.nodeId} not found`);
      return;
    }
    const parentNode = figma.getNodeById(params.parentId);
    if (!parentNode || !("appendChild" in parentNode)) {
      sendResponse(id, void 0, `Parent node ${params.parentId} not found or is not a container`);
      return;
    }
    const sceneNode = node;
    parentNode.appendChild(sceneNode);
    if (params.x !== void 0) sceneNode.x = params.x;
    if (params.y !== void 0) sceneNode.y = params.y;
    sendResponse(id, getNodeDetails(sceneNode));
  }
  function handleAddEllipse(id, params) {
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
        parent.appendChild(ellipse);
      } else {
        sendResponse(id, void 0, `Parent node ${params.parentFrameId} not found or is not a container`);
        return;
      }
    }
    sendResponse(id, {
      nodeId: ellipse.id,
      width: ellipse.width,
      height: ellipse.height
    });
  }
  function handleAddLine(id, params) {
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
        parent.appendChild(line);
      } else {
        sendResponse(id, void 0, `Parent node ${params.parentFrameId} not found or is not a container`);
        return;
      }
    }
    sendResponse(id, {
      nodeId: line.id,
      length,
      angle
    });
  }
  function handleSetAutoLayout(id, params) {
    const node = figma.getNodeById(params.nodeId);
    if (!node || !("layoutMode" in node)) {
      sendResponse(id, void 0, `Node ${params.nodeId} not found or does not support auto layout`);
      return;
    }
    const frame = node;
    frame.layoutMode = params.direction || "VERTICAL";
    if (params.spacing !== void 0) frame.itemSpacing = params.spacing;
    if (params.padding !== void 0) {
      frame.paddingTop = params.padding;
      frame.paddingRight = params.padding;
      frame.paddingBottom = params.padding;
      frame.paddingLeft = params.padding;
    }
    if (params.alignItems !== void 0) {
      frame.primaryAxisAlignItems = params.alignItems === "CENTER" ? "CENTER" : params.alignItems === "END" ? "MAX" : "MIN";
      frame.counterAxisAlignItems = params.alignItems === "CENTER" ? "CENTER" : params.alignItems === "END" ? "MAX" : "MIN";
    }
    sendResponse(id, {
      nodeId: frame.id,
      name: frame.name,
      layoutMode: frame.layoutMode,
      itemSpacing: frame.itemSpacing,
      paddingTop: frame.paddingTop,
      paddingRight: frame.paddingRight,
      paddingBottom: frame.paddingBottom,
      paddingLeft: frame.paddingLeft
    });
  }
})();
