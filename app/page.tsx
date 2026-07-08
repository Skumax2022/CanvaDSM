"use client"

import { useStore } from "@/lib/store"
import { useHotkeys } from "@/lib/use-hotkeys"
import { Header } from "@/components/header"
import { CanvasWorkspace } from "@/components/canvas/canvas-workspace"
import { CanvasDock } from "@/components/canvas-dock"
import { DSMWorkspace } from "@/components/dsm/dsm-workspace"

export default function Page() {
  const viewMode = useStore((s) => s.viewMode)
  useHotkeys()

  return (
    <main className="flex h-dvh flex-col overflow-hidden bg-background text-foreground">
      <Header />

      <div className="relative flex min-h-0 flex-1">
        {viewMode === "canvas" && (
          <section className="min-h-0 flex-1" aria-label="Infinite canvas">
            <CanvasWorkspace />
          </section>
        )}

        {viewMode === "dsm" && (
          <>
            <section className="min-h-0 flex-1" aria-label="Dependency matrix">
              <DSMWorkspace />
            </section>
            <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30">
              <CanvasDock showCamera={false} />
            </div>
          </>
        )}

        {viewMode === "split" && (
          <>
            <section className="min-h-0 min-w-0 flex-1 border-r border-border" aria-label="Infinite canvas">
              <CanvasWorkspace />
            </section>
            <section className="min-h-0 w-[46%] min-w-0 max-w-[720px]" aria-label="Dependency matrix">
              <DSMWorkspace />
            </section>
          </>
        )}
      </div>
    </main>
  )
}
