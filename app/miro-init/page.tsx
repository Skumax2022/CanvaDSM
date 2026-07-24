"use client"

import Script from "next/script"
import { useCallback, useEffect, useState } from "react"

/**
 * Miro app "SDK URI" page.
 *
 * Miro loads this URL invisibly inside the board when the app is installed.
 * It boots the Miro Web SDK v2 and registers the toolbar `icon:click` handler,
 * which opens the full Canvas + DSM tool inside a fullscreen Miro modal.
 *
 * Configure this route (e.g. https://your-app.vercel.app/miro-init) as the
 * "App URL / SDK URI" in your Miro app settings at https://miro.com/app-settings/.
 */

type MiroBoardUi = {
  on: (event: string, handler: () => void | Promise<void>) => void
  openModal: (opts: { url: string; fullscreen?: boolean }) => Promise<void>
}
type Miro = { board: { ui: MiroBoardUi } }

declare global {
  interface Window {
    miro?: Miro
  }
}

const APP_URL = "/"

export default function MiroInitPage() {
  const [status, setStatus] = useState<"loading" | "ready" | "standalone">("loading")

  const initMiro = useCallback(() => {
    const miro = window.miro
    if (!miro?.board?.ui) {
      // Opened directly in a normal browser tab, not inside a Miro board.
      setStatus("standalone")
      return
    }

    miro.board.ui.on("icon:click", async () => {
      await miro.board.ui.openModal({ url: APP_URL, fullscreen: true })
    })

    setStatus("ready")
  }, [])

  // If the SDK was already present (fast reloads / cached), init immediately.
  useEffect(() => {
    if (window.miro) initMiro()
  }, [initMiro])

  return (
    <>
      <Script
        src="https://miro.com/app/static/sdk/v2/miro.js"
        strategy="afterInteractive"
        onLoad={initMiro}
      />
      <main className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-background px-6 text-center text-foreground">
        <div className="flex flex-col items-center gap-2">
          <h1 className="text-balance text-lg font-semibold">Canvas + DSM for Miro</h1>
          {status === "loading" && (
            <p className="text-sm text-muted-foreground">Connecting to Miro…</p>
          )}
          {status === "ready" && (
            <p className="max-w-sm text-pretty text-sm text-muted-foreground">
              Ready. Click the app icon in the Miro toolbar to launch the designer in fullscreen.
            </p>
          )}
          {status === "standalone" && (
            <p className="max-w-sm text-pretty text-sm text-muted-foreground">
              This page initializes the Miro app. Open it from inside a Miro board, or{" "}
              <a href={APP_URL} className="text-primary underline underline-offset-2">
                open the app directly
              </a>
              .
            </p>
          )}
        </div>
      </main>
    </>
  )
}
