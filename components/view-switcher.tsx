"use client"

import { Columns2, LayoutGrid, Table2 } from "lucide-react"
import { useStore } from "@/lib/store"
import type { ViewMode } from "@/lib/types"

const OPTIONS: { mode: ViewMode; label: string; icon: typeof LayoutGrid }[] = [
  { mode: "canvas", label: "Canvas", icon: LayoutGrid },
  { mode: "split", label: "Split", icon: Columns2 },
  { mode: "dsm", label: "Matrix", icon: Table2 },
]

export function ViewSwitcher() {
  const viewMode = useStore((s) => s.viewMode)
  const setViewMode = useStore((s) => s.setViewMode)

  return (
    <div role="tablist" aria-label="View mode" className="flex items-center gap-1 rounded-lg border border-border bg-card p-1">
      {OPTIONS.map(({ mode, label, icon: Icon }) => {
        const active = viewMode === mode
        return (
          <button
            key={mode}
            role="tab"
            aria-selected={active}
            type="button"
            onClick={() => setViewMode(mode)}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium tracking-wide transition-colors ${
              active
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground"
            }`}
          >
            <Icon className="size-4" aria-hidden />
            <span className="hidden sm:inline">{label}</span>
          </button>
        )
      })}
    </div>
  )
}
