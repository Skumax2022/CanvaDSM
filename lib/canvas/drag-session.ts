import type { NodeId, NodeMap } from "../types"
import { descendantIds } from "../tree"
import {
  bodyLocalFromClient,
  bodyPosFromClient,
  canvasPosFromClient,
  clientToCanvas,
  nodeCanvasOriginFromScreen,
  screenToBodyLocal,
} from "./coords"
import { insertIndexInParent } from "./layout-query"
import type {
  CanvasDomAdapter,
  DragMode,
  DragSession,
  DragVisual,
  DropIntent,
  Point,
  ViewportInfo,
} from "./types"
import { DRAG_THRESHOLD_PX } from "./types"
import { isCanvasChild, isNestedChild, isValidNestTarget } from "./view"

export interface BeginDragInput {
  nodeId: NodeId
  selectedIds: NodeId[]
  nodes: NodeMap
  viewParentId: NodeId | null
  pointerId: number
  clientX: number
  clientY: number
  nodeScreenRect: { left: number; top: number; width: number; height: number }
  viewport: ViewportInfo
  dom: CanvasDomAdapter
}

export interface UpdateDragInput {
  session: DragSession
  nodes: NodeMap
  viewParentId: NodeId | null
  clientX: number
  clientY: number
  viewport: ViewportInfo
  dom: CanvasDomAdapter
}

export interface ResolveDropInput {
  session: DragSession
  nodes: NodeMap
  viewParentId: NodeId | null
  clientX: number
  clientY: number
  viewport: ViewportInfo
  dom: CanvasDomAdapter
}

function dragModeFor(nodeParentId: NodeId | null, viewParentId: NodeId | null): DragMode {
  return isNestedChild(nodeParentId, viewParentId) ? "nested" : "canvas"
}

function buildForbidden(nodes: NodeMap, rootIds: NodeId[]): Set<NodeId> {
  const forbidden = new Set<NodeId>()
  for (const id of rootIds) {
    forbidden.add(id)
    for (const d of descendantIds(nodes, id)) forbidden.add(d)
  }
  return forbidden
}

function collectDragIds(
  nodeId: NodeId,
  selectedIds: NodeId[],
  nodes: NodeMap,
  viewParentId: NodeId | null,
): NodeId[] {
  const node = nodes[nodeId]
  if (!node) return [nodeId]

  if (selectedIds.includes(nodeId) && selectedIds.length > 1) {
    const sameParent = selectedIds.filter((id) => nodes[id]?.parentId === node.parentId)
    return sameParent.includes(nodeId) ? sameParent : [nodeId]
  }
  return [nodeId]
}

export function beginDrag(input: BeginDragInput): DragSession {
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
    dom,
  } = input

  const node = nodes[nodeId]
  const nodeIds = collectDragIds(nodeId, selectedIds, nodes, viewParentId)
  const mode = dragModeFor(node?.parentId ?? null, viewParentId)

  const ptCanvas = clientToCanvas(clientX, clientY, viewport)
  const nodeOrigin = nodeCanvasOriginFromScreen(nodeScreenRect.left, nodeScreenRect.top, viewport)
  const grabCanvas: Point = { x: ptCanvas.x - nodeOrigin.x, y: ptCanvas.y - nodeOrigin.y }

  let grabBody: Point = grabCanvas
  if (mode === "nested" && node?.parentId) {
    const body = dom.bodyRect(node.parentId)
    if (body) {
      const ptBody = screenToBodyLocal(clientX, clientY, body, viewport.camera.zoom)
      const nodeBodyOrigin = screenToBodyLocal(
        nodeScreenRect.left,
        nodeScreenRect.top,
        body,
        viewport.camera.zoom,
      )
      grabBody = { x: ptBody.x - nodeBodyOrigin.x, y: ptBody.y - nodeBodyOrigin.y }
    }
  }

  const startPositions: Record<NodeId, Point> = {}
  for (const id of nodeIds) {
    const n = nodes[id]
    if (n) startPositions[id] = { x: n.ui_position.x, y: n.ui_position.y }
  }

  const startPos = startPositions[nodeId] ?? { x: 0, y: 0 }

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
    hoverTarget: null,
  }
}

export function updateDrag(input: UpdateDragInput): DragSession {
  const { session, nodes, viewParentId, clientX, clientY, viewport, dom } = input
  const dx = clientX - session.startClient.x
  const dy = clientY - session.startClient.y
  const active = session.active || Math.hypot(dx, dy) >= DRAG_THRESHOLD_PX

  const next: DragSession = {
    ...session,
    active,
    targetCanvas: canvasPosFromClient(clientX, clientY, viewport, session.grabCanvas),
  }

  if (!active) return next

  if (next.mode === "canvas") {
    next.extracted = false
    next.reorderIndex = null
    next.targetBody = { x: 0, y: 0 }
    next.hoverTarget = next.multi ? null : dom.dropTargetAt(clientX, clientY, next.forbidden)
    return next
  }

  const node = nodes[next.nodeId]
  const parentId = node?.parentId
  if (!parentId) {
    next.mode = "canvas"
    next.hoverTarget = dom.dropTargetAt(clientX, clientY, next.forbidden)
    return next
  }

  const inBody = dom.pointInBody(parentId, clientX, clientY)
  next.extracted = !inBody

  if (next.extracted) {
    next.reorderIndex = null
    next.targetBody = { x: 0, y: 0 }
    next.hoverTarget = next.multi ? null : dom.dropTargetAt(clientX, clientY, next.forbidden)
    return next
  }

  const body = dom.bodyRect(parentId)
  if (body) {
    next.targetBody = bodyPosFromClient(
      clientX,
      clientY,
      body,
      viewport.camera.zoom,
      next.grabBody,
    )
    const local = bodyLocalFromClient(clientX, clientY, body, viewport.camera.zoom)
    next.reorderIndex = insertIndexInParent(nodes, parentId, next.nodeId, local.x, local.y)
  }
  next.hoverTarget = next.multi ? null : dom.dropTargetAt(clientX, clientY, next.forbidden)
  return next
}

export function resolveDrop(input: ResolveDropInput): DropIntent {
  const { session, nodes, viewParentId, clientX, clientY, viewport, dom } = input

  if (!session.active) return { kind: "none" }

  if (session.multi) {
    const delta = {
      x: session.targetCanvas.x - (session.startPositions[session.nodeId]?.x ?? 0),
      y: session.targetCanvas.y - (session.startPositions[session.nodeId]?.y ?? 0),
    }
    return {
      kind: "move-batch",
      updates: session.nodeIds.map((id) => ({
        id,
        position: {
          x: (session.startPositions[id]?.x ?? 0) + delta.x,
          y: (session.startPositions[id]?.y ?? 0) + delta.y,
        },
      })),
    }
  }

  const node = nodes[session.nodeId]
  if (!node) return { kind: "none" }

  if (session.mode === "nested" && node.parentId && !session.extracted) {
    if (dom.pointInBody(node.parentId, clientX, clientY)) {
      const body = dom.bodyRect(node.parentId)
      const local = body
        ? bodyLocalFromClient(clientX, clientY, body, viewport.camera.zoom)
        : { x: 0, y: 0 }
      const index =
        session.reorderIndex ??
        insertIndexInParent(nodes, node.parentId, session.nodeId, local.x, local.y)
      return { kind: "reorder", childId: session.nodeId, parentId: node.parentId, index }
    }
  }

  const target = dom.dropTargetAt(clientX, clientY, session.forbidden)
  if (target !== "root" && isValidNestTarget(nodes, target, session.forbidden)) {
    const body = dom.bodyRect(target)
    const local = body
      ? bodyLocalFromClient(clientX, clientY, body, viewport.camera.zoom)
      : { x: 0, y: 0 }
    const index = insertIndexInParent(nodes, target, session.nodeId, local.x, local.y)
    return { kind: "nest", childId: session.nodeId, targetId: target, index }
  }

  const position = canvasPosFromClient(clientX, clientY, viewport, session.grabCanvas)
  return { kind: "move", childId: session.nodeId, parentId: viewParentId, position }
}

export function toVisual(session: DragSession | null): DragVisual {
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
      bodyLocalPos: null,
    }
  }

  const start = session.startPositions[session.nodeId] ?? { x: 0, y: 0 }
  const canvasDelta =
    session.mode === "canvas" && !session.extracted
      ? { x: session.targetCanvas.x - start.x, y: session.targetCanvas.y - start.y }
      : null

  return {
    dragIds: session.nodeIds,
    active: true,
    mode: session.mode,
    extracted: session.extracted,
    hoverTarget: session.hoverTarget,
    reorderIndex: session.reorderIndex,
    canvasDelta,
    extractCanvasPos: session.extracted ? session.targetCanvas : null,
    bodyLocalPos: session.mode === "nested" && !session.extracted ? session.targetBody : null,
  }
}

export function isDraggingNode(session: DragSession | null, nodeId: NodeId): boolean {
  if (!session?.active) return false
  if (!session.nodeIds.includes(nodeId)) return false
  if (session.extracted && session.nodeId === nodeId) return false
  return true
}

export function isGhostInParent(session: DragSession | null, parentId: NodeId, childId: NodeId): boolean {
  if (!session?.active || session.extracted) return false
  if (session.mode !== "nested") return false
  const node = session.nodeId
  if (childId !== node) return false
  const dragged = session.nodeId
  return session.nodeIds.includes(dragged) && session.nodeId === childId
}

/** @deprecated use isCanvasChild */
export { isCanvasChild, isNestedChild }
