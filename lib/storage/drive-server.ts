import "server-only"
import { JWT } from "google-auth-library"

/**
 * Server-only Google Drive access via a service account.
 *
 * The app is bound to a single Drive folder and a single file named `map.json`
 * inside it. The service account credentials never reach the browser — all
 * reads/writes go through the API routes that call these helpers.
 */

const DRIVE_API = "https://www.googleapis.com/drive/v3"
const DRIVE_UPLOAD_API = "https://www.googleapis.com/upload/drive/v3"
const MAP_FILE_NAME = "map.json"

/** Folder from the shared link, overridable via env. */
export const DRIVE_FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID || "16JymuUyCLZYj3PsKeCrE2JdH1RvDdbQ3"

export class DriveConfigError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "DriveConfigError"
  }
}

/** Parses the service account JSON key from env (raw JSON or base64-encoded). */
function readServiceAccount(): { client_email: string; private_key: string } {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_KEY
  if (!raw || !raw.trim()) {
    throw new DriveConfigError(
      "GOOGLE_SERVICE_ACCOUNT_KEY is not set. Add the service account JSON key to enable Drive sync.",
    )
  }
  let text = raw.trim()
  // Support base64-encoded keys (handy when a JSON blob is awkward in env UIs).
  if (!text.startsWith("{")) {
    try {
      text = Buffer.from(text, "base64").toString("utf8")
    } catch {
      /* fall through to JSON.parse error below */
    }
  }
  let parsed: { client_email?: string; private_key?: string }
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new DriveConfigError("GOOGLE_SERVICE_ACCOUNT_KEY is not valid JSON.")
  }
  if (!parsed.client_email || !parsed.private_key) {
    throw new DriveConfigError("Service account key is missing client_email or private_key.")
  }
  // Normalize escaped newlines that env stores often introduce.
  return { client_email: parsed.client_email, private_key: parsed.private_key.replace(/\\n/g, "\n") }
}

let cachedClient: JWT | null = null

async function getAccessToken(): Promise<string> {
  if (!cachedClient) {
    const { client_email, private_key } = readServiceAccount()
    cachedClient = new JWT({
      email: client_email,
      key: private_key,
      scopes: ["https://www.googleapis.com/auth/drive"],
    })
  }
  const { token } = await cachedClient.getAccessToken()
  if (!token) throw new DriveConfigError("Failed to obtain a Google access token for the service account.")
  return token
}

/** Whether the service account credentials are present (no network call). */
export function isDriveServerConfigured(): boolean {
  return Boolean(process.env.GOOGLE_SERVICE_ACCOUNT_KEY?.trim())
}

async function driveFetch(url: string, token: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(url, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, ...(init?.headers ?? {}) },
    cache: "no-store",
  })
  return res
}

async function toError(res: Response, action: string): Promise<Error> {
  let detail = ""
  try {
    const body = await res.json()
    detail = body?.error?.message || JSON.stringify(body?.error ?? body)
  } catch {
    detail = await res.text().catch(() => "")
  }
  return new Error(`Drive ${action} failed (${res.status}): ${detail || res.statusText}`)
}

/** Finds the id of `map.json` in the bound folder, or null if it doesn't exist yet. */
async function findMapFileId(token: string): Promise<string | null> {
  const q = encodeURIComponent(`name='${MAP_FILE_NAME}' and '${DRIVE_FOLDER_ID}' in parents and trashed=false`)
  const url = `${DRIVE_API}/files?q=${q}&fields=files(id,modifiedTime)&pageSize=1&supportsAllDrives=true&includeItemsFromAllDrives=true`
  const res = await driveFetch(url, token)
  if (!res.ok) throw await toError(res, "lookup")
  const data = (await res.json()) as { files?: Array<{ id: string }> }
  return data.files?.[0]?.id ?? null
}

export interface DriveReadResult {
  content: string | null
  fileId: string | null
  modifiedTime: string | null
}

/** Reads `map.json` from the folder. Returns null content when it doesn't exist. */
export async function readMapFile(): Promise<DriveReadResult> {
  const token = await getAccessToken()
  const fileId = await findMapFileId(token)
  if (!fileId) return { content: null, fileId: null, modifiedTime: null }

  const metaRes = await driveFetch(`${DRIVE_API}/files/${fileId}?fields=modifiedTime&supportsAllDrives=true`, token)
  const modifiedTime = metaRes.ok ? ((await metaRes.json())?.modifiedTime ?? null) : null

  const res = await driveFetch(`${DRIVE_API}/files/${fileId}?alt=media&supportsAllDrives=true`, token)
  if (!res.ok) throw await toError(res, "download")
  const content = await res.text()
  return { content, fileId, modifiedTime }
}

/** Writes `map.json` to the folder, creating it on first save. */
export async function writeMapFile(content: string): Promise<{ fileId: string; modifiedTime: string }> {
  const token = await getAccessToken()
  const existingId = await findMapFileId(token)
  const boundary = "-------canvadsm" + Math.random().toString(36).slice(2)

  const metadata: Record<string, unknown> = existingId
    ? {}
    : { name: MAP_FILE_NAME, parents: [DRIVE_FOLDER_ID], mimeType: "application/json" }

  const body =
    `--${boundary}\r\n` +
    "Content-Type: application/json; charset=UTF-8\r\n\r\n" +
    `${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\n` +
    "Content-Type: application/json\r\n\r\n" +
    `${content}\r\n` +
    `--${boundary}--`

  const url = existingId
    ? `${DRIVE_UPLOAD_API}/files/${existingId}?uploadType=multipart&fields=id,modifiedTime&supportsAllDrives=true`
    : `${DRIVE_UPLOAD_API}/files?uploadType=multipart&fields=id,modifiedTime&supportsAllDrives=true`

  const res = await driveFetch(url, token, {
    method: existingId ? "PATCH" : "POST",
    headers: { "Content-Type": `multipart/related; boundary=${boundary}` },
    body,
  })
  if (!res.ok) throw await toError(res, "upload")
  const data = (await res.json()) as { id: string; modifiedTime?: string }
  return { fileId: data.id, modifiedTime: data.modifiedTime ?? new Date().toISOString() }
}
