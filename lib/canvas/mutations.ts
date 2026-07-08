import {
  applyReorder,
  nextChildOrder,
  sortChildrenByOrder,
  syncContainerBranch,
} from "../auto-layout"
import { childrenOf, isAncestor } from "../tree"
import type { NodeId, NodeMap } from "../types"
import type { DropIntent } from "./types"

function intoLayoutParent(
  newParentId: NodeId | null,
  viewParentId: NodeId | null,
): boolean {
  return newParentId != null && newParentId !== viewParentId
}

export function applyDropIntent(
  nodes: NodeMap,
  intent: DropIntent,
  viewParentId: NodeId | null,
): NodeMap {
  switch (intent.kind) {
    case "none":
      return nodes

    case "move-batch": {
      const out = { ...nodes }
      for (const { id, position } of intent.updates) {
        if (out[id]) out[id] = { ...out[id], ui_position: position }
      }
      return out
    }

    case "reorder": {
      const siblings = sortChildrenByOrder(childrenOf(nodes, intent.parentId))
      const reordered = applyReorder(siblings, intent.childId, intent.index)
      let out = { ...nodes }
      for (const n of reordered) out[n.id] = n
      return syncContainerBranch(out, intent.parentId)
    }

    case "nest": {
      const node = nodes[intent.childId]
      if (!node || intent.childId === intent.targetId) return nodes
      if (isAncestor(nodes, intent.childId, intent.targetId)) return nodes

      const oldParent = node.parentId
      let out = { ...nodes }
      out[intent.childId] = {
        ...node,
        parentId: intent.targetId,
        ui_position: { x: 0, y: 0 },
        ui_order: intent.index,
      }
      const reordered = applyReorder(childrenOf(out, intent.targetId), intent.childId, intent.index)
      for (const n of reordered) out[n.id] = n
      out = syncContainerBranch(out, intent.targetId)
      if (oldParent && oldParent !== intent.targetId) {
        out = syncContainerBranch(out, oldParent)
      }
      return out
    }

    case "move": {
      const node = nodes[intent.childId]
      if (!node) return nodes
      const oldParent = node.parentId
      const nesting = intoLayoutParent(intent.parentId, viewParentId)

      let out = { ...nodes }
      out[intent.childId] = {
        ...node,
        parentId: intent.parentId,
        ui_position: nesting ? { x: 0, y: 0 } : intent.position,
        ui_order: nesting
          ? nextChildOrder(childrenOf(out, intent.parentId).filter((c) => c.id !== intent.childId))
          : undefined,
      }
      if (!nesting && intent.parentId == null) {
        delete out[intent.childId].ui_order
      }
      if (oldParent && oldParent !== intent.parentId) {
        out = syncContainerBranch(out, oldParent)
      }
      return out
    }

    default:
      return nodes
  }
}
