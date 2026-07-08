"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { NodeId, NodeMap } from "@/lib/types"
import {
  applyDropIntent,
  beginDrag,
  createBrowserDomAdapter,
  resolveDrop,
  toVisual,
  updateDrag,
  type DragSession,
  type DragVisual,
  type ViewportInfo,
} from "@/lib/canvas"

export interface UseCanvasDragOptions {
  nodes: NodeMap
  viewParentId: NodeId | null
  selectedIds: NodeId[]
  viewportRef: React.RefObject<HTMLElement | null>
  getCamera: () => { x: number; y: number; zoom: number }
  onSelect: (id: NodeId) => void
  onApplyNodes: (nodes: NodeMap) => void
  onEnterSquare: (id: NodeId) => void
  onBeforeMutate: () => void
}

export function useCanvasDrag({
  nodes,
  viewParentId,
  selectedIds,
  viewportRef,
  getCamera,
  onSelect,
  onApplyNodes,
  onEnterSquare,
  onBeforeMutate,
}: UseCanvasDragOptions) {
  const dom = useMemo(() => createBrowserDomAdapter(), [])
  const sessionRef = useRef<DragSession | null>(null)
  const nodesRef = useRef(nodes)
  const viewParentRef = useRef(viewParentId)
  const selectedRef = useRef(selectedIds)

  nodesRef.current = nodes
  viewParentRef.current = viewParentId
  selectedRef.current = selectedIds

  const [visual, setVisual] = useState<DragVisual>(() => toVisual(null))

  const viewportInfo = useCallback((): ViewportInfo | null => {
    const el = viewportRef.current
    if (!el) return null
    const r = el.getBoundingClientRect()
    return {
      rect: { left: r.left, top: r.top, width: r.width, height: r.height },
      camera: getCamera(),
    }
  }, [viewportRef, getCamera])

  const startDrag = useCallback(
    (nodeId: NodeId, e: React.PointerEvent) => {
      const vp = viewportInfo()
      if (!vp) return

      const el = e.currentTarget as HTMLElement
      const rect = el.getBoundingClientRect()

      if (!selectedRef.current.includes(nodeId)) {
        onSelect(nodeId)
      }

      sessionRef.current = beginDrag({
        nodeId,
        selectedIds: selectedRef.current.includes(nodeId) ? selectedRef.current : [nodeId],
        nodes: nodesRef.current,
        viewParentId: viewParentRef.current,
        pointerId: e.pointerId,
        clientX: e.clientX,
        clientY: e.clientY,
        nodeScreenRect: rect,
        viewport: vp,
        dom,
      })
    },
    [dom, onSelect, viewportInfo],
  )

  const cancelDrag = useCallback(() => {
    sessionRef.current = null
    setVisual(toVisual(null))
  }, [])

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const session = sessionRef.current
      const vp = viewportInfo()
      if (!session || e.pointerId !== session.pointerId || !vp) return

      const next = updateDrag({
        session,
        nodes: nodesRef.current,
        viewParentId: viewParentRef.current,
        clientX: e.clientX,
        clientY: e.clientY,
        viewport: vp,
        dom,
      })
      sessionRef.current = next
      setVisual(toVisual(next))
    }

    const onUp = (e: PointerEvent) => {
      const session = sessionRef.current
      const vp = viewportInfo()
      if (!session || e.pointerId !== session.pointerId) return

      sessionRef.current = null
      setVisual(toVisual(null))

      if (!session.active) {
        onSelect(session.nodeId)
        if (nodesRef.current[session.nodeId]?.type === "SQUARE") {
          onEnterSquare(session.nodeId)
        }
        return
      }

      if (!vp) return
      onBeforeMutate()
      const intent = resolveDrop({
        session,
        nodes: nodesRef.current,
        viewParentId: viewParentRef.current,
        clientX: e.clientX,
        clientY: e.clientY,
        viewport: vp,
        dom,
      })
      const nextNodes = applyDropIntent(nodesRef.current, intent, viewParentRef.current)
      onApplyNodes(nextNodes)
    }

    const onCancel = () => cancelDrag()

    window.addEventListener("pointermove", onMove)
    window.addEventListener("pointerup", onUp)
    window.addEventListener("pointercancel", onCancel)
    window.addEventListener("blur", onCancel)
    return () => {
      window.removeEventListener("pointermove", onMove)
      window.removeEventListener("pointerup", onUp)
      window.removeEventListener("pointercancel", onCancel)
      window.removeEventListener("blur", onCancel)
    }
  }, [cancelDrag, dom, onApplyNodes, onBeforeMutate, onEnterSquare, onSelect, viewportInfo])

  return {
    startDrag,
    cancelDrag,
    visual,
    hoverDropId: visual.hoverTarget,
  }
}
