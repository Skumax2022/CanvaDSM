import { NextResponse } from "next/server"
import { DriveConfigError, isDriveServerConfigured, readMapFile, writeMapFile } from "@/lib/storage/drive-server"

// Service-account access must run on the server (Node runtime for JWT signing).
export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function errorResponse(err: unknown) {
  const status = err instanceof DriveConfigError ? 503 : 502
  const message = err instanceof Error ? err.message : "Unknown Drive error."
  return NextResponse.json({ error: message }, { status })
}

/** GET — loads map.json from the bound Drive folder. */
export async function GET() {
  if (!isDriveServerConfigured()) {
    return NextResponse.json({ error: "not-configured" }, { status: 503 })
  }
  try {
    const { content, fileId, modifiedTime } = await readMapFile()
    if (!content) return NextResponse.json({ empty: true, fileId: null, modifiedTime: null })
    let data: unknown
    try {
      data = JSON.parse(content)
    } catch {
      return NextResponse.json({ error: "map.json in the Drive folder is not valid JSON." }, { status: 422 })
    }
    return NextResponse.json({ empty: false, data, fileId, modifiedTime })
  } catch (err) {
    return errorResponse(err)
  }
}

/** PUT — writes the current project to map.json (creating it if missing). */
export async function PUT(request: Request) {
  if (!isDriveServerConfigured()) {
    return NextResponse.json({ error: "not-configured" }, { status: 503 })
  }
  try {
    const body = await request.json()
    const content = JSON.stringify(body, null, 2)
    const { fileId, modifiedTime } = await writeMapFile(content)
    return NextResponse.json({ ok: true, fileId, modifiedTime })
  } catch (err) {
    return errorResponse(err)
  }
}
