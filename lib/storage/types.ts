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

/** Common contract every remote storage backend must satisfy. */
export interface StorageProvider {
  /** Runs the auth flow and resolves with a usable OAuth access token. */
  authenticate(): Promise<string>
  /** Downloads and parses a project file by its provider id. */
  loadFile(fileId: string): Promise<ProjectData>
  /** Overwrites an existing file's contents. */
  saveFile(fileId: string, data: ProjectData): Promise<SaveResult>
  /** Creates a new file and resolves with its provider id. */
  createFile(title: string, data: ProjectData): Promise<{ fileId: string }>
}

/** Typed error thrown by storage providers so callers can branch on `code`. */
export type StorageErrorCode =
  | "not-configured"
  | "auth-failed"
  | "auth-cancelled"
  | "network"
  | "not-found"
  | "parse"
  | "unknown"

export class StorageError extends Error {
  readonly code: StorageErrorCode
  readonly status?: number

  constructor(code: StorageErrorCode, message: string, status?: number) {
    super(message)
    this.name = "StorageError"
    this.code = code
    this.status = status
  }
}
