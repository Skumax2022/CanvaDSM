"use client"

import { useRef } from "react"
import { Download, RotateCcw, Upload } from "lucide-react"
import { useStore } from "@/lib/store"
import type { ProjectFile } from "@/lib/types"

export function parseProjectFile(text: string): ProjectFile {
  const data = JSON.parse(text)
  if (!data || typeof data !== "object" || typeof data.nodes !== "object") {
    throw new Error("Invalid project file: missing nodes map.")
  }
  return {
    version: 1,
    name: typeof data.name === "string" ? data.name : "Imported System",
    nodes: data.nodes,
  }
}

export function FileIO() {
  const inputRef = useRef<HTMLInputElement>(null)
  const nodes = useStore((s) => s.nodes)
  const projectName = useStore((s) => s.projectName)
  const loadProject = useStore((s) => s.loadProject)
  const reset = useStore((s) => s.reset)

  const handleExport = () => {
    const file: ProjectFile = { version: 1, name: projectName, nodes }
    const blob = new Blob([JSON.stringify(file, null, 2)], { type: "application/json" })
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

  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        title="Import project (.json)"
        className="flex items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
      >
        <Upload className="size-4" aria-hidden />
        <span className="hidden lg:inline">Import</span>
      </button>
      <button
        type="button"
        onClick={handleExport}
        title="Export project (.json)"
        className="flex items-center gap-1.5 rounded-md bg-primary px-2.5 py-1.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
      >
        <Download className="size-4" aria-hidden />
        <span className="hidden lg:inline">Export</span>
      </button>
      <button
        type="button"
        onClick={() => {
          if (confirm("Reset to the sample project? Unsaved changes will be lost.")) reset()
        }}
        title="Reset to sample project"
        className="flex items-center rounded-md border border-border bg-card p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
      >
        <RotateCcw className="size-4" aria-hidden />
        <span className="sr-only">Reset project</span>
      </button>
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
    </div>
  )
}
