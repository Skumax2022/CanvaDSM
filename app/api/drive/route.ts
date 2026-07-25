import { NextResponse } from "next/server"
import { readMapFile, writeMapFile, isDriveServerConfigured } from "@/lib/storage/drive-server"

export async function GET() {
  if (!isDriveServerConfigured()) {
    return NextResponse.json({ error: "Drive server is not configured (missing key)" }, { status: 400 })
  }
  try {
    const data = await readMapFile()
    return NextResponse.json(data)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }
}

export async function PUT(request: Request) {
  if (!isDriveServerConfigured()) {
    return NextResponse.json({ error: "Drive server is not configured (missing key)" }, { status: 400 })
  }
  try {
    const content = await request.text()
    const result = await writeMapFile(content)
    return NextResponse.json(result)
  } catch (error: any) {
    // Вот здесь магия: вместо падения сервера (502), отдаем ошибку прямо в браузер (400)
    console.error("DRIVE API ERROR:", error.message)
    return NextResponse.json(
      { success: false, error: error.message }, 
      { status: 400 } 
    )
  }
}
