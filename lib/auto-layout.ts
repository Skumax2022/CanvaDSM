import type { NodeId, NodeMap, NodeType, SysNode } from "./types"
import { childrenOf } from "./tree"

const DEFAULT_EMPTY_SIZE: Record<"SPACE" | "RECTANGLE", { width: number; height: number }> = {
  SPACE: { width: 420, height: 320 },
  RECTANGLE: { width: 240, height: 72 },
}

export function defaultEmptySize(node: SysNode): { width: number; height: number } {
  if (node.type === "SPACE" || node.type === "RECTANGLE") return DEFAULT_EMPTY_SIZE[node.type]
  return node.ui_size
}

export function isContainerType(type: NodeType): boolean {
  return type === "SPACE" || type === "RECTANGLE"
}

export const LAYOUT_GAP = 12
export const LAYOUT_PAD = 12
export const NESTED_HEADER_H = 36
export const NESTED_BODY_MIN = 48
/** Prefer a single row up to this content width; beyond that, wrap. */
export const MAX_SINGLE_ROW_WIDTH = 960

export interface LayoutSize {
  bodyWidth: number
  bodyHeight: number
  containerWidth: number
  containerHeight: number
}

export interface LayoutItem {
  id?: NodeId
  w: number
  h: number
}

export interface FlexLayoutResult {
  width: number
  height: number
  rowWidths: number[]
}

/** Stable sort key — ui_order preferred, legacy ui_position as fallback. */
export function childSortKey(node: SysNode): number {
  if (node.ui_order != null) return node.ui_order
  return node.ui_position.x * 1000 + node.ui_position.y
}

export function sortChildrenByOrder(children: SysNode[]): SysNode[] {
  return children.slice().sort((a, b) => childSortKey(a) - childSortKey(b))
}

export function nextChildOrder(children: SysNode[]): number {
  if (!children.length) return 0
  return Math.max(...children.map((c) => c.ui_order ?? childSortKey(c))) + 1
}

export function isLayoutContainer(node: SysNode, nodes: NodeMap): boolean {
  if (!isContainerType(node.type)) return false
  return childrenOf(nodes, node.id).length > 0
}

function collectContainerIds(nodes: NodeMap, rootId: NodeId, acc: Set<NodeId>) {
  for (const ch of childrenOf(nodes, rootId)) {
    if (isContainerType(ch.type)) acc.add(ch.id)
    collectContainerIds(nodes, ch.id, acc)
  }
}

function syncContainerIds(nodes: NodeMap, ids: Iterable<NodeId>): NodeMap {
  let out = { ...nodes }
  const sorted = [...ids].sort((a, b) => nodeDepth(out, b) - nodeDepth(out, a))

  for (const id of sorted) {
    const node = out[id]
    if (!node || !isContainerType(node.type)) continue
    const ch = sortChildrenByOrder(childrenOf(out, id))
    if (!ch.length) {
      out[id] = { ...node, ui_size: defaultEmptySize(node) }
      continue
    }
    const sized = measureContainerSizeFromNodes(out, ch, minInnerWidthFor(node))
    out[id] = {
      ...node,
      ui_size: { width: sized.containerWidth, height: sized.containerHeight },
    }
  }

  return out
}

export function minInnerWidthFor(node: SysNode): number {
  return node.type === "SPACE" ? 280 : 220
}

export function maxItemWidth(items: LayoutItem[]): number {
  if (!items.length) return 0
  return Math.max(...items.map((i) => i.w))
}

export function sumRowWidth(items: LayoutItem[], gap = LAYOUT_GAP): number {
  return items.reduce((s, c, i) => s + c.w + (i ? gap : 0), 0)
}

/** Flex-wrap layout simulation — matches CSS flex-wrap + gap in .node-body. */
export function computeFlexLayout(
  items: LayoutItem[],
  innerWidth: number,
  gap = LAYOUT_GAP,
): FlexLayoutResult {
  if (!items.length) {
    return { width: innerWidth, height: NESTED_BODY_MIN, rowWidths: [] }
  }

  let x = 0
  let y = 0
  let rowH = 0
  const rowWidths: number[] = []
  let currentRowW = 0

  for (const item of items) {
    if (x > 0 && x + item.w > innerWidth) {
      rowWidths.push(currentRowW)
      y += rowH + gap
      x = 0
      rowH = 0
      currentRowW = 0
    }
    rowH = Math.max(rowH, item.h)
    x += item.w + gap
    currentRowW = x > 0 ? x - gap : 0
  }

  if (currentRowW > 0 || items.length > 0) {
    rowWidths.push(currentRowW)
  }

  const maxRowW = rowWidths.length ? Math.max(...rowWidths) : 0
  const contentH = y + rowH

  return {
    width: maxRowW > 0 ? maxRowW : innerWidth,
    height: Math.max(NESTED_BODY_MIN, contentH),
    rowWidths,
  }
}

/** Pick wrap width: single row when reasonable, otherwise wrap at floor width. */
export function resolveWrapWidth(items: LayoutItem[], minInnerWidth: number): number {
  if (!items.length) return minInnerWidth
  const oneRowW = sumRowWidth(items)
  const floorW = Math.max(minInnerWidth, maxItemWidth(items))
  if (oneRowW <= MAX_SINGLE_ROW_WIDTH) {
    return Math.max(floorW, oneRowW)
  }
  return floorW
}

export function measureContainerSizeFromItems(
  items: LayoutItem[],
  minInnerWidth = 240,
): LayoutSize {
  if (!items.length) {
    const pad = LAYOUT_PAD * 2
    return {
      bodyWidth: minInnerWidth,
      bodyHeight: NESTED_BODY_MIN,
      containerWidth: minInnerWidth + pad,
      containerHeight: NESTED_BODY_MIN + pad + NESTED_HEADER_H,
    }
  }

  const wrapW = resolveWrapWidth(items, minInnerWidth)
  let layout = computeFlexLayout(items, wrapW)

  // If a row is wider than the initial wrap width (e.g. one very wide child), re-layout once.
  if (layout.width > wrapW) {
    layout = computeFlexLayout(items, layout.width)
  }

  const pad = LAYOUT_PAD * 2
  const bodyWidth = Math.max(minInnerWidth, layout.width)
  return {
    bodyWidth,
    bodyHeight: layout.height,
    containerWidth: bodyWidth + pad,
    containerHeight: layout.height + pad + NESTED_HEADER_H,
  }
}

/** Effective footprint of a node — recurses into nested containers. */
export function effectiveNodeSize(nodes: NodeMap, id: NodeId): { width: number; height: number } {
  const node = nodes[id]
  if (!node) return { width: 0, height: 0 }
  const ch = sortChildrenByOrder(childrenOf(nodes, id))
  if (isContainerType(node.type) && ch.length > 0) {
    const sized = measureContainerSizeFromNodes(nodes, ch, minInnerWidthFor(node))
    return { width: sized.containerWidth, height: sized.containerHeight }
  }
  if (isContainerType(node.type) && ch.length === 0) {
    return defaultEmptySize(node)
  }
  return { width: node.ui_size.width, height: node.ui_size.height }
}

export function measureContainerSizeFromNodes(
  nodes: NodeMap,
  children: SysNode[],
  minInnerWidth = 240,
): LayoutSize {
  const sorted = sortChildrenByOrder(children)
  const items = sorted.map((c) => {
    const s = effectiveNodeSize(nodes, c.id)
    return { id: c.id, w: s.width, h: s.height }
  })
  return measureContainerSizeFromItems(items, minInnerWidth)
}

/** Measure container from child nodes using each child's current ui_size. */
export function measureContainerSize(
  children: SysNode[],
  minInnerWidth = 240,
): LayoutSize {
  const sorted = sortChildrenByOrder(children)
  const items = sorted.map((c) => ({ id: c.id, w: c.ui_size.width, h: c.ui_size.height }))
  return measureContainerSizeFromItems(items, minInnerWidth)
}

export function nodeDepth(nodes: NodeMap, id: NodeId): number {
  let depth = 0
  let cur: NodeId | null = nodes[id]?.parentId ?? null
  while (cur) {
    depth += 1
    cur = nodes[cur]?.parentId ?? null
  }
  return depth
}

/** Bottom-up sync of all nested container ui_size values. */
export function syncAllContainerLayouts(nodes: NodeMap): NodeMap {
  const ids = Object.keys(nodes).filter((id) => isContainerType(nodes[id].type))
  return syncContainerIds(nodes, ids)
}

/** Insertion index when dropping/reordering inside a flex body. */
export function findInsertIndex(
  items: LayoutItem[],
  innerWidth: number,
  localX: number,
  localY: number,
): number {
  if (!items.length) return 0
  let x = 0
  let y = 0
  let rowH = 0
  let index = 0

  for (const item of items) {
    if (x > 0 && x + item.w > innerWidth) {
      y += rowH + LAYOUT_GAP
      x = 0
      rowH = 0
    }
    const midX = x + item.w / 2
    const rowBottom = y + item.h
    if (localY < y + item.h * 0.35) return index
    if (localY <= rowBottom + 4 && localX < midX) return index
    rowH = Math.max(rowH, item.h)
    x += item.w + LAYOUT_GAP
    index += 1
  }
  return index
}

export function layoutItemsFromChildren(children: SysNode[]): LayoutItem[] {
  return sortChildrenByOrder(children).map((c) => ({
    id: c.id,
    w: c.ui_size.width,
    h: c.ui_size.height,
  }))
}

export function applyReorder(parentChildren: SysNode[], childId: NodeId, newIndex: number): SysNode[] {
  const sorted = sortChildrenByOrder(parentChildren)
  const moving = sorted.find((c) => c.id === childId)
  if (!moving) return sorted
  const rest = sorted.filter((c) => c.id !== childId)
  const idx = Math.max(0, Math.min(newIndex, rest.length))
  rest.splice(idx, 0, moving)
  return rest.map((c, i) => ({ ...c, ui_order: i, ui_position: { x: 0, y: 0 } }))
}

export function syncContainerLayout(nodes: NodeMap, parentId: NodeId): NodeMap {
  return syncAllContainerLayouts(nodes)
}

export function syncContainerBranch(nodes: NodeMap, startId: NodeId | null): NodeMap {
  if (!startId) return nodes
  const toSync = new Set<NodeId>()
  let cur: NodeId | null = startId
  while (cur) {
    toSync.add(cur)
    collectContainerIds(nodes, cur, toSync)
    cur = nodes[cur]?.parentId ?? null
  }
  return syncContainerIds(nodes, toSync)
}
