import {
  findInsertIndex,
  layoutItemsFromChildren,
  measureContainerSizeFromNodes,
  minInnerWidthFor,
  sortChildrenByOrder,
} from "../auto-layout"
import { childrenOf } from "../tree"
import type { NodeId, NodeMap } from "../types"

export function innerBodyWidth(nodes: NodeMap, parentId: NodeId): number {
  const parent = nodes[parentId]
  if (!parent) return 240
  const ch = childrenOf(nodes, parentId)
  return measureContainerSizeFromNodes(nodes, ch, minInnerWidthFor(parent)).bodyWidth
}

export function insertIndexInParent(
  nodes: NodeMap,
  parentId: NodeId,
  excludeChildId: NodeId | null,
  localX: number,
  localY: number,
): number {
  const siblings = sortChildrenByOrder(childrenOf(nodes, parentId)).filter(
    (c) => c.id !== excludeChildId,
  )
  const items = layoutItemsFromChildren(siblings)
  const innerW = innerBodyWidth(nodes, parentId)
  return findInsertIndex(items, innerW, localX, localY)
}
