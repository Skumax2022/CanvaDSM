import type { NodeId, NodeMap, SysNode } from "../types"

export function viewParentFromPath(path: NodeId[]): NodeId | null {
  return path.length ? path[path.length - 1] : null
}

/** Node is a direct child of the current canvas view (free ui_position). */
export function isCanvasChild(
  nodeParentId: NodeId | null,
  viewParentId: NodeId | null,
): boolean {
  return nodeParentId === viewParentId
}

/** Node lives in a flex auto-layout body (not on canvas level). */
export function isNestedChild(
  nodeParentId: NodeId | null,
  viewParentId: NodeId | null,
): boolean {
  return nodeParentId != null && nodeParentId !== viewParentId
}

export function isContainer(node: SysNode | undefined): boolean {
  return node?.type === "SPACE" || node?.type === "RECTANGLE"
}

export function canAcceptChildren(node: SysNode | undefined): boolean {
  return isContainer(node)
}

/** Drop target must be SPACE or RECTANGLE and not forbidden. */
export function isValidNestTarget(
  nodes: NodeMap,
  targetId: NodeId,
  forbidden: Set<NodeId>,
): boolean {
  if (forbidden.has(targetId)) return false
  return canAcceptChildren(nodes[targetId])
}
