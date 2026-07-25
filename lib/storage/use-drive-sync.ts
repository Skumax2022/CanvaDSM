"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import type { ProjectData, StorageStatus } from "./types"

const SAVE_DEBOUNCE_MS = 2000
const API_URL = "/api/drive"

export interface UseDriveSyncOptions {
  /** Applies the project loaded from Drive to the caller's state. */
  onLoad?: (data: ProjectData) => void
}

export interface UseDriveSync {
  /** null while we haven't yet learned whether the server has Drive credentials. */
  configured: boolean | null
  /** True once the initial load attempt has completed (success or empty). */
  loaded: boolean
  status: StorageStatus
  lastSaved: Date | null
  error: string | null
  /** Debounced save — waits ~2s after the last call before writing. */
  save: (data: ProjectData) => void
  /** Immediate save, bypassing the debounce. */
  saveNow: (data: ProjectData) => Promise<void>
  /** Re-reads map.json from Drive. */
  reload: () => Promise<void>
}

/**
 * Syncs the project with a single `map.json` file in a fixed Google Drive folder
 * via server API routes backed by a service account. Loads once on mount and
 * auto-saves (debounced) on every change.
 */
export function useDriveSync(options: UseDriveSyncOptions = {}): UseDriveSync {
  const { onLoad } = options

  const [configured, setConfigured] = useState<boolean | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [status, setStatus] = useState<StorageStatus>("idle")
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const [error, setError] = useState<string | null>(null)

  const onLoadRef = useRef(onLoad)
  useEffect(() => {
    onLoadRef.current = onLoad
  }, [onLoad])

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingRef = useRef<ProjectData | null>(null)

  const runSave = useCallback(async (data: ProjectData) => {
    setStatus("saving")
    setError(null)
    try {
      const res = await fetch(API_URL, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        if (res.status === 503) {
          setConfigured(false)
          setStatus("offline")
          setError("Google Drive is not configured on the server.")
          return
        }
        throw new Error(body?.error || `Save failed (${res.status}).`)
      }
      setConfigured(true)
      setLastSaved(new Date(body?.modifiedTime ?? Date.now()))
      setStatus("saved")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.")
      setStatus("error")
    }
  }, [])

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

  const load = useCallback(async () => {
    try {
      const res = await fetch(API_URL, { method: "GET", cache: "no-store" })
      if (res.status === 503) {
        setConfigured(false)
        setLoaded(true)
        return
      }
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        setConfigured(true)
        setError(body?.error || `Load failed (${res.status}).`)
        setStatus("error")
        setLoaded(true)
        return
      }
      setConfigured(true)

      // FIXED: Properly parsing the stringified content returned from our backend route
      if (body?.content) {
        try {
          const parsedData = JSON.parse(body.content)
          // Ensure it's not the empty "{}" we manually created
          if (Object.keys(parsedData).length > 0) {
            onLoadRef.current?.(parsedData as ProjectData)
          }
        } catch (parseErr) {
          console.error("Failed to parse drive content:", parseErr)
        }
        setLastSaved(new Date(body?.modifiedTime ?? Date.now()))
        setStatus("saved")
      } else {
        // Folder has no map.json yet — first save will create it.
        setStatus("idle")
      }
      setLoaded(true)
    } catch (err) {
      setConfigured(true)
      setError(err instanceof Error ? err.message : "Load failed.")
      setStatus("error")
      setLoaded(true)
    }
  }, [])

  const reload = useCallback(async () => {
    setLoaded(false)
    await load()
  }, [load])

  // Load once on mount.
  const startedRef = useRef(false)
  useEffect(() => {
    if (startedRef.current) return
    startedRef.current = true
    void load()
  }, [load])

  // Flush pending debounced save on unmount.
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  return { configured, loaded, status, lastSaved, error, save, saveNow, reload }
}
