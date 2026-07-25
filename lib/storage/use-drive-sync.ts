"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useSearchParams } from "next/navigation"
import { driveProvider } from "./drive-adapter"
import { StorageError, type ProjectData, type StorageStatus } from "./types"

const SAVE_DEBOUNCE_MS = 2500

/** True when a Google OAuth client id is present at build time. */
export const isDriveConfigured = Boolean(process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID)

export interface UseDriveSyncOptions {
  /** Applies a project loaded from Drive to the caller's state. */
  onLoad?: (data: ProjectData) => void
}

export interface UseDriveSync {
  status: StorageStatus
  lastSaved: Date | null
  fileId: string | null
  error: string | null
  connected: boolean
  /** Triggers the OAuth flow. */
  connect: () => Promise<void>
  /** Debounced save — waits 2.5s after the last call before writing. */
  save: (data: ProjectData) => void
  /** Immediate save/create, bypassing the debounce. */
  saveNow: (data: ProjectData) => Promise<void>
  /** Loads a project by Drive file id (or shareable URL). */
  loadFromDrive: (idOrUrl: string) => Promise<void>
}

/** Extracts a Drive file id from a raw id or a typical Drive share URL. */
export function extractFileId(input: string): string {
  const trimmed = input.trim()
  const match = trimmed.match(/[-\w]{25,}/)
  return match ? match[0] : trimmed
}

export function useDriveSync(initialFileId?: string, options: UseDriveSyncOptions = {}): UseDriveSync {
  const { onLoad } = options
  const searchParams = useSearchParams()

  const [status, setStatus] = useState<StorageStatus>("idle")
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const [fileId, setFileId] = useState<string | null>(initialFileId ?? null)
  const [error, setError] = useState<string | null>(null)
  const [connected, setConnected] = useState(false)

  // Keep the latest onLoad without retriggering effects.
  const onLoadRef = useRef(onLoad)
  useEffect(() => {
    onLoadRef.current = onLoad
  }, [onLoad])

  const fileIdRef = useRef<string | null>(fileId)
  useEffect(() => {
    fileIdRef.current = fileId
  }, [fileId])

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingRef = useRef<ProjectData | null>(null)

  const reportError = useCallback((err: unknown) => {
    const message = err instanceof Error ? err.message : "Unexpected storage error."
    const offline = err instanceof StorageError && (err.code === "network" || err.code === "not-configured")
    setError(message)
    setStatus(offline ? "offline" : "error")
  }, [])

  const runSave = useCallback(
    async (data: ProjectData) => {
      setStatus("saving")
      setError(null)
      try {
        const currentId = fileIdRef.current
        if (currentId) {
          const result = await driveProvider.saveFile(currentId, data)
          setFileId(result.fileId)
          setLastSaved(new Date(result.modifiedTime))
        } else {
          const title = (data.meta?.name as string | undefined) ?? "CanvaDSM Project"
          const { fileId: newId } = await driveProvider.createFile(title, data)
          setFileId(newId)
          setLastSaved(new Date())
        }
        setConnected(true)
        setStatus("saved")
      } catch (err) {
        reportError(err)
      }
    },
    [reportError],
  )

  const save = useCallback(
    (data: ProjectData) => {
      pendingRef.current = data
      setStatus("saving")
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => {
        const payload = pendingRef.current
        pendingRef.current = null
        if (payload) void runSave(payload)
      }, SAVE_DEBOUNCE_MS)
    },
    [runSave],
  )

  const saveNow = useCallback(
    async (data: ProjectData) => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
        debounceRef.current = null
      }
      pendingRef.current = null
      await runSave(data)
    },
    [runSave],
  )

  const connect = useCallback(async () => {
    setError(null)
    try {
      await driveProvider.authenticate()
      setConnected(true)
      setStatus((s) => (s === "offline" || s === "error" ? "idle" : s))
    } catch (err) {
      reportError(err)
      throw err
    }
  }, [reportError])

  const loadFromDrive = useCallback(
    async (idOrUrl: string) => {
      const id = extractFileId(idOrUrl)
      if (!id) return
      setStatus("saving")
      setError(null)
      try {
        const data = await driveProvider.loadFile(id)
        setFileId(id)
        setConnected(true)
        onLoadRef.current?.(data)
        setLastSaved(new Date(typeof data.meta?.modifiedTime === "string" ? data.meta.modifiedTime : Date.now()))
        setStatus("saved")
      } catch (err) {
        reportError(err)
        throw err
      }
    },
    [reportError],
  )

  // Auto-load a project referenced via ?fileId= on mount.
  const autoLoadedRef = useRef(false)
  useEffect(() => {
    if (autoLoadedRef.current) return
    const urlFileId = searchParams?.get("fileId") ?? initialFileId
    if (urlFileId) {
      autoLoadedRef.current = true
      void loadFromDrive(urlFileId)
    }
  }, [searchParams, initialFileId, loadFromDrive])

  // Flush any pending debounced save on unmount.
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  return { status, lastSaved, fileId, error, connected, connect, save, saveNow, loadFromDrive }
}
