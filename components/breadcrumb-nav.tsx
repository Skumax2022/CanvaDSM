"use client"

import { ChevronRight, Home } from "lucide-react"
import { useStore } from "@/lib/store"

export function BreadcrumbNav() {
  const path = useStore((s) => s.path)
  const nodes = useStore((s) => s.nodes)
  const projectName = useStore((s) => s.projectName)
  const navigateTo = useStore((s) => s.navigateTo)

  return (
    <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1 text-sm">
      <button
        type="button"
        onClick={() => navigateTo(-1)}
        className="flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1 font-medium text-foreground transition-colors hover:bg-secondary"
      >
        <Home className="size-3.5 text-foreground/70" aria-hidden />
        <span className="max-w-40 truncate">{projectName}</span>
      </button>
      {path.map((id, i) => {
        const node = nodes[id]
        const isLast = i === path.length - 1
        return (
          <span key={id} className="flex min-w-0 items-center gap-1">
            <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
            <button
              type="button"
              onClick={() => navigateTo(i)}
              aria-current={isLast ? "page" : undefined}
              className={`max-w-40 truncate rounded-md px-2 py-1 transition-colors hover:bg-secondary ${
                isLast ? "font-medium text-foreground" : "text-muted-foreground"
              }`}
            >
              {node?.title ?? "Unknown"}
            </button>
          </span>
        )
      })}
    </nav>
  )
}
