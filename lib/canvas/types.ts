import type { NodeId } from "../types"

export interface Point {
  x: number
  y: number
}

export interface Camera {
  x: number
  y: number
  zoom: number
}

export const DRAG_THRESHOLD_PX = 4

/** Free positioning on the current canvas view vs flex reorder inside a parent body. */
export type DragMode = "canvas" | "nested"

export type HoverTarget = NodeId | "root" | null

export interface DragSession {
  nodeId: NodeId
  nodeIds: NodeId[]
  pointerId: number
  mode: DragMode
  multi: boolean
  forbidden: Set<NodeId>

  /** Grab offset: pointer minus node top-left in canvas space. */
  grabCanvas: Point
  /** Grab offset inside parent body (nested mode only). */
  grabBody: Point

  startClient: Point
  startPositions: Record<NodeId, Point>

  active: boolean
  extracted: boolean
  targetCanvas: Point
  targetBody: Point
  reorderIndex: number | null
  hoverTarget: HoverTarget
}

export type DropIntent =
  | { kind: "none" }
  | { kind: "reorder"; childId: NodeId; parentId: NodeId; index: number }
  | { kind: "nest"; childId: NodeId; targetId: NodeId; index: number }
  | { kind: "move"; childId: NodeId; parentId: NodeId | null; position: Point }
  | { kind: "move-batch"; updates: Array<{ id: NodeId; position: Point }> }

/** Visual overlay state derived from an active drag session. */
export interface DragVisual {
  dragIds: NodeId[]
  active: boolean
  mode: DragMode
  extracted: boolean
  hoverTarget: HoverTarget
  reorderIndex: number | null
  /** Delta for top-level canvas nodes during free drag. */
  canvasDelta: Point | null
  /** Floating preview position when extracted from nested parent. */
  extractCanvasPos: Point | null
  /** Ghost position inside parent body during nested reorder. */
  bodyLocalPos: Point | null
}

export interface ViewportInfo {
  rect: { left: number; top: number; width: number; height: number }
  camera: Camera
}

export interface BodyRect {
  left: number
  top: number
  width: number
  height: number
}

/** DOM adapter — injectable for tests and React/standalone. */
export interface CanvasDomAdapter {
  bodyRect(parentId: NodeId): BodyRect | null
  dropTargetAt(clientX: number, clientY: number, forbidden: Set<NodeId>): NodeId | "root"
  pointInBody(parentId: NodeId, clientX: number, clientY: number): boolean
}
