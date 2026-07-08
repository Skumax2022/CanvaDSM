/* eslint-disable no-alert */
/**
 * Автономное приложение Canvas + DSM.
 * Работает через file:// без сервера — подключать обычным <script>, не module.
 */
(function () {
  "use strict";

  var MIN_ZOOM = 0.25;
  var MAX_ZOOM = 2.5;
  var GRID = 24;
  var idSeq = 0;
  var LAYOUT_GAP = 12;
  var LAYOUT_PAD = 12;
  var LAYOUT_HEADER = 36;

  var DEFAULT_SIZE = {
    SPACE: { width: 420, height: 320 },
    RECTANGLE: { width: 240, height: 72 },
    SQUARE: { width: 96, height: 96 },
  };
  var DEFAULT_TITLE = {
    SPACE: "New Space",
    RECTANGLE: "New Rectangle",
    SQUARE: "New Square",
  };
  var RECT_KINDS = ["DEFAULT", "FUNCTION", "NUMBER", "OBJECT"];
  var RECT_KIND_META = {
    DEFAULT: { label: "Базовый", bg: "#1a1a1a", border: "rgba(255,255,255,0.22)", accent: "#fafafa", dsmColor: "#a3a3a3", cssKind: "" },
    FUNCTION: { label: "Функция", bg: "rgba(168,85,247,0.12)", border: "rgba(192,132,252,0.55)", accent: "#c084fc", dsmColor: "#a855f7", cssKind: "kind-function" },
    NUMBER: { label: "Число", bg: "rgba(34,197,94,0.12)", border: "rgba(74,222,128,0.55)", accent: "#4ade80", dsmColor: "#22c55e", cssKind: "kind-number" },
    OBJECT: { label: "Объект", bg: "rgba(249,115,22,0.12)", border: "rgba(251,146,60,0.55)", accent: "#fb923c", dsmColor: "#f97316", cssKind: "kind-object" },
  };

  var CE = window.CanvasEngine;
  if (!CE) {
    console.error("canvas-engine.js must be loaded before app.js");
    return;
  }
  var canvasDom = CE.createBrowserDomAdapter();

  function childSortKey(node) {
    if (node.ui_order != null) return node.ui_order;
    return node.ui_position.x * 1000 + node.ui_position.y;
  }

  function normalizeLayoutOrders(nodes) {
    var byParent = {};
    Object.keys(nodes).forEach(function (id) {
      var n = nodes[id];
      var key = n.parentId == null ? "__root__" : n.parentId;
      if (!byParent[key]) byParent[key] = [];
      byParent[key].push(n);
    });
    Object.keys(byParent).forEach(function (key) {
      byParent[key].sort(function (a, b) { return childSortKey(a) - childSortKey(b); });
      byParent[key].forEach(function (n, i) {
        if (n.ui_order == null) nodes[n.id].ui_order = i;
      });
    });
    return nodes;
  }

  var MOCK_NODES = normalizeLayoutOrders({
    "space-backend": {
      id: "space-backend", type: "SPACE", title: "Backend Platform", parentId: null, dependencies: [],
      ui_position: { x: 80, y: 120 }, ui_size: { width: 420, height: 320 }, ui_order: 0,
    },
    "rect-auth": {
      id: "rect-auth", type: "RECTANGLE", rectKind: "FUNCTION", title: "Auth Service", parentId: "space-backend", dependencies: [],
      ui_position: { x: 0, y: 0 }, ui_size: { width: 240, height: 72 }, ui_order: 0,
    },
    "sq-crypto": {
      id: "sq-crypto", type: "SQUARE", title: "Encryption Algorithm", parentId: "rect-auth", dependencies: ["sq-user-db"],
      ui_position: { x: 0, y: 0 }, ui_size: { width: 96, height: 96 }, ui_order: 0,
    },
    "sq-session": {
      id: "sq-session", type: "SQUARE", title: "Session Store", parentId: "rect-auth", dependencies: [],
      ui_position: { x: 0, y: 0 }, ui_size: { width: 96, height: 96 }, ui_order: 1,
    },
    "rect-api": {
      id: "rect-api", type: "RECTANGLE", rectKind: "OBJECT", title: "API Gateway", parentId: "space-backend", dependencies: ["rect-auth"],
      ui_position: { x: 0, y: 0 }, ui_size: { width: 240, height: 72 }, ui_order: 1,
    },
    "sq-user-db": {
      id: "sq-user-db", type: "SQUARE", title: "User Database", parentId: "space-backend", dependencies: [],
      ui_position: { x: 0, y: 0 }, ui_size: { width: 96, height: 96 }, ui_order: 2,
    },
    "space-frontend": {
      id: "space-frontend", type: "SPACE", title: "Frontend App", parentId: null, dependencies: [],
      ui_position: { x: 680, y: 160 }, ui_size: { width: 360, height: 300 }, ui_order: 1,
    },
    "rect-dashboard": {
      id: "rect-dashboard", type: "RECTANGLE", rectKind: "NUMBER", title: "Dashboard Module", parentId: "space-frontend", dependencies: ["rect-api"],
      ui_position: { x: 0, y: 0 }, ui_size: { width: 240, height: 72 }, ui_order: 0,
    },
    "sq-charts": {
      id: "sq-charts", type: "SQUARE", title: "Charts Engine", parentId: "rect-dashboard", dependencies: ["sq-user-db"],
      ui_position: { x: 0, y: 0 }, ui_size: { width: 96, height: 96 }, ui_order: 0,
    },
    "sq-analytics": {
      id: "sq-analytics", type: "SQUARE", title: "Analytics Pipeline", parentId: null, dependencies: ["rect-api"],
      ui_position: { x: 300, y: 560 }, ui_size: { width: 96, height: 96 }, ui_order: 2,
    },
  });

  function makeId(type) {
    idSeq += 1;
    return type.toLowerCase() + "-" + Date.now().toString(36) + "-" + idSeq;
  }
  function cloneNodes(nodes) {
    return JSON.parse(JSON.stringify(nodes));
  }
  function childrenOf(nodes, parentId) {
    return Object.values(nodes).filter(function (n) { return n.parentId === parentId; });
  }
  function descendantIds(nodes, id) {
    var out = [];
    var stack = childrenOf(nodes, id).map(function (n) { return n.id; });
    while (stack.length) {
      var cur = stack.pop();
      out.push(cur);
      childrenOf(nodes, cur).forEach(function (c) { stack.push(c.id); });
    }
    return out;
  }
  function isAncestor(nodes, maybeAncestor, id) {
    var cur = nodes[id] ? nodes[id].parentId : null;
    while (cur) {
      if (cur === maybeAncestor) return true;
      cur = nodes[cur] ? nodes[cur].parentId : null;
    }
    return false;
  }
  function ancestorChain(nodes, id) {
    var chain = [];
    var cur = nodes[id] ? nodes[id].parentId : null;
    while (cur) {
      var node = nodes[cur];
      if (!node) break;
      chain.unshift(node);
      cur = node.parentId;
    }
    return chain;
  }
  function flattenTree(nodes, collapsed) {
    var rows = [];
    function walk(parentId, depth) {
      childrenOf(nodes, parentId).forEach(function (node) {
        var kids = childrenOf(nodes, node.id);
        rows.push({ node: node, depth: depth, hasChildren: kids.length > 0, collapsed: collapsed.has(node.id) });
        if (kids.length && !collapsed.has(node.id)) walk(node.id, depth + 1);
      });
    }
    walk(null, 0);
    return rows;
  }
  function isLinkable(node) { return node.type !== "SPACE"; }
  function resolveCell(nodes, collapsed, sourceId, targetId) {
    if (sourceId === targetId) return "none";
    var source = nodes[sourceId];
    var target = nodes[targetId];
    if (!source || !target) return "none";
    var sourceIds = collapsed.has(sourceId) && childrenOf(nodes, sourceId).length
      ? [sourceId].concat(descendantIds(nodes, sourceId)) : [sourceId];
    var targetIds = collapsed.has(targetId) && childrenOf(nodes, targetId).length
      ? [targetId].concat(descendantIds(nodes, targetId)) : [targetId];
    if (sourceIds.length === 1 && targetIds.length === 1) {
      if (isLinkable(source) && isLinkable(target) && source.dependencies.indexOf(targetId) >= 0) return "direct";
      return "none";
    }
    for (var i = 0; i < sourceIds.length; i++) {
      var sn = nodes[sourceIds[i]];
      if (!sn || !isLinkable(sn)) continue;
      for (var j = 0; j < targetIds.length; j++) {
        if (sourceIds[i] === targetIds[j]) continue;
        if (sn.dependencies.indexOf(targetIds[j]) >= 0) return "aggregate";
      }
    }
    return "none";
  }

  var state = {
    nodes: CE.syncAllContainerLayouts(cloneNodes(MOCK_NODES)),
    projectName: "Untitled System",
    path: [],
    viewMode: "split",
    selectedId: null,
    selectedIds: [],
    collapsed: new Set(),
    dsmSearch: "",
    history: [],
    clipboard: null,
    camera: { x: 60, y: 60, zoom: 1 },
    drag: null,
    pan: null,
    marquee: null,
    hoverDropId: null,
    panning: false,
    marqueeRect: null,
    pointerInViewport: { x: 0, y: 0 },
    editingId: null,
  };

  function sortChildrenByOrder(children) {
    return CE.sortChildrenByOrder(children);
  }

  function measureContainerSize(children, minInnerWidth) {
    return CE.measureContainerSize(children, minInnerWidth || 240);
  }

  function minInnerWidthFor(node) {
    return CE.minInnerWidthFor(node);
  }

  function syncContainerBranch(startId) {
    if (startId) state.nodes = CE.syncContainerBranch(state.nodes, startId);
  }

  function syncAllContainerLayouts() {
    state.nodes = CE.syncAllContainerLayouts(state.nodes);
  }

  function viewportInfo() {
    var rect = dom.viewport.getBoundingClientRect();
    return {
      rect: { left: rect.left, top: rect.top, width: rect.width, height: rect.height },
      camera: state.camera,
    };
  }

  var listeners = [];
  function emit() { listeners.forEach(function (fn) { fn(); }); }
  function subscribe(fn) { listeners.push(fn); return function () { listeners = listeners.filter(function (f) { return f !== fn; }); }; }

  function snapshot() {
    return {
      nodes: cloneNodes(state.nodes),
      path: state.path.slice(),
      selectedId: state.selectedId,
      selectedIds: state.selectedIds.slice(),
    };
  }
  function pushHistory() {
    state.history = state.history.slice(-49).concat([snapshot()]);
  }
  function currentParentId() {
    return state.path.length ? state.path[state.path.length - 1] : null;
  }

  var dom = {};
  function $(id) { return document.getElementById(id); }

  function iconSvg(kind, px) {
    var size = px || 14;
    var common = 'viewBox="0 0 24 24" width="' + size + '" height="' + size + '" shape-rendering="geometricPrecision"';
    if (kind === "function") return "<svg " + common + ' fill="none" stroke="currentColor" stroke-width="2" vector-effect="non-scaling-stroke"><circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/></svg>';
    if (kind === "number") return "<svg " + common + ' fill="none" stroke="currentColor" stroke-width="2" vector-effect="non-scaling-stroke"><line x1="4" y1="9" x2="20" y2="9"/><line x1="4" y1="15" x2="20" y2="15"/><line x1="10" y1="3" x2="8" y2="21"/><line x1="16" y1="3" x2="14" y2="21"/></svg>';
    if (kind === "object") return "<svg " + common + ' fill="none" stroke="currentColor" stroke-width="2" vector-effect="non-scaling-stroke"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>';
    return "<svg " + common + ' fill="currentColor"><rect x="5" y="5" width="14" height="14" rx="1"/></svg>';
  }

  function snapCamera(cam) {
    var z = Math.round(cam.zoom * 1000) / 1000;
    return {
      zoom: z,
      x: Math.round(cam.x),
      y: Math.round(cam.y),
    };
  }

  function applyCamera(next) {
    state.camera = snapCamera(next);
    var cam = state.camera;
    dom.canvasLayer.style.transform = "translate3d(" + cam.x + "px," + cam.y + "px,0) scale(" + cam.zoom + ")";
    dom.viewport.style.backgroundSize = Math.round(GRID * cam.zoom) + "px " + Math.round(GRID * cam.zoom) + "px";
    dom.viewport.style.backgroundPosition = cam.x + "px " + cam.y + "px";
    if ($("zoom-label")) $("zoom-label").textContent = Math.round(cam.zoom * 100) + "%";
    renderMarquee();
  }

  function recenterBoard() {
    var parentId = currentParentId();
    var topLevel = childrenOf(state.nodes, parentId);
    if (!topLevel.length) {
      applyCamera({ x: 60, y: 60, zoom: 1 });
      return;
    }
    var vpRect = dom.viewport.getBoundingClientRect();
    var cam = state.camera;
    var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    dom.canvasContent.querySelectorAll(".node-wrap").forEach(function (wrap) {
      var r = wrap.getBoundingClientRect();
      minX = Math.min(minX, r.left);
      minY = Math.min(minY, r.top);
      maxX = Math.max(maxX, r.right);
      maxY = Math.max(maxY, r.bottom);
    });
    if (!Number.isFinite(minX)) {
      applyCamera({ x: 60, y: 60, zoom: 1 });
      return;
    }
    var w = (maxX - minX) / cam.zoom;
    var h = (maxY - minY) / cam.zoom;
    var contentLeft = (minX - vpRect.left - cam.x) / cam.zoom;
    var contentTop = (minY - vpRect.top - cam.y) / cam.zoom;
    var PAD = 80;
    var fitZoom = Math.min(
      MAX_ZOOM,
      Math.max(MIN_ZOOM, Math.min((vpRect.width - PAD) / w, (vpRect.height - PAD) / h))
    );
    applyCamera({
      zoom: fitZoom,
      x: (vpRect.width - w * fitZoom) / 2 - contentLeft * fitZoom,
      y: (vpRect.height - h * fitZoom) / 2 - contentTop * fitZoom,
    });
  }

  function clientToCanvas(cx, cy) {
    var rect = dom.viewport.getBoundingClientRect();
    var cam = state.camera;
    return { x: (cx - rect.left - cam.x) / cam.zoom, y: (cy - rect.top - cam.y) / cam.zoom };
  }

  function zoomAt(clientX, clientY, factor) {
    var rect = dom.viewport.getBoundingClientRect();
    var mx = clientX - rect.left;
    var my = clientY - rect.top;
    var c = state.camera;
    var zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, c.zoom * factor));
    var ratio = zoom / c.zoom;
    applyCamera({ zoom: zoom, x: mx - (mx - c.x) * ratio, y: my - (my - c.y) * ratio });
  }

  function zoomBy(factor) {
    var rect = dom.viewport.getBoundingClientRect();
    var p = state.pointerInViewport;
    zoomAt(rect.left + p.x, rect.top + p.y, factor);
  }

  function releaseInteraction() {
    state.drag = null;
    state.pan = null;
    state.marquee = null;
    state.hoverDropId = null;
    state.panning = false;
    state.marqueeRect = null;
    dom.viewport.classList.toggle("grabbing", false);
    renderCanvas();
    renderMarquee();
  }

  function applyNodeDrop(session, clientX, clientY) {
    var intent = CE.resolveDrop({
      session: session,
      nodes: state.nodes,
      viewParentId: currentParentId(),
      clientX: clientX,
      clientY: clientY,
      viewport: viewportInfo(),
      dom: canvasDom,
    });
    state.nodes = CE.applyDropIntent(state.nodes, intent, currentParentId());
  }

  function dragVisualState() {
    return CE.toVisual(state.drag);
  }

  function storeAddNode(type, position, parentId) {
    pushHistory();
    var pid = parentId !== undefined ? parentId : currentParentId();
    var id = makeId(type);
    state.nodes[id] = {
      id: id, type: type, rectKind: type === "RECTANGLE" ? "DEFAULT" : undefined,
      title: DEFAULT_TITLE[type], parentId: pid, dependencies: [],
      ui_position: position, ui_size: DEFAULT_SIZE[type],
    };
    state.selectedId = id;
    state.selectedIds = [id];
    syncContainerBranch(pid);
    emit();
  }

  function storeDeleteSelected() {
    if (!state.selectedIds.length) return;
    pushHistory();
    var parentsToSync = new Set();
    var toRemove = new Set();
    state.selectedIds.forEach(function (id) {
      var n = state.nodes[id];
      if (n && n.parentId) parentsToSync.add(n.parentId);
      toRemove.add(id);
      descendantIds(state.nodes, id).forEach(function (d) { toRemove.add(d); });
    });
    var nodes = {};
    Object.keys(state.nodes).forEach(function (key) {
      if (toRemove.has(key)) return;
      var n = state.nodes[key];
      nodes[key] = Object.assign({}, n, { dependencies: n.dependencies.filter(function (d) { return !toRemove.has(d); }) });
    });
    state.nodes = nodes;
    state.path = state.path.filter(function (p) { return !toRemove.has(p); });
    state.selectedId = null;
    state.selectedIds = [];
    parentsToSync.forEach(function (pid) { syncContainerBranch(pid); });
    emit();
  }

  function storeUndo() {
    if (!state.history.length) return;
    var prev = state.history.pop();
    state.nodes = prev.nodes;
    state.path = prev.path;
    state.selectedId = prev.selectedId;
    state.selectedIds = prev.selectedIds;
    emit();
  }

  function storeDuplicate() {
    if (!state.selectedId || !state.nodes[state.selectedId]) return;
    pushHistory();
    var src = state.nodes[state.selectedId];
    var id = makeId(src.type);
    state.nodes[id] = JSON.parse(JSON.stringify(src));
    state.nodes[id].id = id;
    state.nodes[id].title = src.title + " (copy)";
    state.nodes[id].ui_position = { x: src.ui_position.x + 24, y: src.ui_position.y + 24 };
    state.selectedId = id;
    state.selectedIds = [id];
    emit();
  }

  function storeCopy() {
    if (!state.selectedId || !state.nodes[state.selectedId]) return;
    state.clipboard = JSON.parse(JSON.stringify(state.nodes[state.selectedId]));
  }

  function storePaste() {
    if (!state.clipboard) return;
    pushHistory();
    var id = makeId(state.clipboard.type);
    var node = JSON.parse(JSON.stringify(state.clipboard));
    node.id = id;
    node.parentId = currentParentId();
    node.title = state.clipboard.title + " (paste)";
    node.ui_position = { x: state.clipboard.ui_position.x + 32, y: state.clipboard.ui_position.y + 32 };
    state.nodes[id] = node;
    state.selectedId = id;
    state.selectedIds = [id];
    emit();
  }

  function cycleRectKind(id) {
    var node = state.nodes[id];
    if (!node || node.type !== "RECTANGLE") return;
    pushHistory();
    var cur = node.rectKind || "DEFAULT";
    var idx = RECT_KINDS.indexOf(cur);
    node.rectKind = RECT_KINDS[(idx + 1) % RECT_KINDS.length];
    emit();
  }

  function kindIconName(kind) {
    if (kind === "FUNCTION") return "function";
    if (kind === "NUMBER") return "number";
    if (kind === "OBJECT") return "object";
    return "square";
  }

  function nodeScreenOrigin(nodeId) {
    var el = document.querySelector('[data-node-id="' + nodeId + '"]');
    if (!el) return null;
    var r = el.getBoundingClientRect();
    return clientToCanvas(r.left, r.top);
  }

  function pointerLocalInEl(cx, cy, el) {
    var r = el.getBoundingClientRect();
    var cam = state.camera;
    return { x: (cx - r.left) / cam.zoom, y: (cy - r.top) / cam.zoom };
  }

  function parentBodyById(parentId) {
    return document.querySelector('[data-node-id="' + parentId + '"] .node-body');
  }

  function canvasLocalInParent(canvasX, canvasY, parentId) {
    var body = parentBodyById(parentId);
    var el = body || document.querySelector('[data-node-id="' + parentId + '"]');
    if (!el) return { x: canvasX, y: canvasY };
    var r = el.getBoundingClientRect();
    var origin = clientToCanvas(r.left, r.top);
    return { x: canvasX - origin.x, y: canvasY - origin.y };
  }

  function isPlateRect(node, nested) {
    return node.type === "RECTANGLE" && !nested;
  }

  function makeCtrlBtn(label, className, title, onClick) {
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "ctrl-btn" + (className ? " " + className : "");
    btn.textContent = label;
    if (title) btn.title = title;
    btn.onpointerdown = function (e) { e.stopPropagation(); };
    btn.onclick = function (e) { e.stopPropagation(); onClick(e); };
    return btn;
  }

  function attachNodeDrag(el, node) {
    el.onpointerdown = function (e) {
      if (e.button !== 0) return;
      e.stopPropagation();

      if (state.selectedIds.indexOf(node.id) < 0) {
        state.selectedId = node.id;
        state.selectedIds = [node.id];
        renderCanvas();
      }

      var dragEl = document.querySelector('[data-node-id="' + node.id + '"]');
      var dragRect = dragEl ? dragEl.getBoundingClientRect() : el.getBoundingClientRect();

      state.drag = CE.beginDrag({
        nodeId: node.id,
        selectedIds: state.selectedIds,
        nodes: state.nodes,
        viewParentId: currentParentId(),
        pointerId: e.pointerId,
        clientX: e.clientX,
        clientY: e.clientY,
        nodeScreenRect: dragRect,
        viewport: viewportInfo(),
        dom: canvasDom,
      });
    };
  }

  function renderSquareNode(node, isSelected, isDragging, isDrop) {
    var el = document.createElement("div");
    el.className = "node node-square" + (isSelected ? " selected" : "") + (isDragging ? " dragging" : "") + (isDrop ? " drop-target" : "");
    el.setAttribute("data-node-id", node.id);
    el.style.width = node.ui_size.width + "px";
    el.style.height = node.ui_size.height + "px";

    var label = document.createElement("div");
    label.className = "node-square-label";
    if (state.editingId === node.id) {
      var inp = document.createElement("input");
      inp.className = "node-input node-square-input";
      inp.value = node.title;
      inp.onpointerdown = function (e) { e.stopPropagation(); };
      inp.onblur = function () {
        if (inp.value.trim()) node.title = inp.value.trim();
        state.editingId = null;
        emit();
      };
      inp.onkeydown = function (e) {
        if (e.key === "Enter") inp.blur();
        if (e.key === "Escape") { state.editingId = null; emit(); }
      };
      label.appendChild(inp);
      setTimeout(function () { inp.focus(); inp.select(); }, 0);
    } else {
      var span = document.createElement("span");
      span.textContent = node.title;
      label.appendChild(span);
    }
    el.appendChild(label);

    var ctrls = document.createElement("div");
    ctrls.className = "node-square-controls";
    ctrls.appendChild(makeCtrlBtn("✎", "", "Переименовать", function () { state.editingId = node.id; emit(); }));
    ctrls.appendChild(makeCtrlBtn("×", "delete", "Удалить", function () {
      pushHistory();
      state.selectedIds = [node.id];
      storeDeleteSelected();
    }));
    el.appendChild(ctrls);

    attachNodeDrag(el, node);
    el.ondblclick = function (e) { e.stopPropagation(); state.editingId = node.id; emit(); };
    return el;
  }

  function renderPlateNode(node, isSelected, isDragging, isDrop) {
    var kind = node.rectKind || "DEFAULT";
    var meta = node.type === "RECTANGLE" ? RECT_KIND_META[kind] : null;
    var el = document.createElement("div");
    el.className = "node node-plate" + (meta && meta.cssKind ? " " + meta.cssKind : "") +
      (isSelected ? " selected" : "") + (isDragging ? " dragging" : "") + (isDrop ? " drop-target" : "");
    el.setAttribute("data-node-id", node.id);
    el.setAttribute("data-droppable-id", node.id);
    el.style.width = node.ui_size.width + "px";
    el.style.height = node.ui_size.height + "px";
    if (meta && kind !== "DEFAULT") {
      el.style.background = meta.bg;
      el.style.borderColor = meta.border;
    }

    var label = document.createElement("div");
    label.className = "node-plate-label";
    if (state.editingId === node.id) {
      var inp = document.createElement("input");
      inp.className = "node-input node-plate-input";
      inp.value = node.title;
      inp.onpointerdown = function (e) { e.stopPropagation(); };
      inp.onblur = function () {
        if (inp.value.trim()) node.title = inp.value.trim();
        state.editingId = null;
        emit();
      };
      inp.onkeydown = function (e) {
        if (e.key === "Enter") inp.blur();
        if (e.key === "Escape") { state.editingId = null; emit(); }
      };
      label.appendChild(inp);
      setTimeout(function () { inp.focus(); inp.select(); }, 0);
    } else {
      var span = document.createElement("span");
      span.textContent = node.title;
      label.appendChild(span);
    }
    el.appendChild(label);

    var ctrls = document.createElement("div");
    ctrls.className = "node-plate-controls";
    if (node.type === "RECTANGLE" && meta) {
      var kindBtn = makeCtrlBtn("", "", "Тип: " + meta.label + " — нажмите для смены", function () { cycleRectKind(node.id); });
      kindBtn.innerHTML = iconSvg(kind === "FUNCTION" ? "function" : kind === "NUMBER" ? "number" : kind === "OBJECT" ? "object" : "square", 12);
      kindBtn.style.color = meta.accent;
      ctrls.appendChild(kindBtn);
    }
    ctrls.appendChild(makeCtrlBtn("✎", "", "Переименовать", function () { state.editingId = node.id; emit(); }));
    ctrls.appendChild(makeCtrlBtn("×", "delete", "Удалить", function () {
      pushHistory();
      state.selectedIds = [node.id];
      storeDeleteSelected();
    }));
    el.appendChild(ctrls);

    attachNodeDrag(el, node);
    el.ondblclick = function (e) { e.stopPropagation(); state.editingId = node.id; emit(); };
    return el;
  }

  function renderNode(node, isChild) {
    var children = childrenOf(state.nodes, node.id);
    var isContainer = node.type === "RECTANGLE" || node.type === "SPACE";
    var nested = children.length && isContainer;
    var isSelected = state.selectedIds.indexOf(node.id) >= 0;
    var vis = dragVisualState();
    var isDragging = vis.active && vis.dragIds.indexOf(node.id) >= 0 && !vis.extracted;
    var isDrop = state.hoverDropId === node.id;
    var kind = node.rectKind || "DEFAULT";
    var meta = node.type === "RECTANGLE" ? RECT_KIND_META[kind] : null;

    if (node.type === "SQUARE") {
      return renderSquareNode(node, isSelected, isDragging, isDrop);
    }

    if (isPlateRect(node, nested)) {
      return renderPlateNode(node, isSelected, isDragging, isDrop);
    }

    var el = document.createElement("div");
    el.className = "node" + (meta && meta.cssKind ? " " + meta.cssKind : "") +
      (isSelected ? " selected" : "") + (isDragging ? " dragging" : "") + (isDrop ? " drop-target" : "");
    el.setAttribute("data-node-id", node.id);
    if (isContainer) el.setAttribute("data-droppable-id", node.id);

    if (node.type === "SPACE") {
      el.style.borderStyle = "dashed";
      el.style.background = "rgba(255,255,255,0.02)";
      el.style.borderColor = "rgba(255,255,255,0.18)";
    } else if (meta) {
      el.style.background = meta.bg;
      el.style.borderColor = meta.border;
    }

    if (nested) {
      el.className += " node-nested";
      el.style.width = node.ui_size.width + "px";
      el.style.minHeight = node.ui_size.height + "px";
      el.style.height = "auto";
    } else {
      el.style.width = node.ui_size.width + "px";
      el.style.height = node.ui_size.height + "px";
    }

    var header = document.createElement("div");
    header.className = "node-header";
    var titleWrap = document.createElement("div");
    titleWrap.className = "node-title";
    if (node.type === "RECTANGLE" && meta) {
      var ic = document.createElement("span");
      ic.className = "node-icon";
      ic.style.color = meta.accent;
      ic.innerHTML = iconSvg(kindIconName(kind));
      titleWrap.appendChild(ic);
    }
    if (state.editingId === node.id) {
      var inp = document.createElement("input");
      inp.className = "node-input";
      inp.value = node.title;
      inp.onpointerdown = function (e) { e.stopPropagation(); };
      inp.onblur = function () {
        if (inp.value.trim()) node.title = inp.value.trim();
        state.editingId = null;
        emit();
      };
      inp.onkeydown = function (e) {
        if (e.key === "Enter") inp.blur();
        if (e.key === "Escape") { state.editingId = null; emit(); }
      };
      titleWrap.appendChild(inp);
      setTimeout(function () { inp.focus(); inp.select(); }, 0);
    } else {
      var span = document.createElement("span");
      span.textContent = node.title;
      titleWrap.appendChild(span);
    }
    header.appendChild(titleWrap);

    var ctrls = document.createElement("div");
    ctrls.className = "node-controls";
    if (node.type === "RECTANGLE" && meta) {
      var kindBtn = makeCtrlBtn("", "", "Тип: " + meta.label, function () { cycleRectKind(node.id); });
      kindBtn.innerHTML = iconSvg(kind === "FUNCTION" ? "function" : kind === "NUMBER" ? "number" : kind === "OBJECT" ? "object" : "square", 12);
      kindBtn.style.color = meta.accent;
      ctrls.appendChild(kindBtn);
    }
    ctrls.appendChild(makeCtrlBtn("✎", "", "Переименовать", function () { state.editingId = node.id; emit(); }));
    ctrls.appendChild(makeCtrlBtn("×", "delete", "Удалить", function () {
      pushHistory();
      state.selectedIds = [node.id];
      storeDeleteSelected();
    }));
    header.appendChild(ctrls);
    el.appendChild(header);

    if (nested) {
      var body = document.createElement("div");
      body.className = "node-body node-body--auto";
      var d = state.drag;
      var sorted = sortChildrenByOrder(children);
      var bodySize = measureContainerSize(sorted, minInnerWidthFor(node));
      body.style.minHeight = bodySize.bodyHeight + "px";

      var vis = dragVisualState();
      var dragChildId = d && d.nodeId ? d.nodeId : null;
      var isDirectDragChild =
        dragChildId != null && sorted.some(function (child) { return child.id === dragChildId; });
      var draggingId =
        vis.active && vis.mode === "nested" && !vis.extracted && isDirectDragChild ? dragChildId : null;
      var reorderIdx = draggingId != null && d.reorderIndex != null ? d.reorderIndex : null;
      var slotW = draggingId ? state.nodes[draggingId].ui_size.width : 0;
      var slotH = draggingId ? state.nodes[draggingId].ui_size.height : 0;

      var queue = sorted.filter(function (child) { return child.id !== draggingId; });
      for (var qi = 0; qi <= queue.length; qi++) {
        if (reorderIdx != null && qi === reorderIdx && draggingId) {
          var slot = document.createElement("div");
          slot.className = "node-layout-slot";
          slot.style.width = slotW + "px";
          slot.style.height = slotH + "px";
          body.appendChild(slot);
        }
        if (qi < queue.length) {
          var cw = document.createElement("div");
          cw.className = "node-child-wrap";
          cw.appendChild(renderNode(queue[qi], true));
          body.appendChild(cw);
        }
      }

      if (draggingId && d.targetBody) {
        var ghost = document.createElement("div");
        ghost.className = "node-child-wrap is-dragging";
        ghost.style.position = "absolute";
        ghost.style.left = d.targetBody.x + "px";
        ghost.style.top = d.targetBody.y + "px";
        ghost.style.zIndex = "20";
        ghost.appendChild(renderNode(state.nodes[draggingId], true));
        body.appendChild(ghost);
      }

      el.appendChild(body);
    }

    attachNodeDrag(el, node);

    el.ondblclick = function (e) {
      e.stopPropagation();
      if (isContainer) { state.editingId = node.id; emit(); }
    };

    return el;
  }

  function renderCanvas() {
    syncAllContainerLayouts();
    dom.canvasContent.innerHTML = "";
    var parentId = currentParentId();
    var topLevel = childrenOf(state.nodes, parentId);
    var vis = dragVisualState();
    var d = state.drag;
    var dragIds = vis.active ? vis.dragIds : [];
    var delta = vis.canvasDelta || { x: 0, y: 0 };
    topLevel.forEach(function (node) {
      var wrap = document.createElement("div");
      var isSelected = state.selectedIds.indexOf(node.id) >= 0;
      var isDragging = dragIds.indexOf(node.id) >= 0 && !vis.extracted;
      wrap.className = "node-wrap" + (isDragging ? " is-dragging" : "") + (isSelected ? " is-selected" : "");
      var x = node.ui_position.x;
      var y = node.ui_position.y;
      if (isDragging && d && d.startPositions[node.id]) {
        x = d.startPositions[node.id].x + delta.x;
        y = d.startPositions[node.id].y + delta.y;
      }
      wrap.style.left = x + "px";
      wrap.style.top = y + "px";
      wrap.appendChild(renderNode(node, false));
      dom.canvasContent.appendChild(wrap);
    });
    if (d && vis.active && vis.mode === "nested" && vis.extracted && !d.multi && vis.extractCanvasPos) {
      var exWrap = document.createElement("div");
      exWrap.className = "node-wrap is-dragging node-wrap--extract";
      exWrap.style.left = vis.extractCanvasPos.x + "px";
      exWrap.style.top = vis.extractCanvasPos.y + "px";
      exWrap.style.zIndex = "40";
      exWrap.appendChild(renderNode(state.nodes[d.nodeId], false));
      dom.canvasContent.appendChild(exWrap);
    }
    dom.canvasEmpty.style.display = topLevel.length ? "none" : "flex";
    dom.dragPreview.style.display = "none";
  }

  function renderMarquee() {
    if (!state.marqueeRect) {
      dom.marquee.style.display = "none";
      return;
    }
    var m = state.marqueeRect;
    var cam = state.camera;
    dom.marquee.style.display = "block";
    dom.marquee.style.left = cam.x + m.x * cam.zoom + "px";
    dom.marquee.style.top = cam.y + m.y * cam.zoom + "px";
    dom.marquee.style.width = m.w * cam.zoom + "px";
    dom.marquee.style.height = m.h * cam.zoom + "px";
  }

  function renderBreadcrumb() {
    var parts = [{ label: "Root", index: -1 }];
    state.path.forEach(function (id, i) {
      var n = state.nodes[id];
      if (n) parts.push({ label: n.title, index: i });
    });
    dom.breadcrumb.innerHTML = "";
    parts.forEach(function (p, i) {
      if (i) dom.breadcrumb.appendChild(document.createTextNode(" / "));
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "link-btn";
      btn.textContent = p.label;
      btn.onclick = function () {
        state.path = p.index < 0 ? [] : state.path.slice(0, p.index + 1);
        state.selectedId = null;
        state.selectedIds = [];
        applyCamera({ x: 60, y: 60, zoom: 1 });
        emit();
      };
      dom.breadcrumb.appendChild(btn);
    });
  }

  var DSM_LABEL_W = 248;
  var DSM_PREFERRED_CELL = 30;
  var DSM_MIN_CELL = 24;
  var DSM_MAX_CELL = 36;
  var dsmHover = null;

  function dsmCellSize(rowCount) {
    var wrap = dom.dsmWrap;
    if (!wrap || !rowCount) return DSM_PREFERRED_CELL;
    var available = wrap.clientWidth - DSM_LABEL_W - 8;
    var fit = Math.floor(available / rowCount);
    if (fit >= DSM_PREFERRED_CELL) return Math.min(DSM_MAX_CELL, fit);
    if (fit >= DSM_MIN_CELL) return fit;
    return DSM_PREFERRED_CELL;
  }

  function dsmColHeaderHeight(rows, cellSize) {
    var longest = rows.reduce(function (m, r) { return Math.max(m, r.node.title.length); }, 0);
    var diagSpan = longest * 6.5 * 0.707 + 28;
    return Math.min(220, Math.max(72, Math.ceil(diagSpan), Math.ceil(cellSize * 2.5)));
  }

  function clearDsmHover(table) {
    if (!table) return;
    table.querySelectorAll(".hover-row, .hover-col, .hover-cross, .hover-active").forEach(function (el) {
      el.classList.remove("hover-row", "hover-col", "hover-cross", "hover-active");
    });
  }

  function applyDsmHover(table, hover) {
    clearDsmHover(table);
    if (!hover) return;
    if (hover.r != null) {
      table.querySelectorAll('.dsm-row-head[data-r="' + hover.r + '"]').forEach(function (el) { el.classList.add("hover-row"); });
      table.querySelectorAll('.dsm-cell[data-r="' + hover.r + '"]').forEach(function (el) {
        if (hover.c != null && el.getAttribute("data-c") === String(hover.c)) el.classList.add("hover-active");
        else el.classList.add("hover-cross");
      });
    }
    if (hover.c != null) {
      table.querySelectorAll('.dsm-col-head[data-c="' + hover.c + '"]').forEach(function (el) { el.classList.add("hover-col"); });
      if (hover.r == null) {
        table.querySelectorAll('.dsm-cell[data-c="' + hover.c + '"]').forEach(function (el) { el.classList.add("hover-cross"); });
      }
    }
  }

  function wireDsmHover(table) {
    table.onmouseleave = function () {
      dsmHover = null;
      clearDsmHover(table);
    };
    table.querySelectorAll(".dsm-row-head[data-r]").forEach(function (el) {
      el.onmouseenter = function () {
        dsmHover = { r: Number(el.getAttribute("data-r")) };
        applyDsmHover(table, dsmHover);
      };
    });
    table.querySelectorAll(".dsm-col-head[data-c]").forEach(function (el) {
      el.onmouseenter = function () {
        dsmHover = { c: Number(el.getAttribute("data-c")) };
        applyDsmHover(table, dsmHover);
      };
    });
    table.querySelectorAll(".dsm-cell[data-r][data-c]").forEach(function (el) {
      el.onmouseenter = function () {
        dsmHover = { r: Number(el.getAttribute("data-r")), c: Number(el.getAttribute("data-c")) };
        applyDsmHover(table, dsmHover);
      };
    });
  }

  function dsmKindClass(kind) {
    if (kind === "FUNCTION") return "dsm-label-function";
    if (kind === "NUMBER") return "dsm-label-number";
    if (kind === "OBJECT") return "dsm-label-object";
    return "";
  }

  function renderDsm() {
    var collapsed = state.dsmSearch ? new Set() : state.collapsed;
    var rows = flattenTree(state.nodes, collapsed);
    if (state.dsmSearch) {
      var q = state.dsmSearch.toLowerCase();
      var matched = Object.values(state.nodes).filter(function (n) { return n.title.toLowerCase().indexOf(q) >= 0; });
      var keep = new Set(matched.map(function (n) { return n.id; }));
      matched.forEach(function (n) { ancestorChain(state.nodes, n.id).forEach(function (a) { keep.add(a.id); }); });
      rows = rows.filter(function (r) { return keep.has(r.node.id); });
    }

    dom.dsmWrap.innerHTML = "";
    if (!rows.length) {
      dom.dsmWrap.textContent = state.dsmSearch ? 'Нет совпадений для "' + state.dsmSearch + '".' : "Нет элементов.";
      return;
    }

    var cellSize = dsmCellSize(rows.length);
    var colHeaderHeight = dsmColHeaderHeight(rows, cellSize);
    var tableMinWidth = DSM_LABEL_W + rows.length * cellSize;

    var table = document.createElement("table");
    table.className = "dsm-table";
    table.style.minWidth = tableMinWidth + "px";
    table.style.width = Math.max(tableMinWidth, dom.dsmWrap.clientWidth) + "px";
    var thead = document.createElement("thead");
    var hr = document.createElement("tr");
    var corner = document.createElement("th");
    corner.className = "dsm-corner";
    corner.style.height = colHeaderHeight + "px";
    corner.textContent = "rows ↓ / cols →";
    hr.appendChild(corner);
    rows.forEach(function (col, c) {
      var th = document.createElement("th");
      th.className = "dsm-col-head" + (col.node.type === "SPACE" ? " space-head" : "");
      th.setAttribute("data-c", String(c));
      th.style.width = cellSize + "px";
      th.style.minWidth = cellSize + "px";
      th.style.height = colHeaderHeight + "px";
      var wrap = document.createElement("div");
      wrap.className = "dsm-dlabel-wrap";
      var inner = document.createElement("div");
      inner.className = "dsm-dlabel";
      inner.title = col.node.title;
      if (col.node.type === "RECTANGLE") {
        var k = col.node.rectKind || "DEFAULT";
        var metaCol = RECT_KIND_META[k];
        var sp = document.createElement("span");
        sp.innerHTML = iconSvg(k === "FUNCTION" ? "function" : k === "NUMBER" ? "number" : k === "OBJECT" ? "object" : "square", 12);
        sp.style.color = metaCol.accent;
        inner.appendChild(sp);
      }
      var t = document.createElement("span");
      if (col.node.type === "RECTANGLE") {
        var kc = col.node.rectKind || "DEFAULT";
        t.className = dsmKindClass(kc);
      } else if (col.node.type === "SPACE") {
        t.style.color = "var(--muted)";
        t.style.opacity = "0.7";
      }
      t.textContent = col.node.title;
      inner.appendChild(t);
      wrap.appendChild(inner);
      th.appendChild(wrap);
      hr.appendChild(th);
    });
    thead.appendChild(hr);
    table.appendChild(thead);

    var tbody = document.createElement("tbody");
    rows.forEach(function (row, r) {
      var tr = document.createElement("tr");
      var th = document.createElement("th");
      th.className = "dsm-row-head" + (row.node.type === "SPACE" ? " space-head" : "");
      th.setAttribute("data-r", String(r));
      th.style.height = cellSize + "px";
      th.style.paddingLeft = 6 + row.depth * 14 + "px";
      if (row.hasChildren) {
        var toggle = document.createElement("button");
        toggle.type = "button";
        toggle.textContent = row.collapsed ? "▸" : "▾";
        toggle.onclick = function () {
          if (state.collapsed.has(row.node.id)) state.collapsed.delete(row.node.id);
          else state.collapsed.add(row.node.id);
          emit();
        };
        th.appendChild(toggle);
      } else {
        var sp = document.createElement("span");
        sp.style.width = "18px";
        sp.style.display = "inline-block";
        th.appendChild(sp);
      }
      if (row.node.type === "RECTANGLE") {
        var k2 = row.node.rectKind || "DEFAULT";
        var metaRow = RECT_KIND_META[k2];
        var ic = document.createElement("span");
        ic.innerHTML = iconSvg(k2 === "FUNCTION" ? "function" : k2 === "NUMBER" ? "number" : k2 === "OBJECT" ? "object" : "square", 12);
        ic.style.color = metaRow.accent;
        th.appendChild(ic);
      }
      var lbl = document.createElement("button");
      lbl.type = "button";
      lbl.className = "link-btn" + (row.node.type === "RECTANGLE" ? " " + dsmKindClass(row.node.rectKind || "DEFAULT") : "");
      lbl.textContent = row.node.title;
      lbl.onclick = function () { state.selectedId = row.node.id; state.selectedIds = [row.node.id]; emit(); };
      th.appendChild(lbl);
      tr.appendChild(th);

      rows.forEach(function (col, c) {
        var td = document.createElement("td");
        var isSpaceCell = row.node.type === "SPACE" || col.node.type === "SPACE";
        td.className = "dsm-cell" + (isSpaceCell ? " space" : "");
        td.setAttribute("data-r", String(r));
        td.setAttribute("data-c", String(c));
        td.style.width = cellSize + "px";
        td.style.minWidth = cellSize + "px";
        td.style.height = cellSize + "px";
        var isDiag = r === c;
        var cell = resolveCell(state.nodes, collapsed, row.node.id, col.node.id);
        var linkable = isLinkable(row.node) && isLinkable(col.node) && !isDiag &&
          !(collapsed.has(row.node.id) && childrenOf(state.nodes, row.node.id).length);
        if (isDiag) {
          td.classList.add("diag");
          td.innerHTML = '<span class="dot-sm"></span>';
        } else if (cell === "direct") {
          var srcKind = row.node.type === "RECTANGLE" ? (row.node.rectKind || "DEFAULT") : "DEFAULT";
          var dotClass = "dot-direct" + (RECT_KIND_META[srcKind].cssKind ? " " + RECT_KIND_META[srcKind].cssKind : "");
          td.innerHTML = '<span class="' + dotClass + '"></span>';
          if (linkable) {
            td.classList.add("clickable");
            td.onclick = function () {
              pushHistory();
              var src = state.nodes[row.node.id];
              var has = src.dependencies.indexOf(col.node.id) >= 0;
              src.dependencies = has ? src.dependencies.filter(function (d) { return d !== col.node.id; }) : src.dependencies.concat(col.node.id);
              emit();
            };
          }
        } else if (cell === "aggregate") {
          td.innerHTML = '<span class="dot-agg"></span>';
        } else if (linkable) {
          td.classList.add("clickable");
          td.onclick = function () {
            pushHistory();
            var src = state.nodes[row.node.id];
            src.dependencies = src.dependencies.concat(col.node.id);
            emit();
          };
        }
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    dom.dsmWrap.appendChild(table);
    wireDsmHover(table);
  }

  function renderLayout() {
    dom.canvasPanel.style.display = state.viewMode === "dsm" ? "none" : "block";
    dom.dsmPanel.style.display = state.viewMode === "canvas" ? "none" : "block";
    if (state.viewMode === "split") {
      dom.canvasPanel.style.flex = "1";
      dom.dsmPanel.style.width = "46%";
      dom.canvasPanel.style.display = "block";
      dom.dsmPanel.style.display = "block";
    }
    document.querySelectorAll("[data-view]").forEach(function (btn) {
      btn.classList.toggle("active", btn.getAttribute("data-view") === state.viewMode);
    });
  }

  function renderAll() {
    renderLayout();
    renderBreadcrumb();
    renderCanvas();
    renderDsm();
    renderMarquee();
  }

  function setupPointerHandlers() {
    dom.viewport.onpointerdown = function (e) {
      if (e.button !== 0) return;
      if (e.target.closest && e.target.closest(".bottom-dock, .canvas-controls")) return;
      dom.viewport.setPointerCapture(e.pointerId);
      if (e.shiftKey) {
        state.selectedId = null;
        state.selectedIds = [];
        var start = clientToCanvas(e.clientX, e.clientY);
        state.marquee = { pointerId: e.pointerId, startCanvas: start };
        state.marqueeRect = { x: start.x, y: start.y, w: 0, h: 0 };
        renderMarquee();
        return;
      }
      state.selectedId = null;
      state.selectedIds = [];
      state.pan = { pointerId: e.pointerId, x: e.clientX, y: e.clientY, camX: state.camera.x, camY: state.camera.y };
      state.panning = true;
      dom.viewport.classList.add("grabbing");
      emit();
    };

    window.addEventListener("pointermove", function (e) {
      var rect = dom.viewport.getBoundingClientRect();
      state.pointerInViewport = { x: e.clientX - rect.left, y: e.clientY - rect.top };

      if (state.marquee && e.pointerId === state.marquee.pointerId) {
        var cur = clientToCanvas(e.clientX, e.clientY);
        var sx = state.marquee.startCanvas.x;
        var sy = state.marquee.startCanvas.y;
        state.marqueeRect = {
          x: Math.min(sx, cur.x), y: Math.min(sy, cur.y),
          w: Math.abs(cur.x - sx), h: Math.abs(cur.y - sy),
        };
        var parentId = currentParentId();
        var hits = childrenOf(state.nodes, parentId).filter(function (n) {
          var nx = n.ui_position.x, ny = n.ui_position.y, nw = n.ui_size.width, nh = n.ui_size.height;
          var left = Math.min(sx, cur.x), right = Math.max(sx, cur.x);
          var top = Math.min(sy, cur.y), bottom = Math.max(sy, cur.y);
          return nx < right && nx + nw > left && ny < bottom && ny + nh > top;
        });
        state.selectedIds = hits.map(function (n) { return n.id; });
        state.selectedId = state.selectedIds[0] || null;
        renderMarquee();
        renderCanvas();
        return;
      }

      if (state.pan && e.pointerId === state.pan.pointerId) {
        applyCamera({
          zoom: state.camera.zoom,
          x: state.pan.camX + (e.clientX - state.pan.x),
          y: state.pan.camY + (e.clientY - state.pan.y),
        });
        return;
      }

      var d = state.drag;
      if (!d || e.pointerId !== d.pointerId) return;
      state.drag = CE.updateDrag({
        session: d,
        nodes: state.nodes,
        viewParentId: currentParentId(),
        clientX: e.clientX,
        clientY: e.clientY,
        viewport: viewportInfo(),
        dom: canvasDom,
      });
      state.hoverDropId = dragVisualState().hoverTarget;
      renderCanvas();
    });

    function finishPointer(e) {
      if (state.pan && e.pointerId === state.pan.pointerId) {
        state.pan = null;
        state.panning = false;
        dom.viewport.classList.remove("grabbing");
        return;
      }
      if (state.marquee && e.pointerId === state.marquee.pointerId) {
        state.marquee = null;
        state.marqueeRect = null;
        renderMarquee();
        return;
      }
      var d = state.drag;
      if (!d || e.pointerId !== d.pointerId) return;
      state.drag = null;
      if (!d.active) {
        state.selectedId = d.nodeId;
        state.selectedIds = [d.nodeId];
        if (state.nodes[d.nodeId] && state.nodes[d.nodeId].type === "SQUARE") {
          state.path = state.path.concat(d.nodeId);
          applyCamera({ x: 60, y: 60, zoom: 1 });
        }
      } else {
        pushHistory();
        applyNodeDrop(d, e.clientX, e.clientY);
      }
      state.hoverDropId = null;
      emit();
    }

    window.addEventListener("pointerup", finishPointer);
    window.addEventListener("pointercancel", releaseInteraction);
    window.addEventListener("blur", releaseInteraction);

    dom.viewport.addEventListener("wheel", function (e) {
      e.preventDefault();
      zoomAt(e.clientX, e.clientY, Math.exp(-e.deltaY * 0.0015));
    }, { passive: false });

    dom.viewport.addEventListener("mousemove", function (e) {
      var rect = dom.viewport.getBoundingClientRect();
      state.pointerInViewport = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    });
  }

  var BOARD_COMMAND_CODES = {
    KeyR: true, KeyE: true, KeyF: true, KeyZ: true, Space: true,
    Delete: true, Backspace: true, Equal: true, NumpadAdd: true,
    Minus: true, NumpadSubtract: true, Digit0: true,
  };

  function isEditableTarget(el, e) {
    if (!el || !el.tagName) return false;
    if (el.id === "dsm-search" && e && BOARD_COMMAND_CODES[e.code]) return false;
    if (el.classList && el.classList.contains("node-input")) return true;
    return el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable;
  }

  function modifiersMatch(e, spec) {
    var wantCtrl = spec.ctrl === true;
    var forbidCtrl = spec.ctrl === false;
    if (wantCtrl && !(e.ctrlKey || e.metaKey)) return false;
    if (forbidCtrl && (e.ctrlKey || e.metaKey)) return false;
    if (!wantCtrl && !forbidCtrl && (e.ctrlKey || e.metaKey)) return false;
    if (spec.shift === true && !e.shiftKey) return false;
    if (spec.shift === false && e.shiftKey) return false;
    if (spec.alt === true && !e.altKey) return false;
    if (spec.alt === false && e.altKey) return false;
    return true;
  }

  function matchHotkey(e, spec) {
    var codes = spec.codes || (spec.code ? [spec.code] : []);
    var keys = spec.keys || (spec.key ? [spec.key] : []);
    var codeMatch = codes.length > 0 && codes.indexOf(e.code) >= 0;
    var keyMatch = keys.length > 0 && keys.some(function (k) {
      return e.key === k || e.key.toLowerCase() === k.toLowerCase();
    });
    if (!codeMatch && !keyMatch) return false;
    return modifiersMatch(e, spec);
  }

  function setupHotkeys() {
    var cfg = window.HOTKEYS_CONFIG || {};
    var onKeyDown = function (e) {
      if (isEditableTarget(e.target, e)) return;
      if (e.repeat) return;
      var jitter = (Math.random() * 80 - 40) | 0;
      var pos = { x: 180 + jitter, y: 160 + jitter };

      if ((e.ctrlKey || e.metaKey) && e.code === "KeyZ" && !e.shiftKey) {
        e.preventDefault();
        e.stopPropagation();
        storeUndo();
        return;
      }

      if (matchHotkey(e, cfg.createRectangle || { code: "KeyR" })) { e.preventDefault(); e.stopPropagation(); storeAddNode("RECTANGLE", pos); return; }
      if (matchHotkey(e, cfg.createSpace || { code: "KeyE" })) { e.preventDefault(); e.stopPropagation(); storeAddNode("SPACE", pos); return; }
      if (matchHotkey(e, cfg.createSquare || { code: "KeyF" })) { e.preventDefault(); e.stopPropagation(); storeAddNode("SQUARE", pos); return; }
      if (matchHotkey(e, cfg.undo || { code: "KeyZ", ctrl: false })) { e.preventDefault(); e.stopPropagation(); storeUndo(); return; }
      if (matchHotkey(e, cfg.duplicate || { code: "Space" })) { e.preventDefault(); e.stopPropagation(); storeDuplicate(); return; }
      if (matchHotkey(e, cfg.delete || { codes: ["Delete", "Backspace"] })) { e.preventDefault(); e.stopPropagation(); storeDeleteSelected(); return; }
      if (matchHotkey(e, cfg.copy || { code: "KeyC", ctrl: true })) { e.preventDefault(); e.stopPropagation(); storeCopy(); return; }
      if (matchHotkey(e, cfg.paste || { code: "KeyV", ctrl: true })) { e.preventDefault(); e.stopPropagation(); storePaste(); return; }
      if (matchHotkey(e, cfg.zoomIn || { codes: ["Equal", "NumpadAdd"] })) { e.preventDefault(); e.stopPropagation(); zoomBy(1.2); return; }
      if (matchHotkey(e, cfg.zoomOut || { codes: ["Minus", "NumpadSubtract"] })) { e.preventDefault(); e.stopPropagation(); zoomBy(1 / 1.2); return; }
      if (matchHotkey(e, cfg.zoomReset || { code: "Digit0" })) { e.preventDefault(); e.stopPropagation(); applyCamera({ x: state.camera.x, y: state.camera.y, zoom: 1 }); return; }
    };
    window.addEventListener("keydown", onKeyDown, true);
  }

  function setupUI() {
    document.querySelectorAll("[data-view]").forEach(function (btn) {
      btn.onclick = function (e) {
        e.stopPropagation();
        state.viewMode = btn.getAttribute("data-view");
        emit();
      };
    });
    document.querySelectorAll("[data-spawn]").forEach(function (btn) {
      btn.onclick = function (e) {
        e.stopPropagation();
        var jitter = (Math.random() * 80 - 40) | 0;
        storeAddNode(btn.getAttribute("data-spawn"), { x: 160 + jitter, y: 140 + jitter });
      };
    });
    var bind = function (id, fn) {
      var el = $(id);
      if (el) el.onclick = function (e) { e.stopPropagation(); fn(); };
    };
    bind("btn-zoom-in", function () { zoomBy(1.2); });
    bind("btn-zoom-out", function () { zoomBy(1 / 1.2); });
    bind("btn-zoom-reset", function () { applyCamera({ x: state.camera.x, y: state.camera.y, zoom: 1 }); });
    bind("btn-recenter", recenterBoard);
    bind("btn-undo", storeUndo);
    bind("btn-duplicate", storeDuplicate);
    bind("btn-delete", storeDeleteSelected);
    if (dom.dsmSearch) dom.dsmSearch.oninput = function (e) { state.dsmSearch = e.target.value; emit(); };
    bind("btn-export", function () {
      var blob = new Blob([JSON.stringify({ version: 1, name: state.projectName, nodes: state.nodes }, null, 2)], { type: "application/json" });
      var a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = (state.projectName || "project").replace(/\s+/g, "-").toLowerCase() + ".canvas.json";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(a.href);
    });
    var fileImport = $("file-import");
    if (fileImport) {
      fileImport.onchange = function (e) {
        var file = e.target.files[0];
        if (!file) return;
        var reader = new FileReader();
        reader.onload = function () {
          try {
            var data = JSON.parse(reader.result);
            pushHistory();
            state.nodes = data.nodes;
            state.projectName = data.name || "Imported";
            state.path = [];
            state.selectedId = null;
            state.selectedIds = [];
            emit();
          } catch (err) {
            alert("Ошибка импорта: " + err.message);
          }
        };
        reader.readAsText(file);
        e.target.value = "";
      };
    }
    bind("btn-import", function () { if (fileImport) fileImport.click(); });
  }

  function init() {
    dom.viewport = $("canvas-viewport");
    dom.canvasLayer = $("canvas-layer");
    dom.canvasContent = $("canvas-content");
    dom.canvasEmpty = $("canvas-empty");
    dom.dragPreview = $("drag-preview");
    dom.marquee = $("marquee");
    dom.breadcrumb = $("breadcrumb");
    dom.canvasPanel = $("canvas-panel");
    dom.dsmPanel = $("dsm-panel");
    dom.dsmWrap = $("dsm-wrap");
    dom.dsmSearch = $("dsm-search");

    setupPointerHandlers();
    setupHotkeys();
    setupUI();
    subscribe(renderAll);
    applyCamera(state.camera);
    if (dom.dsmWrap && typeof ResizeObserver !== "undefined") {
      var dsmRo = new ResizeObserver(function () {
        if (state.viewMode === "canvas") return;
        renderDsm();
      });
      dsmRo.observe(dom.dsmWrap);
    }
    renderAll();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
