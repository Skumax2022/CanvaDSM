"use client"

import { useCallback, useEffect, useRef } from "react"
import { Download, RotateCcw, Upload } from "lucide-react"
import { useStore } from "@/lib/store"
import type { NodeMap, NodeStatus, NodeType, RectKind, SysNode } from "@/lib/types"
import type { ProjectFile } from "@/lib/types"
import type { ProjectData, ProjectEdge } from "@/lib/storage/types"
import { useDriveSync } from "@/lib/storage/use-drive-sync"
import { SyncStatusBadge } from "./sync-status-badge"

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
const NODE_STATUSES: NodeStatus[] = ["todo", "in-progress", "done"]

const finiteNum = (v: unknown, fallback: number): number => {
  const n = Number(v)
  return Number.isFinite(n) ? n : fallback
}
const positiveNum = (v: unknown, fallback: number): number => {
  const n = Number(v)
  return Number.isFinite(n) && n > 0 ? n : fallback
}

/**
 * Чинит импортированный JSON: нормализует типы/размеры/позиции,
 * убирает висячие ссылки на родителей и зависимости, разрывает циклы вложенности.
 */
export function sanitizeNodes(raw: unknown): NodeMap {
  if (!raw || typeof raw !== "object") throw new Error("Invalid project file: missing nodes map.")
  const src = raw as Record<string, any>
  const clean: NodeMap = {}

  for (const key of Object.keys(src)) {
    const n = src[key]
    if (!n || typeof n !== "object") continue
    const id = n.id != null ? String(n.id) : String(key)
    const type: NodeType =
      n.type === "SPACE" || n.type === "RECTANGLE" || n.type === "SQUARE" ? n.type : "RECTANGLE"
    const def = DEFAULT_SIZE[type]
    const pos = n.ui_position && typeof n.ui_position === "object" ? n.ui_position : {}
    const size = n.ui_size && typeof n.ui_size === "object" ? n.ui_size : {}
    const node: SysNode = {
      id,
      type,
      title: typeof n.title === "string" && n.title.trim() ? n.title : DEFAULT_TITLE[type],
      parentId: n.parentId != null ? String(n.parentId) : null,
      dependencies: Array.isArray(n.dependencies) ? n.dependencies.map(String) : [],
      ui_position: { x: finiteNum(pos.x, 0), y: finiteNum(pos.y, 0) },
      ui_size: { width: positiveNum(size.width, def.width), height: positiveNum(size.height, def.height) },
    }
    if (type === "RECTANGLE") node.rectKind = RECT_KINDS.includes(n.rectKind) ? n.rectKind : "DEFAULT"
    if (NODE_STATUSES.includes(n.status)) node.status = n.status
    if (Number.isFinite(Number(n.ui_order))) node.ui_order = Number(n.ui_order)
    clean[id] = node
  }

  if (!Object.keys(clean).length) throw new Error("Invalid project file: no valid nodes.")

  // Висячие ссылки на родителей и зависимости
  for (const id of Object.keys(clean)) {
    const n = clean[id]
    if (n.parentId != null && !clean[n.parentId]) n.parentId = null
    n.dependencies = n.dependencies.filter((d) => clean[d] && d !== id)
  }

  // Разрыв циклов вложенности
  for (const id of Object.keys(clean)) {
    const seen = new Set<string>()
    let cur: string | null = id
    while (cur != null && clean[cur]) {
      if (seen.has(cur)) break
      seen.add(cur)
      const p: string | null = clean[cur].parentId
      if (p != null && seen.has(p)) {
        clean[cur].parentId = null
        break
      }
      cur = p
    }
  }

  return clean
}

export function parseProjectFile(text: string): ProjectFile {
  const data = JSON.parse(text)
  const nodesRaw = data && typeof data === "object" ? data.nodes ?? data : null
  return {
    version: 1,
    name: data && typeof data.name === "string" ? data.name : "Imported System",
    nodes: sanitizeNodes(nodesRaw),
  }
}

/** Serializes the current store into the provider-agnostic ProjectData shape. */
export function toProjectData(nodes: NodeMap, name: string): ProjectData {
  const edges: ProjectEdge[] = []
  for (const node of Object.values(nodes)) {
    for (const dep of node.dependencies) edges.push({ from: node.id, to: dep })
  }
  return {
    version: 1,
    nodes: nodes as unknown as Record<string, unknown>,
    edges,
    meta: { name, modifiedTime: new Date().toISOString() },
  }
}

/** Converts a loaded ProjectData back into a sanitized ProjectFile. */
export function fromProjectData(data: ProjectData): ProjectFile {
  const nodesRaw = data && typeof data === "object" ? (data.nodes ?? data) : null
  const name = typeof data?.meta?.name === "string" && data.meta.name.trim() ? data.meta.name : "Drive Project"
  return { version: 1, name, nodes: sanitizeNodes(nodesRaw) }
}

const btnBase =
  "flex items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:pointer-events-none disabled:opacity-50"

export function FileIO() {
  const inputRef = useRef<HTMLInputElement>(null)
  const nodes = useStore((s) => s.nodes)
  const projectName = useStore((s) => s.projectName)
  const loadProject = useStore((s) => s.loadProject)
  const reset = useStore((s) => s.reset)

  const downloadLocal = useCallback(() => {
    const file: ProjectFile = { version: 1, name: projectName, nodes }
    const blob = new Blob([JSON.stringify(file, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${projectName.replace(/\s+/g, "-").toLowerCase()}.canvas.json`
    a.click()
    URL.revokeObjectURL(url)
  }, [nodes, projectName])

  const { configured, loaded, status, lastSaved, error, save, saveNow } = useDriveSync({
    onLoad: (data) => loadProject(fromProjectData(data)),
  })

  // Debounced auto-save: once the initial Drive load has completed, persist every edit.
  const skipFirstRef = useRef(true)
  useEffect(() => {
    if (configured !== true || !loaded) return
    if (skipFirstRef.current) {
      // Skip the render right after load so we don't immediately re-save what we just read.
      skipFirstRef.current = false
      return
    }
    save(toProjectData(nodes, projectName))
  }, [nodes, projectName, configured, loaded, save])

  const handleImport = async (file: File) => {
    try {
      const text = await file.text()
      loadProject(parseProjectFile(text))
    } catch (err) {
      // eslint-disable-next-line no-alert
      alert(`Could not import file: ${(err as Error).message}`)
    }
  }

  const handleRetry = () => void saveNow(toProjectData(nodes, projectName))

  return (
    <div className="flex items-center gap-1">
      {configured && (
        <>
          <SyncStatusBadge
            status={status}
            lastSaved={lastSaved}
            error={error}
            onRetry={status === "error" || status === "offline" ? handleRetry : undefined}
            onDownloadLocal={status === "error" || status === "offline" ? downloadLocal : undefined}
          />
          <span className="mx-1 h-5 w-px bg-border" aria-hidden />
        </>
      )}

      <button type="button" onClick={() => inputRef.current?.click()} title="Import project (.json)" className={btnBase}>
        <Upload className="size-4" aria-hidden />
        <span className="hidden lg:inline">Import</span>
      </button>
      <button
        type="button"
        onClick={downloadLocal}
        title="Export project (.json)"
        className="flex items-center gap-1.5 rounded-md bg-primary px-2.5 py-1.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
      >
        <Download className="size-4" aria-hidden />
        <span className="hidden lg:inline">Export</span>
      </button>
      <button
        type="button"
        onClick={() => {
          if (confirm("Reset to the sample project? Unsaved changes will be lost.")) reset()
        }}
        title="Reset to sample project"
        className="flex items-center rounded-md border border-border bg-card p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
      >
        <RotateCcw className="size-4" aria-hidden />
        <span className="sr-only">Reset project</span>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept=".json,application/json"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) handleImport(file)
          e.target.value = ""
        }}
      />
    </div>
  )
}
