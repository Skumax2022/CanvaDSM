"use client"

import { useEffect, useRef, useState, type ReactNode } from "react"
import {
  Box,
  Copy,
  Download,
  LocateFixed,
  Minus,
  Plus,
  RotateCcw,
  Square,
  SquareDashed,
  Undo2,
  Upload,
} from "lucide-react"
import { getCanvasHandlers, subscribeCanvasZoom } from "@/lib/canvas-bridge"
import { useStore } from "@/lib/store"
import type { NodeType } from "@/lib/types"
import { parseProjectFile } from "./file-io"

const SPAWN_ITEMS: { type: NodeType; label: string; hotkey: string; icon: typeof Box }[] = [
  { type: "SPACE", label: "Space", hotkey: "E", icon: SquareDashed },
  { type: "RECTANGLE", label: "Rect", hotkey: "R", icon: Box },
  { type: "SQUARE", label: "Square", hotkey: "F", icon: Square },
]

function Kbd({ children }: { children: string }) {
  return (
    <kbd className="ml-1.5 hidden rounded border border-border/80 bg-background/60 px-1 py-px font-mono text-[9px] font-normal text-muted-foreground sm:inline">
      {children}
    </kbd>
  )
}

function DockDivider() {
  return <div className="mx-0.5 h-5 w-px shrink-0 bg-border" aria-hidden />
}

function DockButton({
  onClick,
  title,
  hotkey,
  children,
  active,
}: {
  onClick: () => void
  title: string
  hotkey?: string
  children: ReactNode
  active?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={hotkey ? `${title} (${hotkey})` : title}
      className={`flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-ring ${
        active
          ? "bg-foreground/10 text-foreground"
          : "text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground"
      }`}
    >
      {children}
      {hotkey && <Kbd>{hotkey}</Kbd>}
    </button>
  )
}

interface CanvasDockProps {
  /** Показывать кнопки камеры (центр, zoom) — только когда смонтирован canvas */
  showCamera?: boolean
}

export function CanvasDock({ showCamera = true }: CanvasDockProps) {
  const addNode = useStore((s) => s.addNode)
  const path = useStore((s) => s.path)
  const undo = useStore((s) => s.undo)
  const duplicateSelected = useStore((s) => s.duplicateSelected)
  const deleteSelected = useStore((s) => s.deleteSelected)
  const nodes = useStore((s) => s.nodes)
  const projectName = useStore((s) => s.projectName)
  const loadProject = useStore((s) => s.loadProject)
  const reset = useStore((s) => s.reset)

  const inputRef = useRef<HTMLInputElement>(null)
  const [zoom, setZoom] = useState(1)

  useEffect(() => subscribeCanvasZoom(setZoom), [])

  const spawn = (type: NodeType) => {
    const jitter = (Math.random() * 80 - 40) | 0
    addNode(type, { x: 180 + jitter, y: 160 + jitter }, path.length ? path[path.length - 1] : null)
  }

  const handleExport = () => {
    const blob = new Blob(
      [JSON.stringify({ version: 1, name: projectName, nodes }, null, 2)],
      { type: "application/json" },
    )
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${projectName.replace(/\s+/g, "-").toLowerCase()}.canvas.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleImport = async (file: File) => {
    try {
      const text = await file.text()
      loadProject(parseProjectFile(text))
    } catch (err) {
      // eslint-disable-next-line no-alert
      alert(`Could not import file: ${(err as Error).message}`)
    }
  }

  const canvas = getCanvasHandlers()

  return (
    <>
      {/* Центральный док — создание, undo, I/O, центр */}
      <div className="pointer-events-auto absolute bottom-4 left-1/2 z-30 flex max-w-[calc(100%-2rem)] -translate-x-1/2 flex-wrap items-center justify-center gap-0.5 rounded-[14px] border border-border bg-[rgba(14,14,14,0.94)] p-1 shadow-[0_8px_32px_rgba(0,0,0,0.5)] backdrop-blur-md" data-canvas-ui>
        {SPAWN_ITEMS.map(({ type, label, hotkey, icon: Icon }) => (
          <DockButton key={type} onClick={() => spawn(type)} title={`Создать ${label}`} hotkey={hotkey}>
            <Icon className="size-3.5 shrink-0" aria-hidden />
            <span className="hidden sm:inline">{label}</span>
          </DockButton>
        ))}

        <DockDivider />

        <DockButton onClick={() => undo()} title="Отменить" hotkey="Z">
          <Undo2 className="size-3.5 shrink-0" aria-hidden />
          <span className="hidden sm:inline">Undo</span>
        </DockButton>
        <DockButton onClick={() => duplicateSelected()} title="Дублировать" hotkey="Space">
          <Copy className="size-3.5 shrink-0" aria-hidden />
          <span className="hidden md:inline">Dup</span>
        </DockButton>
        <DockButton onClick={() => deleteSelected()} title="Удалить" hotkey="Del">
          <span className="size-3.5 shrink-0 text-center text-xs leading-[14px]" aria-hidden>⌫</span>
          <span className="hidden md:inline">Del</span>
        </DockButton>

        <DockDivider />

        <DockButton onClick={() => inputRef.current?.click()} title="Импорт проекта">
          <Upload className="size-3.5 shrink-0" aria-hidden />
          <span className="hidden lg:inline">Import</span>
        </DockButton>
        <DockButton onClick={handleExport} title="Экспорт проекта" active>
          <Download className="size-3.5 shrink-0" aria-hidden />
          <span className="hidden lg:inline">Export</span>
        </DockButton>
        <button
          type="button"
          onClick={() => {
            if (confirm("Reset to the sample project? Unsaved changes will be lost.")) reset()
          }}
          title="Сбросить проект"
          className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-foreground/[0.06] hover:text-foreground focus:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          <RotateCcw className="size-3.5" aria-hidden />
          <span className="sr-only">Reset</span>
        </button>

        {showCamera && canvas && (
          <>
            <DockDivider />
            <DockButton onClick={() => canvas.recenter()} title="Центр доски">
              <LocateFixed className="size-3.5 shrink-0" aria-hidden />
              <span className="hidden sm:inline">Центр</span>
            </DockButton>
          </>
        )}
      </div>

      {/* Zoom — справа внизу */}
      {showCamera && canvas && (
        <div className="pointer-events-auto absolute bottom-4 right-4 z-30 flex items-center gap-0.5 rounded-[14px] border border-border bg-[rgba(14,14,14,0.94)] p-1 shadow-[0_8px_32px_rgba(0,0,0,0.5)] backdrop-blur-md" data-canvas-ui>
          <button
            type="button"
            onClick={() => canvas.zoomOut()}
            title="Отдалить (−)"
            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-foreground/[0.06] hover:text-foreground focus:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <Minus className="size-3.5" aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => canvas.zoomReset()}
            title="100% (0)"
            className="min-w-12 rounded-md px-2 py-1 text-center font-mono text-[11px] tabular-nums text-foreground transition-colors hover:bg-foreground/[0.06] focus:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            {Math.round(zoom * 100)}%
          </button>
          <button
            type="button"
            onClick={() => canvas.zoomIn()}
            title="Приблизить (+)"
            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-foreground/[0.06] hover:text-foreground focus:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <Plus className="size-3.5" aria-hidden />
          </button>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept=".json,application/json"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) handleImport(file)
          e.target.value = ""
        }}
      />
    </>
  )
}
