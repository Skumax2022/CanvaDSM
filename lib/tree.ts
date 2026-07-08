import type { NodeId, NodeMap, SysNode } from "./types"

/** direct children of a given parent, preserving insertion order of the map */
export function childrenOf(nodes: NodeMap, parentId: NodeId | null): SysNode[] {
  return Object.values(nodes).filter((n) => n.parentId === parentId)
}

/** all descendant ids of a node (deep) */
export function descendantIds(nodes: NodeMap, id: NodeId): NodeId[] {
  const out: NodeId[] = []
  const stack = childrenOf(nodes, id).map((n) => n.id)
  while (stack.length) {
    const cur = stack.pop() as NodeId
    out.push(cur)
    for (const c of childrenOf(nodes, cur)) stack.push(c.id)
  }
  return out
}

/** true if maybeAncestor is an ancestor of id (prevents drop cycles) */
export function isAncestor(nodes: NodeMap, maybeAncestor: NodeId, id: NodeId): boolean {
  let cur: NodeId | null = nodes[id]?.parentId ?? null
  while (cur) {
    if (cur === maybeAncestor) return true
    cur = nodes[cur]?.parentId ?? null
  }
  return false
}

/** ancestor chain from root down to (excluding) node */
export function ancestorChain(nodes: NodeMap, id: NodeId): SysNode[] {
  const chain: SysNode[] = []
  let cur: NodeId | null = nodes[id]?.parentId ?? null
  while (cur) {
    const node = nodes[cur]
    if (!node) break
    chain.unshift(node)
    cur = node.parentId
  }
  return chain
}

export interface DsmRow {
  node: SysNode
  depth: number
  /** whether this node has children in the full tree */
  hasChildren: boolean
  /** whether it is currently collapsed */
  collapsed: boolean
}

/**
 * Flattens the entire project tree (DFS) into an ordered list of visible rows,
 * honouring the collapsed set. Used for both DSM axes.
 */
export function flattenTree(nodes: NodeMap, collapsed: Set<NodeId>): DsmRow[] {
  const rows: DsmRow[] = []
  const walk = (parentId: NodeId | null, depth: number) => {
    for (const node of childrenOf(nodes, parentId)) {
      const kids = childrenOf(nodes, node.id)
      const hasChildren = kids.length > 0
      rows.push({ node, depth, hasChildren, collapsed: collapsed.has(node.id) })
      if (hasChildren && !collapsed.has(node.id)) {
        walk(node.id, depth + 1)
      }
    }
  }
  walk(null, 0)
  return rows
}

/** nodes that can hold dependencies (everything except spaces) */
export function isLinkable(node: SysNode): boolean {
  return node.type !== "SPACE"
}

export type CellState = "none" | "direct" | "aggregate"

/**
 * Resolves the DSM cell state for row=source, col=target.
 * - "direct": the visible source depends directly on the visible target.
 * - "aggregate": one is a collapsed parent whose hidden descendants carry
 *   a dependency to/from the other visible node (hollow indicator).
 */
export function resolveCell(
  nodes: NodeMap,
  collapsed: Set<NodeId>,
  sourceId: NodeId,
  targetId: NodeId,
): CellState {
  if (sourceId === targetId) return "none"
  const source = nodes[sourceId]
  const target = nodes[targetId]
  if (!source || !target) return "none"

  const sourceIds =
    collapsed.has(sourceId) && childrenOf(nodes, sourceId).length
      ? [sourceId, ...descendantIds(nodes, sourceId)]
      : [sourceId]
  const targetIds =
    collapsed.has(targetId) && childrenOf(nodes, targetId).length
      ? [targetId, ...descendantIds(nodes, targetId)]
      : [targetId]

  // direct link only when neither side is aggregated
  if (sourceIds.length === 1 && targetIds.length === 1) {
    if (isLinkable(source) && isLinkable(target) && source.dependencies.includes(targetId)) {
      return "direct"
    }
    return "none"
  }

  // aggregate: any hidden pair forms a link
  for (const s of sourceIds) {
    const sn = nodes[s]
    if (!sn || !isLinkable(sn)) continue
    for (const t of targetIds) {
      if (s === t) continue
      if (sn.dependencies.includes(t)) return "aggregate"
    }
  }
  return "none"
}
