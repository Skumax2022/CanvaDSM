"use strict";
var CanvasEngine = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // lib/canvas/standalone-entry.ts
  var standalone_entry_exports = {};
  __export(standalone_entry_exports, {
    LAYOUT_GAP: () => LAYOUT_GAP,
    LAYOUT_PAD: () => LAYOUT_PAD,
    NESTED_HEADER_H: () => NESTED_HEADER_H,
    applyDropIntent: () => applyDropIntent,
    beginDrag: () => beginDrag,
    canvasPosFromClient: () => canvasPosFromClient,
    clientToCanvas: () => clientToCanvas,
    createBrowserDomAdapter: () => createBrowserDomAdapter,
    isCanvasChild: () => isCanvasChild,
    isDraggingNode: () => isDraggingNode,
    isNestedChild: () => isNestedChild,
    layoutItemsFromChildren: () => layoutItemsFromChildren,
    measureContainerSize: () => measureContainerSize,
    minInnerWidthFor: () => minInnerWidthFor,
    resolveDrop: () => resolveDrop,
    sortChildrenByOrder: () => sortChildrenByOrder,
    syncAllContainerLayouts: () => syncAllContainerLayouts,
    syncContainerBranch: () => syncContainerBranch,
    toVisual: () => toVisual,
    updateDrag: () => updateDrag,
    viewParentFromPath: () => viewParentFromPath
  });

  // lib/canvas/index.ts
  var index_exports = {};
  __export(index_exports, {
    DRAG_THRESHOLD_PX: () => DRAG_THRESHOLD_PX,
    LAYOUT_GAP: () => LAYOUT_GAP,
    LAYOUT_PAD: () => LAYOUT_PAD,
    NESTED_HEADER_H: () => NESTED_HEADER_H,
    applyDropIntent: () => applyDropIntent,
    beginDrag: () => beginDrag,
    bodyLocalFromClient: () => bodyLocalFromClient,
    bodyPosFromClient: () => bodyPosFromClient,
    canAcceptChildren: () => canAcceptChildren,
    canvasPosFromClient: () => canvasPosFromClient,
    clientToCanvas: () => clientToCanvas,
    createBrowserDomAdapter: () => createBrowserDomAdapter,
    innerBodyWidth: () => innerBodyWidth,
    insertIndexInParent: () => insertIndexInParent,
    isCanvasChild: () => isCanvasChild,
    isContainer: () => isContainer,
    isDraggingNode: () => isDraggingNode,
    isGhostInParent: () => isGhostInParent,
    isNestedChild: () => isNestedChild,
    isValidNestTarget: () => isValidNestTarget,
    layoutItemsFromChildren: () => layoutItemsFromChildren,
    measureContainerSize: () => measureContainerSize,
    minInnerWidthFor: () => minInnerWidthFor,
    nodeCanvasOriginFromScreen: () => nodeCanvasOriginFromScreen,
    pointInRect: () => pointInRect,
    resolveDrop: () => resolveDrop,
    screenToBodyLocal: () => screenToBodyLocal,
    sortChildrenByOrder: () => sortChildrenByOrder,
    syncAllContainerLayouts: () => syncAllContainerLayouts,
    syncContainerBranch: () => syncContainerBranch,
    toVisual: () => toVisual,
    updateDrag: () => updateDrag,
    viewParentFromPath: () => viewParentFromPath
  });

  // lib/canvas/types.ts
  var DRAG_THRESHOLD_PX = 4;

  // lib/canvas/view.ts
  function viewParentFromPath(path) {
    return path.length ? path[path.length - 1] : null;
  }
  function isCanvasChild(nodeParentId, viewParentId) {
    return nodeParentId === viewParentId;
  }
  function isNestedChild(nodeParentId, viewParentId) {
    return nodeParentId != null && nodeParentId !== viewParentId;
  }
  function isContainer(node) {
    return node?.type === "SPACE" || node?.type === "RECTANGLE";
  }
  function canAcceptChildren(node) {
    return isContainer(node);
  }
  function isValidNestTarget(nodes, targetId, forbidden) {
    if (forbidden.has(targetId)) return false;
    return canAcceptChildren(nodes[targetId]);
  }

  // lib/tree.ts
  function childrenOf(nodes, parentId) {
    return Object.values(nodes).filter((n) => n.parentId === parentId);
  }
  function descendantIds(nodes, id) {
    const out = [];
    const stack = childrenOf(nodes, id).map((n) => n.id);
    while (stack.length) {
      const cur = stack.pop();
      out.push(cur);
      for (const c of childrenOf(nodes, cur)) stack.push(c.id);
    }
    return out;
  }
  function isAncestor(nodes, maybeAncestor, id) {
    let cur = nodes[id]?.parentId ?? null;
    while (cur) {
      if (cur === maybeAncestor) return true;
      cur = nodes[cur]?.parentId ?? null;
    }
    return false;
  }

  // lib/auto-layout.ts
  var LAYOUT_GAP = 12;
  var LAYOUT_PAD = 12;
  var NESTED_HEADER_H = 36;
  var NESTED_BODY_MIN = 48;
  var MAX_SINGLE_ROW_WIDTH = 960;
  function childSortKey(node) {
    if (node.ui_order != null) return node.ui_order;
    return node.ui_position.x * 1e3 + node.ui_position.y;
  }
  function sortChildrenByOrder(children) {
    return children.slice().sort((a, b) => childSortKey(a) - childSortKey(b));
  }
  function nextChildOrder(children) {
    if (!children.length) return 0;
    return Math.max(...children.map((c) => c.ui_order ?? childSortKey(c))) + 1;
  }
  function isLayoutContainer(node, nodes) {
    if (node.type !== "RECTANGLE" && node.type !== "SPACE") return false;
    return childrenOf(nodes, node.id).length > 0;
  }
  function minInnerWidthFor(node) {
    return node.type === "SPACE" ? 280 : 220;
  }
  function maxItemWidth(items) {
    if (!items.length) return 0;
    return Math.max(...items.map((i) => i.w));
  }
  function sumRowWidth(items, gap = LAYOUT_GAP) {
    return items.reduce((s, c, i) => s + c.w + (i ? gap : 0), 0);
  }
  function computeFlexLayout(items, innerWidth, gap = LAYOUT_GAP) {
    if (!items.length) {
      return { width: innerWidth, height: NESTED_BODY_MIN, rowWidths: [] };
    }
    let x = 0;
    let y = 0;
    let rowH = 0;
    const rowWidths = [];
    let currentRowW = 0;
    for (const item of items) {
      if (x > 0 && x + item.w > innerWidth) {
        rowWidths.push(currentRowW);
        y += rowH + gap;
        x = 0;
        rowH = 0;
        currentRowW = 0;
      }
      rowH = Math.max(rowH, item.h);
      x += item.w + gap;
      currentRowW = x > 0 ? x - gap : 0;
    }
    if (currentRowW > 0 || items.length > 0) {
      rowWidths.push(currentRowW);
    }
    const maxRowW = rowWidths.length ? Math.max(...rowWidths) : 0;
    const contentH = y + rowH;
    return {
      width: Math.max(innerWidth, maxRowW),
      height: Math.max(NESTED_BODY_MIN, contentH),
      rowWidths
    };
  }
  function resolveWrapWidth(items, minInnerWidth) {
    if (!items.length) return minInnerWidth;
    const oneRowW = sumRowWidth(items);
    const floorW = Math.max(minInnerWidth, maxItemWidth(items));
    if (oneRowW <= MAX_SINGLE_ROW_WIDTH) {
      return Math.max(floorW, oneRowW);
    }
    return floorW;
  }
  function measureContainerSizeFromItems(items, minInnerWidth = 240) {
    if (!items.length) {
      const pad2 = LAYOUT_PAD * 2;
      return {
        bodyWidth: minInnerWidth,
        bodyHeight: NESTED_BODY_MIN,
        containerWidth: minInnerWidth + pad2,
        containerHeight: NESTED_BODY_MIN + pad2 + NESTED_HEADER_H
      };
    }
    const wrapW = resolveWrapWidth(items, minInnerWidth);
    let layout = computeFlexLayout(items, wrapW);
    if (layout.width > wrapW) {
      layout = computeFlexLayout(items, layout.width);
    }
    const pad = LAYOUT_PAD * 2;
    return {
      bodyWidth: layout.width,
      bodyHeight: layout.height,
      containerWidth: layout.width + pad,
      containerHeight: layout.height + pad + NESTED_HEADER_H
    };
  }
  function measureContainerSize(children, minInnerWidth = 240) {
    const sorted = sortChildrenByOrder(children);
    const items = sorted.map((c) => ({ id: c.id, w: c.ui_size.width, h: c.ui_size.height }));
    return measureContainerSizeFromItems(items, minInnerWidth);
  }
  function nodeDepth(nodes, id) {
    let depth = 0;
    let cur = nodes[id]?.parentId ?? null;
    while (cur) {
      depth += 1;
      cur = nodes[cur]?.parentId ?? null;
    }
    return depth;
  }
  function syncAllContainerLayouts(nodes) {
    const out = { ...nodes };
    const ids = Object.keys(out).sort(
      (a, b) => nodeDepth(out, b) - nodeDepth(out, a)
    );
    for (const id of ids) {
      const node = out[id];
      if (!isLayoutContainer(node, out)) continue;
      const ch = sortChildrenByOrder(childrenOf(out, id));
      const sized = measureContainerSize(ch, minInnerWidthFor(node));
      out[id] = {
        ...node,
        ui_size: { width: sized.containerWidth, height: sized.containerHeight }
      };
    }
    return out;
  }
  function findInsertIndex(items, innerWidth, localX, localY) {
    if (!items.length) return 0;
    let x = 0;
    let y = 0;
    let rowH = 0;
    let index = 0;
    for (const item of items) {
      if (x > 0 && x + item.w > innerWidth) {
        y += rowH + LAYOUT_GAP;
        x = 0;
        rowH = 0;
      }
      const midX = x + item.w / 2;
      const rowBottom = y + item.h;
      if (localY < y + item.h * 0.35) return index;
      if (localY <= rowBottom + 4 && localX < midX) return index;
      rowH = Math.max(rowH, item.h);
      x += item.w + LAYOUT_GAP;
      index += 1;
    }
    return index;
  }
  function layoutItemsFromChildren(children) {
    return sortChildrenByOrder(children).map((c) => ({
      id: c.id,
      w: c.ui_size.width,
      h: c.ui_size.height
    }));
  }
  function applyReorder(parentChildren, childId, newIndex) {
    const sorted = sortChildrenByOrder(parentChildren);
    const moving = sorted.find((c) => c.id === childId);
    if (!moving) return sorted;
    const rest = sorted.filter((c) => c.id !== childId);
    const idx = Math.max(0, Math.min(newIndex, rest.length));
    rest.splice(idx, 0, moving);
    return rest.map((c, i) => ({ ...c, ui_order: i, ui_position: { x: 0, y: 0 } }));
  }
  function syncContainerBranch(nodes, startId) {
    let out = { ...nodes };
    const chain = [];
    let cur = startId;
    while (cur) {
      chain.push(cur);
      cur = out[cur]?.parentId ?? null;
    }
    chain.sort((a, b) => nodeDepth(out, b) - nodeDepth(out, a));
    for (const id of chain) {
      const node = out[id];
      if (!isLayoutContainer(node, out)) continue;
      const ch = sortChildrenByOrder(childrenOf(out, id));
      const sized = measureContainerSize(ch, minInnerWidthFor(node));
      out[id] = { ...node, ui_size: { width: sized.containerWidth, height: sized.containerHeight } };
    }
    return out;
  }

  // lib/canvas/coords.ts
  function pointInRect(clientX, clientY, rect) {
    const right = rect.right ?? rect.left + (rect.width ?? 0);
    const bottom = rect.bottom ?? rect.top + (rect.height ?? 0);
    return clientX >= rect.left && clientX <= right && clientY >= rect.top && clientY <= bottom;
  }
  function clientToCanvas(clientX, clientY, viewport) {
    const { rect, camera } = viewport;
    return {
      x: (clientX - rect.left - camera.x) / camera.zoom,
      y: (clientY - rect.top - camera.y) / camera.zoom
    };
  }
  function canvasPosFromClient(clientX, clientY, viewport, grabCanvas) {
    const pt = clientToCanvas(clientX, clientY, viewport);
    return { x: pt.x - grabCanvas.x, y: pt.y - grabCanvas.y };
  }
  function bodyLocalFromClient(clientX, clientY, body, zoom) {
    return {
      x: (clientX - body.left) / zoom - LAYOUT_PAD,
      y: (clientY - body.top) / zoom - LAYOUT_PAD
    };
  }
  function bodyPosFromClient(clientX, clientY, body, zoom, grabBody) {
    const local = bodyLocalFromClient(clientX, clientY, body, zoom);
    return { x: local.x - grabBody.x, y: local.y - grabBody.y };
  }
  function nodeCanvasOriginFromScreen(screenLeft, screenTop, viewport) {
    return clientToCanvas(screenLeft, screenTop, viewport);
  }
  function screenToBodyLocal(screenLeft, screenTop, body, zoom) {
    return {
      x: (screenLeft - body.left) / zoom,
      y: (screenTop - body.top) / zoom
    };
  }

  // lib/canvas/layout-query.ts
  function innerBodyWidth(nodes, parentId) {
    const parent = nodes[parentId];
    if (!parent) return 240;
    const ch = childrenOf(nodes, parentId);
    return measureContainerSize(ch, minInnerWidthFor(parent)).bodyWidth;
  }
  function insertIndexInParent(nodes, parentId, excludeChildId, localX, localY) {
    const siblings = sortChildrenByOrder(childrenOf(nodes, parentId)).filter(
      (c) => c.id !== excludeChildId
    );
    const items = layoutItemsFromChildren(siblings);
    const innerW = innerBodyWidth(nodes, parentId);
    return findInsertIndex(items, innerW, localX, localY);
  }

  // lib/canvas/drag-session.ts
  function dragModeFor(nodeParentId, viewParentId) {
    return isNestedChild(nodeParentId, viewParentId) ? "nested" : "canvas";
  }
  function buildForbidden(nodes, rootIds) {
    const forbidden = /* @__PURE__ */ new Set();
    for (const id of rootIds) {
      forbidden.add(id);
      for (const d of descendantIds(nodes, id)) forbidden.add(d);
    }
    return forbidden;
  }
  function collectDragIds(nodeId, selectedIds, nodes, viewParentId) {
    const node = nodes[nodeId];
    if (!node) return [nodeId];
    if (selectedIds.includes(nodeId) && selectedIds.length > 1) {
      const sameParent = selectedIds.filter((id) => nodes[id]?.parentId === node.parentId);
      return sameParent.includes(nodeId) ? sameParent : [nodeId];
    }
    return [nodeId];
  }
  function beginDrag(input) {
    const {
      nodeId,
      selectedIds,
      nodes,
      viewParentId,
      pointerId,
      clientX,
      clientY,
      nodeScreenRect,
      viewport,
      dom
    } = input;
    const node = nodes[nodeId];
    const nodeIds = collectDragIds(nodeId, selectedIds, nodes, viewParentId);
    const mode = dragModeFor(node?.parentId ?? null, viewParentId);
    const ptCanvas = clientToCanvas(clientX, clientY, viewport);
    const nodeOrigin = nodeCanvasOriginFromScreen(nodeScreenRect.left, nodeScreenRect.top, viewport);
    const grabCanvas = { x: ptCanvas.x - nodeOrigin.x, y: ptCanvas.y - nodeOrigin.y };
    let grabBody = grabCanvas;
    if (mode === "nested" && node?.parentId) {
      const body = dom.bodyRect(node.parentId);
      if (body) {
        const ptBody = screenToBodyLocal(clientX, clientY, body, viewport.camera.zoom);
        const nodeBodyOrigin = screenToBodyLocal(
          nodeScreenRect.left,
          nodeScreenRect.top,
          body,
          viewport.camera.zoom
        );
        grabBody = { x: ptBody.x - nodeBodyOrigin.x, y: ptBody.y - nodeBodyOrigin.y };
      }
    }
    const startPositions = {};
    for (const id of nodeIds) {
      const n = nodes[id];
      if (n) startPositions[id] = { x: n.ui_position.x, y: n.ui_position.y };
    }
    const startPos = startPositions[nodeId] ?? { x: 0, y: 0 };
    return {
      nodeId,
      nodeIds,
      pointerId,
      mode,
      multi: nodeIds.length > 1,
      forbidden: buildForbidden(nodes, nodeIds),
      grabCanvas,
      grabBody,
      startClient: { x: clientX, y: clientY },
      startPositions,
      active: false,
      extracted: false,
      targetCanvas: startPos,
      targetBody: { x: 0, y: 0 },
      reorderIndex: null,
      hoverTarget: null
    };
  }
  function updateDrag(input) {
    const { session, nodes, viewParentId, clientX, clientY, viewport, dom } = input;
    const dx = clientX - session.startClient.x;
    const dy = clientY - session.startClient.y;
    const active = session.active || Math.hypot(dx, dy) >= DRAG_THRESHOLD_PX;
    const next = {
      ...session,
      active,
      targetCanvas: canvasPosFromClient(clientX, clientY, viewport, session.grabCanvas)
    };
    if (!active) return next;
    if (next.mode === "canvas") {
      next.extracted = false;
      next.reorderIndex = null;
      next.targetBody = { x: 0, y: 0 };
      next.hoverTarget = next.multi ? null : dom.dropTargetAt(clientX, clientY, next.forbidden);
      return next;
    }
    const node = nodes[next.nodeId];
    const parentId = node?.parentId;
    if (!parentId) {
      next.mode = "canvas";
      next.hoverTarget = dom.dropTargetAt(clientX, clientY, next.forbidden);
      return next;
    }
    const inBody = dom.pointInBody(parentId, clientX, clientY);
    next.extracted = !inBody;
    if (next.extracted) {
      next.reorderIndex = null;
      next.targetBody = { x: 0, y: 0 };
      next.hoverTarget = next.multi ? null : dom.dropTargetAt(clientX, clientY, next.forbidden);
      return next;
    }
    const body = dom.bodyRect(parentId);
    if (body) {
      next.targetBody = bodyPosFromClient(
        clientX,
        clientY,
        body,
        viewport.camera.zoom,
        next.grabBody
      );
      const local = bodyLocalFromClient(clientX, clientY, body, viewport.camera.zoom);
      next.reorderIndex = insertIndexInParent(nodes, parentId, next.nodeId, local.x, local.y);
    }
    next.hoverTarget = next.multi ? null : dom.dropTargetAt(clientX, clientY, next.forbidden);
    return next;
  }
  function resolveDrop(input) {
    const { session, nodes, viewParentId, clientX, clientY, viewport, dom } = input;
    if (!session.active) return { kind: "none" };
    if (session.multi) {
      const delta = {
        x: session.targetCanvas.x - (session.startPositions[session.nodeId]?.x ?? 0),
        y: session.targetCanvas.y - (session.startPositions[session.nodeId]?.y ?? 0)
      };
      return {
        kind: "move-batch",
        updates: session.nodeIds.map((id) => ({
          id,
          position: {
            x: (session.startPositions[id]?.x ?? 0) + delta.x,
            y: (session.startPositions[id]?.y ?? 0) + delta.y
          }
        }))
      };
    }
    const node = nodes[session.nodeId];
    if (!node) return { kind: "none" };
    if (session.mode === "nested" && node.parentId && !session.extracted) {
      if (dom.pointInBody(node.parentId, clientX, clientY)) {
        const body = dom.bodyRect(node.parentId);
        const local = body ? bodyLocalFromClient(clientX, clientY, body, viewport.camera.zoom) : { x: 0, y: 0 };
        const index = session.reorderIndex ?? insertIndexInParent(nodes, node.parentId, session.nodeId, local.x, local.y);
        return { kind: "reorder", childId: session.nodeId, parentId: node.parentId, index };
      }
    }
    const target = dom.dropTargetAt(clientX, clientY, session.forbidden);
    if (target !== "root" && isValidNestTarget(nodes, target, session.forbidden)) {
      const body = dom.bodyRect(target);
      const local = body ? bodyLocalFromClient(clientX, clientY, body, viewport.camera.zoom) : { x: 0, y: 0 };
      const index = insertIndexInParent(nodes, target, session.nodeId, local.x, local.y);
      return { kind: "nest", childId: session.nodeId, targetId: target, index };
    }
    const position = canvasPosFromClient(clientX, clientY, viewport, session.grabCanvas);
    return { kind: "move", childId: session.nodeId, parentId: viewParentId, position };
  }
  function toVisual(session) {
    if (!session || !session.active) {
      return {
        dragIds: [],
        active: false,
        mode: "canvas",
        extracted: false,
        hoverTarget: null,
        reorderIndex: null,
        canvasDelta: null,
        extractCanvasPos: null,
        bodyLocalPos: null
      };
    }
    const start = session.startPositions[session.nodeId] ?? { x: 0, y: 0 };
    const canvasDelta = session.mode === "canvas" && !session.extracted ? { x: session.targetCanvas.x - start.x, y: session.targetCanvas.y - start.y } : null;
    return {
      dragIds: session.nodeIds,
      active: true,
      mode: session.mode,
      extracted: session.extracted,
      hoverTarget: session.hoverTarget,
      reorderIndex: session.reorderIndex,
      canvasDelta,
      extractCanvasPos: session.extracted ? session.targetCanvas : null,
      bodyLocalPos: session.mode === "nested" && !session.extracted ? session.targetBody : null
    };
  }
  function isDraggingNode(session, nodeId) {
    if (!session?.active) return false;
    if (!session.nodeIds.includes(nodeId)) return false;
    if (session.extracted && session.nodeId === nodeId) return false;
    return true;
  }
  function isGhostInParent(session, parentId, childId) {
    if (!session?.active || session.extracted) return false;
    if (session.mode !== "nested") return false;
    const node = session.nodeId;
    if (childId !== node) return false;
    const dragged = session.nodeId;
    return session.nodeIds.includes(dragged) && session.nodeId === childId;
  }

  // lib/canvas/mutations.ts
  function intoLayoutParent(newParentId, viewParentId) {
    return newParentId != null && newParentId !== viewParentId;
  }
  function applyDropIntent(nodes, intent, viewParentId) {
    switch (intent.kind) {
      case "none":
        return nodes;
      case "move-batch": {
        const out = { ...nodes };
        for (const { id, position } of intent.updates) {
          if (out[id]) out[id] = { ...out[id], ui_position: position };
        }
        return out;
      }
      case "reorder": {
        const siblings = sortChildrenByOrder(childrenOf(nodes, intent.parentId));
        const reordered = applyReorder(siblings, intent.childId, intent.index);
        let out = { ...nodes };
        for (const n of reordered) out[n.id] = n;
        return syncContainerBranch(out, intent.parentId);
      }
      case "nest": {
        const node = nodes[intent.childId];
        if (!node || intent.childId === intent.targetId) return nodes;
        if (isAncestor(nodes, intent.childId, intent.targetId)) return nodes;
        const oldParent = node.parentId;
        let out = { ...nodes };
        out[intent.childId] = {
          ...node,
          parentId: intent.targetId,
          ui_position: { x: 0, y: 0 },
          ui_order: intent.index
        };
        const reordered = applyReorder(childrenOf(out, intent.targetId), intent.childId, intent.index);
        for (const n of reordered) out[n.id] = n;
        out = syncContainerBranch(out, intent.targetId);
        if (oldParent && oldParent !== intent.targetId) {
          out = syncContainerBranch(out, oldParent);
        }
        return out;
      }
      case "move": {
        const node = nodes[intent.childId];
        if (!node) return nodes;
        const oldParent = node.parentId;
        const nesting = intoLayoutParent(intent.parentId, viewParentId);
        let out = { ...nodes };
        out[intent.childId] = {
          ...node,
          parentId: intent.parentId,
          ui_position: nesting ? { x: 0, y: 0 } : intent.position,
          ui_order: nesting ? nextChildOrder(childrenOf(out, intent.parentId).filter((c) => c.id !== intent.childId)) : void 0
        };
        if (!nesting && intent.parentId == null) {
          delete out[intent.childId].ui_order;
        }
        if (oldParent && oldParent !== intent.parentId) {
          out = syncContainerBranch(out, oldParent);
        }
        return out;
      }
      default:
        return nodes;
    }
  }

  // lib/canvas/dom-adapter.ts
  function parseRect(el) {
    if (!(el instanceof HTMLElement)) return null;
    const r = el.getBoundingClientRect();
    return { left: r.left, top: r.top, width: r.width, height: r.height };
  }
  function createBrowserDomAdapter() {
    return {
      bodyRect(parentId) {
        const roots = document.querySelectorAll(`[data-node-id="${parentId}"]`);
        for (const root of roots) {
          if (!(root instanceof HTMLElement)) continue;
          if (root.closest(".is-dragging, .dragging")) continue;
          const el = root.querySelector(".node-body");
          const rect = parseRect(el);
          if (rect) return rect;
        }
        return null;
      },
      dropTargetAt(clientX, clientY, forbidden) {
        const elements = document.elementsFromPoint?.(clientX, clientY) ?? [
          document.elementFromPoint(clientX, clientY)
        ].filter(Boolean);
        for (const el of elements) {
          if (!(el instanceof HTMLElement)) continue;
          if (el.classList.contains("is-dragging") || el.classList.contains("dragging")) continue;
          const id = el.getAttribute("data-droppable-id");
          if (!id) continue;
          if (id === "__root__") return "root";
          if (!forbidden.has(id)) return id;
        }
        return "root";
      },
      pointInBody(parentId, clientX, clientY) {
        const rect = this.bodyRect(parentId);
        return rect ? pointInRect(clientX, clientY, rect) : false;
      }
    };
  }

  // lib/canvas/standalone-entry.ts
  if (typeof window !== "undefined") {
    window.CanvasEngine = index_exports;
  }
  return __toCommonJS(standalone_entry_exports);
})();
