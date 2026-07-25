/**
 * Storage abstraction layer.
 * Provider-agnostic contracts for persisting project JSON to a remote store.
 */

/** Directed dependency edge, kept generic so any provider can round-trip it. */
export interface ProjectEdge {
  from: string
  to: string
}

/** Extra metadata carried alongside the graph (project name, timestamps, etc.). */
export interface ProjectMeta {
  name?: string
  modifiedTime?: string
  [key: string]: unknown
}

/**
 * Generic JSON structure persisted to a storage provider.
 * `nodes` is intentionally opaque (`unknown` values) so the storage layer never
 * couples to a specific domain model — callers own (de)serialization.
 */
export interface ProjectData {
  version: number
  nodes: Record<string, unknown>
  edges?: ProjectEdge[]
  meta?: ProjectMeta
}

/** High-level sync state surfaced to the UI. */
export type StorageStatus = "idle" | "saving" | "saved" | "error" | "offline"

/** Result returned after a successful write. */
export interface SaveResult {
  fileId: string
  modifiedTime: string
}
