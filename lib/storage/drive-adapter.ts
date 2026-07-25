"use client"

import {
  StorageError,
  type ProjectData,
  type SaveResult,
  type StorageProvider,
} from "./types"

/* -------------------------------------------------------------------------- */
/*  Google Identity Services (GIS) typings — minimal, no `any`.               */
/* -------------------------------------------------------------------------- */

interface GisTokenResponse {
  access_token?: string
  expires_in?: number
  error?: string
  error_description?: string
}

interface GisTokenClient {
  requestAccessToken: (overrides?: { prompt?: "" | "none" | "consent" | "select_account" }) => void
}

interface GisTokenClientConfig {
  client_id: string
  scope: string
  callback: (response: GisTokenResponse) => void
  error_callback?: (error: { type: string; message?: string }) => void
}

interface GoogleOAuth2 {
  initTokenClient: (config: GisTokenClientConfig) => GisTokenClient
}

interface GoogleNamespace {
  accounts: { oauth2: GoogleOAuth2 }
}

declare global {
  interface Window {
    google?: GoogleNamespace
  }
}

/* -------------------------------------------------------------------------- */
/*  Constants                                                                 */
/* -------------------------------------------------------------------------- */

const GIS_SCRIPT_SRC = "https://accounts.google.com/gsi/client"
const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file"
const FILE_MIME = "application/json"
const MULTIPART_BOUNDARY = "canvadsm-boundary-b2a1f8"

const DRIVE_DOWNLOAD = (fileId: string) =>
  `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`
const DRIVE_CREATE =
  "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,modifiedTime"
const DRIVE_UPDATE = (fileId: string) =>
  `https://www.googleapis.com/upload/drive/v3/files/${encodeURIComponent(fileId)}?uploadType=multipart&fields=id,modifiedTime`

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                   */
/* -------------------------------------------------------------------------- */

/** Injects the GIS client script once and resolves when `window.google` exists. */
let gisScriptPromise: Promise<void> | null = null
function loadGisScript(): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.reject(new StorageError("network", "Google Drive is only available in the browser."))
  }
  if (window.google?.accounts?.oauth2) return Promise.resolve()
  if (gisScriptPromise) return gisScriptPromise

  gisScriptPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${GIS_SCRIPT_SRC}"]`)
    const onReady = () => {
      if (window.google?.accounts?.oauth2) resolve()
      else reject(new StorageError("network", "Google Identity Services failed to initialize."))
    }
    if (existing) {
      existing.addEventListener("load", onReady, { once: true })
      existing.addEventListener(
        "error",
        () => reject(new StorageError("network", "Failed to load Google Identity Services.")),
        { once: true },
      )
      if (window.google?.accounts?.oauth2) resolve()
      return
    }
    const script = document.createElement("script")
    script.src = GIS_SCRIPT_SRC
    script.async = true
    script.defer = true
    script.addEventListener("load", onReady, { once: true })
    script.addEventListener(
      "error",
      () => reject(new StorageError("network", "Failed to load Google Identity Services.")),
      { once: true },
    )
    document.head.appendChild(script)
  })
  return gisScriptPromise
}

/** Builds a multipart/related body pairing JSON metadata with the file content. */
function buildMultipartBody(metadata: Record<string, unknown>, data: ProjectData): string {
  const delimiter = `--${MULTIPART_BOUNDARY}`
  const closing = `--${MULTIPART_BOUNDARY}--`
  return [
    delimiter,
    "Content-Type: application/json; charset=UTF-8",
    "",
    JSON.stringify(metadata),
    delimiter,
    `Content-Type: ${FILE_MIME}; charset=UTF-8`,
    "",
    JSON.stringify(data),
    closing,
    "",
  ].join("\r\n")
}

function getClientId(): string {
  const id = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID
  if (!id) {
    throw new StorageError(
      "not-configured",
      "Google Drive is not configured. Set NEXT_PUBLIC_GOOGLE_CLIENT_ID to enable cloud sync.",
    )
  }
  return id
}

/* -------------------------------------------------------------------------- */
/*  Provider                                                                  */
/* -------------------------------------------------------------------------- */

export class DriveStorageProvider implements StorageProvider {
  private tokenClient: GisTokenClient | null = null
  private accessToken: string | null = null
  private tokenExpiresAt = 0

  /** True when a non-expired token is already cached. */
  private hasValidToken(): boolean {
    return this.accessToken != null && Date.now() < this.tokenExpiresAt - 30_000
  }

  async authenticate(): Promise<string> {
    if (this.hasValidToken() && this.accessToken) return this.accessToken

    const clientId = getClientId()
    await loadGisScript()

    const oauth2 = window.google?.accounts?.oauth2
    if (!oauth2) throw new StorageError("auth-failed", "Google Identity Services unavailable.")

    return new Promise<string>((resolve, reject) => {
      this.tokenClient = oauth2.initTokenClient({
        client_id: clientId,
        scope: DRIVE_SCOPE,
        callback: (response) => {
          if (response.error || !response.access_token) {
            reject(
              new StorageError(
                "auth-failed",
                response.error_description || response.error || "Authorization failed.",
              ),
            )
            return
          }
          this.accessToken = response.access_token
          this.tokenExpiresAt = Date.now() + (response.expires_in ?? 3600) * 1000
          resolve(response.access_token)
        },
        error_callback: (error) => {
          const cancelled = error.type === "popup_closed" || error.type === "popup_failed_to_open"
          reject(
            new StorageError(
              cancelled ? "auth-cancelled" : "auth-failed",
              error.message || "Authorization was interrupted.",
            ),
          )
        },
      })
      this.tokenClient.requestAccessToken({ prompt: this.accessToken ? "" : "consent" })
    })
  }

  async loadFile(fileId: string): Promise<ProjectData> {
    const token = await this.authenticate()
    let res: Response
    try {
      res = await fetch(DRIVE_DOWNLOAD(fileId), {
        headers: { Authorization: `Bearer ${token}` },
      })
    } catch {
      throw new StorageError("network", "Network error while downloading from Google Drive.")
    }
    if (res.status === 404) throw new StorageError("not-found", `Drive file "${fileId}" was not found.`)
    if (!res.ok) throw new StorageError("unknown", `Drive download failed (${res.status}).`, res.status)

    const text = await res.text()
    try {
      return JSON.parse(text) as ProjectData
    } catch {
      throw new StorageError("parse", "Drive file did not contain valid project JSON.")
    }
  }

  async saveFile(fileId: string, data: ProjectData): Promise<SaveResult> {
    const token = await this.authenticate()
    const metadata = { name: fileNameFor(data), mimeType: FILE_MIME }
    let res: Response
    try {
      res = await fetch(DRIVE_UPDATE(fileId), {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": `multipart/related; boundary=${MULTIPART_BOUNDARY}`,
        },
        body: buildMultipartBody(metadata, data),
      })
    } catch {
      throw new StorageError("network", "Network error while saving to Google Drive.")
    }
    if (res.status === 404) throw new StorageError("not-found", `Drive file "${fileId}" was not found.`)
    if (!res.ok) throw new StorageError("unknown", `Drive save failed (${res.status}).`, res.status)

    const json = (await res.json()) as { id?: string; modifiedTime?: string }
    return {
      fileId: json.id ?? fileId,
      modifiedTime: json.modifiedTime ?? new Date().toISOString(),
    }
  }

  async createFile(title: string, data: ProjectData): Promise<{ fileId: string }> {
    const token = await this.authenticate()
    const name = title.endsWith(".json") ? title : `${title}.canvas.json`
    const metadata = { name, mimeType: FILE_MIME }
    let res: Response
    try {
      res = await fetch(DRIVE_CREATE, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": `multipart/related; boundary=${MULTIPART_BOUNDARY}`,
        },
        body: buildMultipartBody(metadata, data),
      })
    } catch {
      throw new StorageError("network", "Network error while creating the Google Drive file.")
    }
    if (!res.ok) throw new StorageError("unknown", `Drive create failed (${res.status}).`, res.status)

    const json = (await res.json()) as { id?: string }
    if (!json.id) throw new StorageError("unknown", "Drive did not return a file id.")
    return { fileId: json.id }
  }
}

function fileNameFor(data: ProjectData): string {
  const raw = typeof data.meta?.name === "string" && data.meta.name.trim() ? data.meta.name : "canvadsm-project"
  const base = raw.replace(/\s+/g, "-").toLowerCase()
  return base.endsWith(".json") ? base : `${base}.canvas.json`
}

/** Shared singleton so token state is reused across the app. */
export const driveProvider = new DriveStorageProvider()
