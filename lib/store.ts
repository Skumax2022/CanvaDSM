"use client"

import { create } from "zustand"
import type { NodeId, NodeMap, NodeType, RectKind, SysNode, ViewMode, ProjectFile } from "./types"
import { MOCK_NODES, normalizeLayoutOrders } from "./mock-data"
import { descendantIds, isAncestor, childrenOf } from "./tree"
import {
  applyReorder,
  findInsertIndex,
  layoutItemsFromChildren,
  measureContainerSize,
  minInnerWidthFor,
  nextChildOrder,
  sortChildrenByOrder,
  syncAllContainerLayouts,
  syncContainerBranch,
  LAYOUT_PAD,
} from "./auto-layout"

let idSeq = 0
function makeId(type: NodeType): NodeId {
  idSeq += 1
  return `${type.toLowerCase()}-${Date.now().toString(36)}-${idSeq}`
}

const DEFAULT_SIZE: Record<NodeType, { width: number; height: number }> = {
  SPACE: { width: 420, height: 320 },
  RECTANGLE: { width: 240, height: 72 },
  SQUARE: { width: 96, height: 96 },
}

const DEFAULT_TITLE: Record<NodeType, string> = {
  SPACE: "New Space",
  RECTANGLE: "New Rectangle",
  SQUARE: "New Square",
}

const RECT_KINDS: RectKind[] = ["DEFAULT", "FUNCTION", "NUMBER", "OBJECT"]

interface HistorySnapshot {
  nodes: NodeMap
  path: NodeId[]
  selectedId: NodeId | null
  selectedIds: NodeId[]
}

function cloneNodes(nodes: NodeMap): NodeMap {
  return JSON.parse(JSON.stringify(nodes)) as NodeMap
}

function snapshot(state: Pick<AppState, "nodes" | "path" | "selectedId" | "selectedIds">): HistorySnapshot {
  return {
    nodes: cloneNodes(state.nodes),
    path: [...state.path],
    selectedId: state.selectedId,
    selectedIds: [...state.selectedIds],
  }
}

interface AppState {
  nodes: NodeMap
  projectName: string
  path: NodeId[]
  viewMode: ViewMode
  selectedId: NodeId | null
  selectedIds: NodeId[]
  collapsed: Set<NodeId>
  dsmSearch: string
  history: HistorySnapshot[]
  clipboard: SysNode | null

  currentParentId: () => NodeId | null

  pushHistory: () => void
  undo: () => void

  addNode: (type: NodeType, position: { x: number; y: number }, parentId?: NodeId | null) => void
  setTitle: (id: NodeId, title: string) => void
  moveNode: (id: NodeId, position: { x: number; y: number }) => void
  moveNodesBatch: (updates: { id: NodeId; position: { x: number; y: number } }[]) => void
  reparent: (id: NodeId, newParentId: NodeId | null, position?: { x: number; y: number }, insertIndex?: number) => void
  reorderInParent: (childId: NodeId, newIndex: number) => void
  setNodesFromDrop: (nodes: NodeMap) => void
  syncContainerLayout: (parentId: NodeId) => void
  syncAllLayouts: () => void
  deleteNode: (id: NodeId) => void
  deleteSelected: () => void
  select: (id: NodeId | null) => void
  selectMany: (ids: NodeId[]) => void
  toggleSelect: (id: NodeId) => void
  cycleRectKind: (id: NodeId) => void
  duplicateSelected: () => void
  copySelected: () => void
  pasteClipboard: (position?: { x: number; y: number }) => void

  enterSquare: (squareId: NodeId) => void
  navigateTo: (index: number) => void

  setViewMode: (mode: ViewMode) => void

  toggleCollapse: (id: NodeId) => void
  toggleDependency: (sourceId: NodeId, targetId: NodeId) => void
  setDsmSearch: (q: string) => void

  loadProject: (file: ProjectFile) => void
  reset: () => void
}

export const useStore = create<AppState>((set, get) => ({
  nodes: syncAllContainerLayouts(normalizeLayoutOrders(MOCK_NODES)),
  projectName: "Untitled System",
  path: [],
  viewMode: "split",
  selectedId: null,
  selectedIds: [],
  collapsed: new Set<NodeId>(),
  dsmSearch: "",
  history: [],
  clipboard: null,

  currentParentId: () => {
    const { path } = get()
    return path.length ? path[path.length - 1] : null
  },

  pushHistory: () =>
    set((state) => ({
      history: [...state.history.slice(-49), snapshot(state)],
    })),

  undo: () =>
    set((state) => {
      if (!state.history.length) return state
      const prev = state.history[state.history.length - 1]
      return {
        history: state.history.slice(0, -1),
        nodes: prev.nodes,
        path: prev.path,
        selectedId: prev.selectedId,
        selectedIds: prev.selectedIds,
      }
    }),

  addNode: (type, position, parentId) => {
    get().pushHistory()
    set((state) => {
      const pid = parentId !== undefined ? parentId : state.path.length ? state.path[state.path.length - 1] : null
      const id = makeId(type)
      const siblings = childrenOf(state.nodes, pid)
      const node: SysNode = {
        id,
        type,
        rectKind: type === "RECTANGLE" ? "DEFAULT" : undefined,
        title: DEFAULT_TITLE[type],
        parentId: pid,
        dependencies: [],
        ui_position: position,
        ui_size: DEFAULT_SIZE[type],
      }
      const nodes = { ...state.nodes, [id]: node }
      return { nodes: syncContainerBranch(nodes, pid), selectedId: id, selectedIds: [id] }
    })
  },

  syncAllLayouts: () =>
    set((state) => ({ nodes: syncAllContainerLayouts(state.nodes) })),

  syncContainerLayout: (parentId) =>
    set((state) => ({ nodes: syncContainerBranch(state.nodes, parentId) })),

  reorderInParent: (childId, newIndex) => {
    get().pushHistory()
    set((state) => {
      const child = state.nodes[childId]
      if (!child?.parentId) return state
      const parentId = child.parentId
      const siblings = childrenOf(state.nodes, parentId)
      const reordered = applyReorder(siblings, childId, newIndex)
      const nodes = { ...state.nodes }
      for (const n of reordered) nodes[n.id] = n
      return { nodes: syncContainerBranch(nodes, parentId) }
    })
  },

  setNodesFromDrop: (nodes) => set({ nodes }),

  setTitle: (id, title) => {
    get().pushHistory()
    set((state) => {
      const node = state.nodes[id]
      if (!node) return state
      return { nodes: { ...state.nodes, [id]: { ...node, title } } }
    })
  },

  moveNode: (id, position) => {
    get().pushHistory()
    set((state) => {
      const node = state.nodes[id]
      if (!node) return state
      return { nodes: { ...state.nodes, [id]: { ...node, ui_position: position } } }
    })
  },

  moveNodesBatch: (updates) => {
    if (!updates.length) return
    get().pushHistory()
    set((state) => {
      const nodes = { ...state.nodes }
      for (const { id, position } of updates) {
        if (nodes[id]) nodes[id] = { ...nodes[id], ui_position: position }
      }
      return { nodes }
    })
  },

  reparent: (id, newParentId, position, insertIndex) => {
    get().pushHistory()
    set((state) => {
      const node = state.nodes[id]
      if (!node) return state
      if (id === newParentId) return state
      if (newParentId && isAncestor(state.nodes, id, newParentId)) return state
      const oldParent = node.parentId
      const viewParent = state.path.length ? state.path[state.path.length - 1] : null
      const intoLayout = newParentId != null && newParentId !== viewParent
      const nodes = { ...state.nodes }
      nodes[id] = {
        ...node,
        parentId: newParentId,
        ui_position: intoLayout ? { x: 0, y: 0 } : (position ?? node.ui_position),
        ui_order: intoLayout
          ? insertIndex ?? nextChildOrder(childrenOf(nodes, newParentId).filter((c) => c.id !== id))
          : undefined,
      }
      if (intoLayout && insertIndex != null) {
        const reordered = applyReorder(childrenOf(nodes, newParentId), id, insertIndex)
        for (const n of reordered) nodes[n.id] = n
      }
      const syncFrom = intoLayout ? newParentId : oldParent
      return { nodes: syncContainerBranch(nodes, syncFrom) }
    })
  },

  deleteNode: (id) => {
    get().pushHistory()
    set((state) => {
      const node = state.nodes[id]
      const oldParent = node?.parentId ?? null
      const toRemove = new Set<NodeId>([id, ...descendantIds(state.nodes, id)])
      const nodes: NodeMap = {}
      for (const [key, n] of Object.entries(state.nodes)) {
        if (toRemove.has(key)) continue
        nodes[key] = { ...n, dependencies: n.dependencies.filter((d) => !toRemove.has(d)) }
      }
      const path = state.path.filter((p) => !toRemove.has(p))
      const selectedIds = state.selectedIds.filter((s) => !toRemove.has(s))
      return {
        nodes: oldParent ? syncContainerBranch(nodes, oldParent) : nodes,
        path,
        selectedId: state.selectedId && toRemove.has(state.selectedId) ? selectedIds[0] ?? null : state.selectedId,
        selectedIds,
      }
    })
  },

  deleteSelected: () => {
    const { selectedIds } = get()
    if (!selectedIds.length) return
    get().pushHistory()
    set((state) => {
      const parentsToSync = new Set<NodeId>()
      const toRemove = new Set<NodeId>()
      for (const id of selectedIds) {
        const n = state.nodes[id]
        if (n?.parentId) parentsToSync.add(n.parentId)
        toRemove.add(id)
        for (const d of descendantIds(state.nodes, id)) toRemove.add(d)
      }
      const nodes: NodeMap = {}
      for (const [key, n] of Object.entries(state.nodes)) {
        if (toRemove.has(key)) continue
        nodes[key] = { ...n, dependencies: n.dependencies.filter((d) => !toRemove.has(d)) }
      }
      const path = state.path.filter((p) => !toRemove.has(p))
      let synced = nodes
      for (const pid of parentsToSync) synced = syncContainerBranch(synced, pid)
      return { nodes: synced, path, selectedId: null, selectedIds: [] }
    })
  },

  select: (id) => set({ selectedId: id, selectedIds: id ? [id] : [] }),

  selectMany: (ids) => set({ selectedIds: ids, selectedId: ids[0] ?? null }),

  toggleSelect: (id) =>
    set((state) => {
      const has = state.selectedIds.includes(id)
      const selectedIds = has ? state.selectedIds.filter((x) => x !== id) : [...state.selectedIds, id]
      return { selectedIds, selectedId: selectedIds[0] ?? null }
    }),

  cycleRectKind: (id) => {
    get().pushHistory()
    set((state) => {
      const node = state.nodes[id]
      if (!node || node.type !== "RECTANGLE") return state
      const cur = node.rectKind ?? "DEFAULT"
      const idx = RECT_KINDS.indexOf(cur)
      const next = RECT_KINDS[(idx + 1) % RECT_KINDS.length]
      return { nodes: { ...state.nodes, [id]: { ...node, rectKind: next } } }
    })
  },

  duplicateSelected: () => {
    const { selectedId, nodes } = get()
    if (!selectedId || !nodes[selectedId]) return
    const src = nodes[selectedId]
    get().pushHistory()
    set((state) => {
      const id = makeId(src.type)
      const clone: SysNode = {
        ...JSON.parse(JSON.stringify(src)),
        id,
        title: `${src.title} (copy)`,
        dependencies: [...src.dependencies],
        ui_position: { x: src.ui_position.x + 24, y: src.ui_position.y + 24 },
      }
      return {
        nodes: { ...state.nodes, [id]: clone },
        selectedId: id,
        selectedIds: [id],
      }
    })
  },

  copySelected: () => {
    const { selectedId, nodes } = get()
    if (!selectedId || !nodes[selectedId]) return
    set({ clipboard: JSON.parse(JSON.stringify(nodes[selectedId])) })
  },

  pasteClipboard: (position) => {
    const { clipboard, pushHistory } = get()
    if (!clipboard) return
    pushHistory()
    set((state) => {
      const pid = state.path.length ? state.path[state.path.length - 1] : null
      const id = makeId(clipboard.type)
      const node: SysNode = {
        ...JSON.parse(JSON.stringify(clipboard)),
        id,
        parentId: pid,
        title: `${clipboard.title} (paste)`,
        dependencies: [...clipboard.dependencies],
        ui_position: position ?? {
          x: clipboard.ui_position.x + 32,
          y: clipboard.ui_position.y + 32,
        },
      }
      return { nodes: { ...state.nodes, [id]: node }, selectedId: id, selectedIds: [id] }
    })
  },

  enterSquare: (squareId) =>
    set((state) => {
      if (state.nodes[squareId]?.type !== "SQUARE") return state
      return { path: [...state.path, squareId], selectedId: null, selectedIds: [] }
    }),

  navigateTo: (index) =>
    set((state) => ({ path: index < 0 ? [] : state.path.slice(0, index + 1), selectedId: null, selectedIds: [] })),

  setViewMode: (mode) => set({ viewMode: mode }),

  toggleCollapse: (id) =>
    set((state) => {
      const collapsed = new Set(state.collapsed)
      if (collapsed.has(id)) collapsed.delete(id)
      else collapsed.add(id)
      return { collapsed }
    }),

  toggleDependency: (sourceId, targetId) => {
    get().pushHistory()
    set((state) => {
      const source = state.nodes[sourceId]
      if (!source || sourceId === targetId) return state
      if (source.type === "SPACE" || state.nodes[targetId]?.type === "SPACE") return state
      const has = source.dependencies.includes(targetId)
      const dependencies = has
        ? source.dependencies.filter((d) => d !== targetId)
        : [...source.dependencies, targetId]
      return { nodes: { ...state.nodes, [sourceId]: { ...source, dependencies } } }
    })
  },

  setDsmSearch: (q) => set({ dsmSearch: q }),

  loadProject: (file) =>
    set({
      nodes: syncAllContainerLayouts(normalizeLayoutOrders(file.nodes)),
      projectName: file.name || "Imported System",
      path: [],
      selectedId: null,
      selectedIds: [],
      collapsed: new Set<NodeId>(),
      dsmSearch: "",
      history: [],
    }),

  reset: () =>
    set({
      nodes: syncAllContainerLayouts(normalizeLayoutOrders(MOCK_NODES)),
      projectName: "Untitled System",
      path: [],
      selectedId: null,
      selectedIds: [],
      collapsed: new Set<NodeId>(),
      dsmSearch: "",
      history: [],
    }),
}))
