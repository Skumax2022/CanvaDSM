"use client"

import { createContext, useContext } from "react"
import type { NodeId } from "@/lib/types"
import type { DragVisual } from "@/lib/canvas"

export interface CanvasCtxValue {
  dragVisual: DragVisual
  startDrag: (id: NodeId, e: React.PointerEvent) => void
  hoverDropId: NodeId | "root" | null
  selectedId: NodeId | null
  selectedIds: NodeId[]
}

export const CanvasCtx = createContext<CanvasCtxValue | null>(null)

export function useCanvasCtx(): CanvasCtxValue {
  const ctx = useContext(CanvasCtx)
  if (!ctx) throw new Error("useCanvasCtx must be used within CanvasCtx.Provider")
  return ctx
}
