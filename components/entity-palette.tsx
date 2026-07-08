"use client"

import { Box, Square, SquareDashed } from "lucide-react"
import { useStore } from "@/lib/store"
import type { NodeType } from "@/lib/types"

const ITEMS: { type: NodeType; label: string; icon: typeof Box; hint: string }[] = [
  { type: "SPACE", label: "Space", icon: SquareDashed, hint: "Grouping container" },
  { type: "RECTANGLE", label: "Rectangle", icon: Box, hint: "Nesting container" },
  { type: "SQUARE", label: "Square", icon: Square, hint: "Portal node" },
]

export function EntityPalette() {
  const addNode = useStore((s) => s.addNode)

  let stagger = 0
  const spawn = (type: NodeType) => {
    stagger += 1
    const jitter = (Math.random() * 120 - 60) | 0
    addNode(type, { x: 160 + jitter, y: 140 + jitter })
  }

  return (
    <div className="flex items-center gap-1 rounded-lg border border-border bg-card p-1">
      {ITEMS.map(({ type, label, icon: Icon, hint }) => (
        <button
          key={type}
          type="button"
          title={`Add ${label} — ${hint}`}
          onClick={() => spawn(type)}
          className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          <Icon className="size-4" aria-hidden />
          <span className="hidden md:inline">{label}</span>
        </button>
      ))}
    </div>
  )
}
