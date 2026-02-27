(() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __getOwnPropSymbols = Object.getOwnPropertySymbols;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __propIsEnum = Object.prototype.propertyIsEnumerable;
  var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
  var __spreadValues = (a, b) => {
    for (var prop in b || (b = {}))
      if (__hasOwnProp.call(b, prop))
        __defNormalProp(a, prop, b[prop]);
    if (__getOwnPropSymbols)
      for (var prop of __getOwnPropSymbols(b)) {
        if (__propIsEnum.call(b, prop))
          __defNormalProp(a, prop, b[prop]);
      }
    return a;
  };
  var __commonJS = (cb, mod) => function __require() {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  };
  var __async = (__this, __arguments, generator) => {
    return new Promise((resolve, reject) => {
      var fulfilled = (value) => {
        try {
          step(generator.next(value));
        } catch (e) {
          reject(e);
        }
      };
      var rejected = (value) => {
        try {
          step(generator.throw(value));
        } catch (e) {
          reject(e);
        }
      };
      var step = (x) => x.done ? resolve(x.value) : Promise.resolve(x.value).then(fulfilled, rejected);
      step((generator = generator.apply(__this, __arguments)).next());
    });
  };

  // code.ts
  var require_code = __commonJS({
    "code.ts"(exports) {
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
        return effects.map((e) => {
          var _a, _b;
          const base = { type: e.type, visible: e.visible };
          if (e.type === "DROP_SHADOW" || e.type === "INNER_SHADOW") {
            const s = e;
            base.color = s.color;
            base.offset = s.offset;
            base.radius = s.radius;
            base.spread = (_a = s.spread) != null ? _a : 0;
            base.blendMode = s.blendMode;
            base.showShadowBehindNode = (_b = s.showShadowBehindNode) != null ? _b : false;
          } else if (e.type === "LAYER_BLUR" || e.type === "BACKGROUND_BLUR") {
            base.radius = e.radius;
          }
          return base;
        });
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
          const sw = node.strokeWeight;
          details.strokeWeight = sw !== figma.mixed ? sw : "mixed";
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
      figma.ui.onmessage = (msg) => __async(null, null, function* () {
        if (msg.type !== "ws_message") return;
        const { id, action, params } = msg.data;
        try {
          switch (action) {
            // Existing actions
            case "create_frame":
              yield handleCreateFrame(id, params);
              break;
            case "add_text":
              yield handleAddText(id, params);
              break;
            case "add_rectangle":
              yield handleAddRectangle(id, params);
              break;
            case "list_nodes":
              handleListNodes(id);
              break;
            case "list_pages":
              handleListPages(id);
              break;
            case "get_file_info":
              sendResponse(id, { key: figma.fileKey });
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
              yield handleUpdateText(id, params);
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
              yield handleApplyStyle(id, params);
              break;
            case "group_nodes":
              handleGroupNodes(id, params);
              break;
            case "set_constraints":
              handleSetConstraints(id, params);
              break;
            // Phase 5: External Library
            case "import_component_by_key":
              yield handleImportComponentByKey(id, params);
              break;
            case "import_style_by_key":
              yield handleImportStyleByKey(id, params);
              break;
            case "get_instance_info":
              handleGetInstanceInfo(id, params);
              break;
            case "list_library_components":
              yield handleListLibraryComponents(id);
              break;
            // Phase 6: Variable Binding
            case "bind_variable":
              yield handleBindVariable(id, params);
              break;
            case "list_variables":
              handleListVariables(id, params);
              break;
            case "list_library_variables":
              yield handleListLibraryVariables(id, params);
              break;
            case "import_variable_by_key":
              yield handleImportVariableByKey(id, params);
              break;
            case "list_external_references":
              handleListExternalReferences(id);
              break;
            case "find_node_by_name":
              handleFindNodeByName(id, params);
              break;
            case "set_variable_mode":
              yield handleSetVariableMode(id, params);
              break;
            // Phase 7: Variable Creation & Component System
            case "create_variable_collection":
              handleCreateVariableCollection(id, params);
              break;
            case "create_variable":
              handleCreateVariable(id, params);
              break;
            case "set_variable_value":
              handleSetVariableValue(id, params);
              break;
            case "bind_variable_number":
              handleBindVariableNumber(id, params);
              break;
            case "create_component_from_frame":
              handleCreateComponentFromFrame(id, params);
              break;
            case "apply_variable_mode_local":
              handleApplyVariableModeLocal(id, params);
              break;
            default:
              sendResponse(id, void 0, `Unknown action: ${action}`);
          }
        } catch (e) {
          sendResponse(id, void 0, e.message || String(e));
        }
      });
      function handleCreateFrame(id, params) {
        return __async(this, null, function* () {
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
        });
      }
      function handleAddText(id, params) {
        return __async(this, null, function* () {
          const text = figma.createText();
          yield figma.loadFontAsync({ family: "Inter", style: "Regular" });
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
        });
      }
      function handleAddRectangle(id, params) {
        return __async(this, null, function* () {
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
      function handleListPages(id) {
        const pages = figma.root.children.map((p) => ({
          id: p.id,
          name: p.name,
          type: p.type
        }));
        sendResponse(id, { pages });
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
        var _a;
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
        const depth = (_a = params.depth) != null ? _a : 1;
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
        var _a, _b;
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
            const w = (_a = params.width) != null ? _a : sceneNode.width;
            const h = (_b = params.height) != null ? _b : sceneNode.height;
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
        if (params.effects !== void 0 && "effects" in sceneNode) {
          const built = params.effects.map((e) => {
            var _a2, _b2, _c, _d, _e, _f, _g, _h, _i;
            if (e.type === "DROP_SHADOW" || e.type === "INNER_SHADOW") {
              return {
                type: e.type,
                visible: (_a2 = e.visible) != null ? _a2 : true,
                color: (_b2 = e.color) != null ? _b2 : { r: 0, g: 0, b: 0, a: 0.25 },
                offset: (_c = e.offset) != null ? _c : { x: 0, y: 2 },
                radius: (_d = e.radius) != null ? _d : 8,
                spread: (_e = e.spread) != null ? _e : 0,
                blendMode: (_f = e.blendMode) != null ? _f : "NORMAL",
                showShadowBehindNode: (_g = e.showShadowBehindNode) != null ? _g : false
              };
            } else if (e.type === "LAYER_BLUR" || e.type === "BACKGROUND_BLUR") {
              return { type: e.type, visible: (_h = e.visible) != null ? _h : true, radius: (_i = e.radius) != null ? _i : 4 };
            }
            return e;
          });
          sceneNode.effects = built;
        }
        sendResponse(id, getNodeDetails(sceneNode));
      }
      function handleUpdateText(id, params) {
        return __async(this, null, function* () {
          const node = figma.getNodeById(params.nodeId);
          if (!node || node.type !== "TEXT") {
            sendResponse(id, void 0, `Text node ${params.nodeId} not found`);
            return;
          }
          const textNode = node;
          const family = params.fontFamily || (textNode.fontName !== figma.mixed ? textNode.fontName.family : "Inter");
          const style = params.fontWeight || (textNode.fontName !== figma.mixed ? textNode.fontName.style : "Regular");
          yield figma.loadFontAsync({ family, style });
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
        });
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
        sendResponse(id, __spreadValues({ deleted: true }, info));
      }
      function handleCloneNode(id, params) {
        var _a, _b;
        const node = figma.getNodeById(params.nodeId);
        if (!node || node.type === "DOCUMENT" || node.type === "PAGE") {
          sendResponse(id, void 0, `Node ${params.nodeId} not found`);
          return;
        }
        const sceneNode = node;
        const clone = sceneNode.clone();
        clone.x = (_a = params.x) != null ? _a : sceneNode.x + 20;
        clone.y = (_b = params.y) != null ? _b : sceneNode.y;
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
        if (params.paddingTop !== void 0) frame.paddingTop = params.paddingTop;
        if (params.paddingRight !== void 0) frame.paddingRight = params.paddingRight;
        if (params.paddingBottom !== void 0) frame.paddingBottom = params.paddingBottom;
        if (params.paddingLeft !== void 0) frame.paddingLeft = params.paddingLeft;
        if (params.alignItems !== void 0) {
          frame.primaryAxisAlignItems = params.alignItems === "CENTER" ? "CENTER" : params.alignItems === "END" ? "MAX" : "MIN";
          const counterAlign = params.counterAlignItems || params.alignItems;
          frame.counterAxisAlignItems = counterAlign === "CENTER" ? "CENTER" : counterAlign === "END" ? "MAX" : "MIN";
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
      function findComponentsRecursive(node, query, results) {
        if (node.type === "COMPONENT" || node.type === "COMPONENT_SET") {
          if (!query || node.name.toLowerCase().includes(query.toLowerCase())) {
            const info = {
              nodeId: node.id,
              name: node.name,
              type: node.type
            };
            if (node.type === "COMPONENT") {
              const comp = node;
              info.key = comp.key;
              info.width = comp.width;
              info.height = comp.height;
            }
            if (node.type === "COMPONENT_SET") {
              const cs = node;
              info.variantGroupProperties = cs.variantGroupProperties;
              info.children = cs.children.map((c) => ({
                nodeId: c.id,
                name: c.name,
                type: c.type
              }));
            }
            results.push(info);
          }
        }
        if ("children" in node) {
          for (const child of node.children) {
            findComponentsRecursive(child, query, results);
          }
        }
      }
      function handleSearchComponents(id, params) {
        const query = params.query || "";
        const results = [];
        findComponentsRecursive(figma.root, query, results);
        sendResponse(id, { components: results, count: results.length });
      }
      function handleListLibraryComponents(id) {
        return __async(this, null, function* () {
          try {
            const libApi = figma.teamLibrary;
            if (typeof libApi.getAvailableComponentsAsync !== "function") {
              sendResponse(id, void 0, "This version of Figma API does not support listing library components directly.");
              return;
            }
            const components = yield libApi.getAvailableComponentsAsync();
            const results = components.map((c) => ({
              key: c.key,
              name: c.name
            }));
            sendResponse(id, { components: results, count: results.length });
          } catch (e) {
            sendResponse(id, void 0, `Failed to list library components: ${e.message}`);
          }
        });
      }
      function handleCreateInstance(id, params) {
        var _a, _b;
        const node = figma.getNodeById(params.componentId);
        if (!node || node.type !== "COMPONENT") {
          sendResponse(id, void 0, `Component ${params.componentId} not found`);
          return;
        }
        const component = node;
        const instance = component.createInstance();
        instance.x = (_a = params.x) != null ? _a : 0;
        instance.y = (_b = params.y) != null ? _b : 0;
        if (params.parentFrameId) {
          const parent = figma.getNodeById(params.parentFrameId);
          if (parent && "appendChild" in parent) {
            parent.appendChild(instance);
          } else {
            sendResponse(id, void 0, `Parent node ${params.parentFrameId} not found or is not a container`);
            return;
          }
        }
        sendResponse(id, {
          nodeId: instance.id,
          name: instance.name,
          componentId: component.id,
          width: instance.width,
          height: instance.height
        });
      }
      function handleSetVariant(id, params) {
        var _a, _b;
        const node = figma.getNodeById(params.nodeId);
        if (!node || node.type !== "INSTANCE") {
          sendResponse(id, void 0, `Instance node ${params.nodeId} not found`);
          return;
        }
        const instance = node;
        if (params.swapComponentId) {
          const swapTarget = figma.getNodeById(params.swapComponentId);
          if (!swapTarget || swapTarget.type !== "COMPONENT") {
            sendResponse(id, void 0, `Swap target component ${params.swapComponentId} not found`);
            return;
          }
          instance.swapComponent(swapTarget);
        }
        if (params.variantProperties && typeof params.variantProperties === "object") {
          const props = params.variantProperties;
          const keys = Object.keys(props);
          for (let i = 0; i < keys.length; i++) {
            const key = keys[i];
            const value = props[key];
            try {
              instance.setProperties({ [key]: value });
            } catch (e) {
            }
          }
        }
        sendResponse(id, {
          nodeId: instance.id,
          name: instance.name,
          mainComponentId: (_a = instance.mainComponent) == null ? void 0 : _a.id,
          mainComponentName: (_b = instance.mainComponent) == null ? void 0 : _b.name,
          componentProperties: instance.componentProperties
        });
      }
      function handleApplyStyle(id, params) {
        return __async(this, null, function* () {
          const node = figma.getNodeById(params.nodeId);
          if (!node || node.type === "DOCUMENT" || node.type === "PAGE") {
            sendResponse(id, void 0, `Node ${params.nodeId} not found`);
            return;
          }
          const sceneNode = node;
          const applied = [];
          if (params.paintStyleId && "fillStyleId" in sceneNode) {
            try {
              sceneNode.fillStyleId = params.paintStyleId;
              applied.push("paintStyle");
            } catch (e) {
            }
          }
          if (params.strokeStyleId && "strokeStyleId" in sceneNode) {
            try {
              sceneNode.strokeStyleId = params.strokeStyleId;
              applied.push("strokeStyle");
            } catch (e) {
            }
          }
          if (params.textStyleId && node.type === "TEXT") {
            const textNode = node;
            const style = figma.getStyleById(params.textStyleId);
            if (style && style.type === "TEXT") {
              const textStyle = style;
              yield figma.loadFontAsync(textStyle.fontName);
              textNode.textStyleId = params.textStyleId;
              applied.push("textStyle");
            }
          }
          if (params.effectStyleId && "effectStyleId" in sceneNode) {
            try {
              sceneNode.effectStyleId = params.effectStyleId;
              applied.push("effectStyle");
            } catch (e) {
            }
          }
          sendResponse(id, {
            nodeId: sceneNode.id,
            appliedStyles: applied,
            details: getNodeDetails(sceneNode)
          });
        });
      }
      function handleGroupNodes(id, params) {
        const nodeIds = params.nodeIds;
        if (!nodeIds || nodeIds.length < 1) {
          sendResponse(id, void 0, "At least one node ID is required");
          return;
        }
        const nodes = [];
        for (const nid of nodeIds) {
          const n = figma.getNodeById(nid);
          if (!n || n.type === "DOCUMENT" || n.type === "PAGE") {
            sendResponse(id, void 0, `Node ${nid} not found`);
            return;
          }
          nodes.push(n);
        }
        const parent = nodes[0].parent;
        if (!parent) {
          sendResponse(id, void 0, "Cannot group: node has no parent");
          return;
        }
        for (const n of nodes) {
          if (n.parent !== parent) {
            sendResponse(id, void 0, "All nodes must share the same parent to be grouped");
            return;
          }
        }
        const group = figma.group(nodes, parent);
        group.name = params.name || "Group";
        sendResponse(id, {
          nodeId: group.id,
          name: group.name,
          childCount: group.children.length
        });
      }
      function handleSetConstraints(id, params) {
        const node = figma.getNodeById(params.nodeId);
        if (!node || node.type === "DOCUMENT" || node.type === "PAGE") {
          sendResponse(id, void 0, `Node ${params.nodeId} not found`);
          return;
        }
        const sceneNode = node;
        if (!("constraints" in sceneNode)) {
          sendResponse(id, void 0, `Node ${params.nodeId} (${sceneNode.type}) does not support constraints`);
          return;
        }
        const constraintNode = sceneNode;
        const current = constraintNode.constraints;
        constraintNode.constraints = {
          horizontal: params.horizontal || current.horizontal,
          vertical: params.vertical || current.vertical
        };
        sendResponse(id, {
          nodeId: sceneNode.id,
          name: sceneNode.name,
          constraints: constraintNode.constraints
        });
      }
      function loadAllFontsInNode(node) {
        return __async(this, null, function* () {
          if (node.type === "TEXT") {
            const textNode = node;
            const len = textNode.characters.length;
            if (len === 0) {
              const fn = textNode.fontName;
              if (fn !== figma.mixed) yield figma.loadFontAsync(fn);
            } else {
              const loaded = /* @__PURE__ */ new Set();
              for (let i = 0; i < len; i++) {
                const fn = textNode.getRangeFontName(i, i + 1);
                const key = `${fn.family}::${fn.style}`;
                if (!loaded.has(key)) {
                  loaded.add(key);
                  yield figma.loadFontAsync(fn);
                }
              }
            }
          }
          if ("children" in node) {
            for (const child of node.children) {
              yield loadAllFontsInNode(child);
            }
          }
        });
      }
      function handleImportComponentByKey(id, params) {
        return __async(this, null, function* () {
          var _a, _b;
          try {
            const component = yield figma.importComponentByKeyAsync(params.key);
            yield loadAllFontsInNode(component);
            const instance = component.createInstance();
            instance.x = (_a = params.x) != null ? _a : 0;
            instance.y = (_b = params.y) != null ? _b : 0;
            if (params.parentFrameId) {
              const parent = figma.getNodeById(params.parentFrameId);
              if (parent && "appendChild" in parent) {
                parent.appendChild(instance);
              } else {
                sendResponse(id, void 0, `Parent node ${params.parentFrameId} not found or is not a container`);
                return;
              }
            }
            sendResponse(id, {
              nodeId: instance.id,
              name: instance.name,
              componentKey: component.key,
              componentName: component.name,
              width: instance.width,
              height: instance.height
            });
          } catch (e) {
            sendResponse(id, void 0, `Failed to import component: ${e.message}`);
          }
        });
      }
      function handleImportStyleByKey(id, params) {
        return __async(this, null, function* () {
          try {
            const style = yield figma.importStyleByKeyAsync(params.key);
            const node = figma.getNodeById(params.nodeId);
            if (!node || node.type === "DOCUMENT" || node.type === "PAGE") {
              sendResponse(id, void 0, `Node ${params.nodeId} not found`);
              return;
            }
            const sceneNode = node;
            const applied = [];
            if (style.type === "PAINT") {
              if (params.target === "stroke" && "strokeStyleId" in sceneNode) {
                sceneNode.strokeStyleId = style.id;
                applied.push("stroke");
              } else if ("fillStyleId" in sceneNode) {
                sceneNode.fillStyleId = style.id;
                applied.push("fill");
              }
            } else if (style.type === "TEXT" && node.type === "TEXT") {
              const textNode = node;
              const textStyle = style;
              yield figma.loadFontAsync(textStyle.fontName);
              textNode.textStyleId = style.id;
              applied.push("text");
            } else if (style.type === "EFFECT" && "effectStyleId" in sceneNode) {
              sceneNode.effectStyleId = style.id;
              applied.push("effect");
            }
            sendResponse(id, {
              nodeId: sceneNode.id,
              styleName: style.name,
              styleType: style.type,
              appliedTo: applied
            });
          } catch (e) {
            sendResponse(id, void 0, `Failed to import style: ${e.message}`);
          }
        });
      }
      function handleGetInstanceInfo(id, params) {
        const node = figma.getNodeById(params.nodeId);
        if (!node) {
          sendResponse(id, void 0, `Node ${params.nodeId} not found`);
          return;
        }
        if (node.type === "INSTANCE") {
          const instance = node;
          const main = instance.mainComponent;
          sendResponse(id, {
            nodeId: instance.id,
            name: instance.name,
            type: "INSTANCE",
            mainComponent: main ? {
              nodeId: main.id,
              name: main.name,
              key: main.key,
              remote: main.remote,
              parent: main.parent ? { nodeId: main.parent.id, name: main.parent.name, type: main.parent.type } : null
            } : null,
            componentProperties: instance.componentProperties
          });
        } else if (node.type === "COMPONENT") {
          const comp = node;
          sendResponse(id, {
            nodeId: comp.id,
            name: comp.name,
            type: "COMPONENT",
            key: comp.key,
            remote: comp.remote
          });
        } else {
          sendResponse(id, void 0, `Node ${params.nodeId} is ${node.type}, not an INSTANCE or COMPONENT`);
        }
      }
      function handleListVariables(id, params) {
        const collections = figma.variables.getLocalVariableCollections();
        const result = [];
        for (const col of collections) {
          const colInfo = {
            id: col.id,
            name: col.name,
            modes: col.modes.map((m) => ({ modeId: m.modeId, name: m.name })),
            variables: []
          };
          for (const varId of col.variableIds) {
            const v = figma.variables.getVariableById(varId);
            if (!v) continue;
            if (params.resolvedType && v.resolvedType !== params.resolvedType) continue;
            colInfo.variables.push({
              id: v.id,
              name: v.name,
              resolvedType: v.resolvedType
            });
          }
          if (colInfo.variables.length > 0) {
            result.push(colInfo);
          }
        }
        sendResponse(id, { collections: result });
      }
      function handleBindVariable(id, params) {
        return __async(this, null, function* () {
          const node = figma.getNodeById(params.nodeId);
          if (!node || node.type === "DOCUMENT" || node.type === "PAGE") {
            sendResponse(id, void 0, `Node ${params.nodeId} not found`);
            return;
          }
          const sceneNode = node;
          let variable = null;
          if (params.variableId) {
            variable = figma.variables.getVariableById(params.variableId);
          } else if (params.variableKey) {
            try {
              variable = yield figma.variables.importVariableByKeyAsync(params.variableKey);
            } catch (e) {
              sendResponse(id, void 0, `Failed to import variable by key: ${e.message}`);
              return;
            }
          } else if (params.variableName) {
            const collections = figma.variables.getLocalVariableCollections();
            for (const col of collections) {
              for (const varId of col.variableIds) {
                const v = figma.variables.getVariableById(varId);
                if (v && v.name === params.variableName) {
                  variable = v;
                  break;
                }
              }
              if (variable) break;
            }
          }
          if (!variable) {
            sendResponse(id, void 0, `Variable "${params.variableName || params.variableId}" not found. Use list_library_variables to find remote variables, then bind using variableKey.`);
            return;
          }
          const field = params.field || "fills";
          try {
            if (field === "fills" && "fills" in sceneNode) {
              const fills = [figma.variables.setBoundVariableForPaint(
                { type: "SOLID", color: { r: 0, g: 0, b: 0 }, opacity: 1 },
                "color",
                variable
              )];
              sceneNode.fills = fills;
            } else if (field === "strokes" && "strokes" in sceneNode) {
              const strokes = [figma.variables.setBoundVariableForPaint(
                { type: "SOLID", color: { r: 0, g: 0, b: 0 }, opacity: 1 },
                "color",
                variable
              )];
              sceneNode.strokes = strokes;
            } else {
              sendResponse(id, void 0, `Unsupported field: ${field}`);
              return;
            }
            sendResponse(id, {
              nodeId: sceneNode.id,
              name: sceneNode.name,
              boundVariable: variable.name,
              field
            });
          } catch (e) {
            sendResponse(id, void 0, `Failed to bind variable: ${e.message}`);
          }
        });
      }
      function handleListLibraryVariables(id, params) {
        return __async(this, null, function* () {
          try {
            const libApi = figma.teamLibrary;
            if (typeof libApi.getAvailableVariableCollectionsAsync !== "function") {
              sendResponse(id, void 0, "This version of Figma API does not support listing library variable collections.");
              return;
            }
            const collections = yield libApi.getAvailableVariableCollectionsAsync();
            const result = [];
            for (const col of collections) {
              const colInfo = {
                key: col.key,
                name: col.name,
                libraryName: col.libraryName,
                variables: []
              };
              if (typeof libApi.getAvailableVariablesInCollectionAsync === "function") {
                try {
                  const vars = yield libApi.getAvailableVariablesInCollectionAsync(col.key);
                  for (const v of vars) {
                    if (params.resolvedType && v.resolvedType !== params.resolvedType) continue;
                    if (params.nameFilter && !v.name.toLowerCase().includes(params.nameFilter.toLowerCase())) continue;
                    colInfo.variables.push({
                      key: v.key,
                      name: v.name,
                      resolvedType: v.resolvedType
                    });
                  }
                } catch (e) {
                  colInfo.error = `Failed to list variables: ${e.message}`;
                }
              }
              if (params.libraryFilter && !col.libraryName.toLowerCase().includes(params.libraryFilter.toLowerCase())) continue;
              if (colInfo.variables.length > 0 || !params.resolvedType) {
                result.push(colInfo);
              }
            }
            sendResponse(id, { collections: result, count: result.length });
          } catch (e) {
            sendResponse(id, void 0, `Failed to list library variables: ${e.message}`);
          }
        });
      }
      function handleImportVariableByKey(id, params) {
        return __async(this, null, function* () {
          try {
            const variable = yield figma.variables.importVariableByKeyAsync(params.key);
            sendResponse(id, {
              id: variable.id,
              name: variable.name,
              key: variable.key,
              resolvedType: variable.resolvedType
            });
          } catch (e) {
            sendResponse(id, void 0, `Failed to import variable: ${e.message}`);
          }
        });
      }
      function handleListExternalReferences(id) {
        const externalKeys = /* @__PURE__ */ new Set();
        const externalFiles = /* @__PURE__ */ new Map();
        function traverse(node) {
          if (node.type === "INSTANCE") {
            const instance = node;
            const main = instance.mainComponent;
            if (main && main.remote) {
              externalKeys.add(main.key);
            }
          } else if (node.type === "COMPONENT") {
            const comp = node;
            if (comp.remote) {
              externalKeys.add(comp.key);
            }
          }
          if ("children" in node) {
            for (const child of node.children) {
              traverse(child);
            }
          }
        }
        traverse(figma.root);
        const paintStyles = figma.getLocalPaintStyles();
        paintStyles.forEach((s) => {
          if (s.remote) {
            if (s.key) externalKeys.add(s.key);
          }
        });
        sendResponse(id, { keys: Array.from(externalKeys) });
      }
      function handleFindNodeByName(id, params) {
        const query = params.query;
        const results = [];
        function traverse(node) {
          if (node.name.toLowerCase().includes(query.toLowerCase())) {
            results.push({
              nodeId: node.id,
              name: node.name,
              type: node.type
            });
          }
          if ("children" in node) {
            for (const child of node.children) {
              traverse(child);
            }
          }
        }
        traverse(figma.root);
        sendResponse(id, { nodes: results });
      }
      function handleSetVariableMode(id, params) {
        return __async(this, null, function* () {
          const node = figma.getNodeById(params.nodeId);
          if (!node) {
            sendResponse(id, void 0, `Node ${params.nodeId} not found`);
            return;
          }
          try {
            const collection = yield figma.variables.importVariableCollectionByKeyAsync(params.collectionKey);
            let modeId = params.modeId;
            if (!modeId && params.modeName) {
              const mode = collection.modes.find((m) => m.name.toLowerCase().includes(params.modeName.toLowerCase()));
              if (!mode) {
                sendResponse(id, void 0, `Mode "${params.modeName}" not found`);
                return;
              }
              modeId = mode.modeId;
            }
            figma.variables.setVariableModeOnNode(node, collection, modeId);
            sendResponse(id, { nodeId: params.nodeId, collectionKey: params.collectionKey, modeId });
          } catch (e) {
            sendResponse(id, void 0, `set_variable_mode failed: ${e.message}`);
          }
        });
      }
      function handleCreateVariableCollection(id, params) {
        try {
          const collection = figma.variables.createVariableCollection(params.name);
          const modes = params.modes || [];
          if (modes.length > 0) {
            collection.renameMode(collection.modes[0].modeId, modes[0]);
            for (let i = 1; i < modes.length; i++) {
              collection.addMode(modes[i]);
            }
          }
          sendResponse(id, {
            id: collection.id,
            name: collection.name,
            modes: collection.modes.map((m) => ({ modeId: m.modeId, name: m.name }))
          });
        } catch (e) {
          sendResponse(id, void 0, `create_variable_collection failed: ${e.message}`);
        }
      }
      function handleCreateVariable(id, params) {
        try {
          const collection = figma.variables.getVariableCollectionById(params.collectionId);
          if (!collection) {
            sendResponse(id, void 0, `Collection ${params.collectionId} not found`);
            return;
          }
          const variable = figma.variables.createVariable(params.name, collection, params.type || "NUMBER");
          sendResponse(id, {
            id: variable.id,
            name: variable.name,
            resolvedType: variable.resolvedType
          });
        } catch (e) {
          sendResponse(id, void 0, `create_variable failed: ${e.message}`);
        }
      }
      function handleSetVariableValue(id, params) {
        try {
          const variable = figma.variables.getVariableById(params.variableId);
          if (!variable) {
            sendResponse(id, void 0, `Variable ${params.variableId} not found`);
            return;
          }
          variable.setValueForMode(params.modeId, params.value);
          sendResponse(id, { variableId: params.variableId, modeId: params.modeId, value: params.value });
        } catch (e) {
          sendResponse(id, void 0, `set_variable_value failed: ${e.message}`);
        }
      }
      function handleBindVariableNumber(id, params) {
        try {
          const node = figma.getNodeById(params.nodeId);
          if (!node) {
            sendResponse(id, void 0, `Node ${params.nodeId} not found`);
            return;
          }
          const variable = figma.variables.getVariableById(params.variableId);
          if (!variable) {
            sendResponse(id, void 0, `Variable ${params.variableId} not found`);
            return;
          }
          node.setBoundVariable(params.field, variable);
          sendResponse(id, { nodeId: params.nodeId, field: params.field, variableId: params.variableId });
        } catch (e) {
          sendResponse(id, void 0, `bind_variable_number failed: ${e.message}`);
        }
      }
      function handleCreateComponentFromFrame(id, params) {
        try {
          const node = figma.getNodeById(params.nodeId);
          if (!node || node.type !== "FRAME" && node.type !== "GROUP") {
            sendResponse(id, void 0, `Node ${params.nodeId} is not a FRAME or GROUP`);
            return;
          }
          const component = figma.createComponentFromNode(node);
          sendResponse(id, {
            componentId: component.id,
            name: component.name,
            key: component.key
          });
        } catch (e) {
          sendResponse(id, void 0, `create_component_from_frame failed: ${e.message}`);
        }
      }
      function handleApplyVariableModeLocal(id, params) {
        try {
          const node = figma.getNodeById(params.nodeId);
          if (!node) {
            sendResponse(id, void 0, `Node ${params.nodeId} not found`);
            return;
          }
          const collection = figma.variables.getVariableCollectionById(params.collectionId);
          if (!collection) {
            sendResponse(id, void 0, `Collection ${params.collectionId} not found`);
            return;
          }
          node.setExplicitVariableModeForCollection(collection, params.modeId);
          sendResponse(id, { nodeId: params.nodeId, collectionId: params.collectionId, modeId: params.modeId });
        } catch (e) {
          sendResponse(id, void 0, `apply_variable_mode_local failed: ${e.message}`);
        }
      }
    }
  });
  require_code();
})();
