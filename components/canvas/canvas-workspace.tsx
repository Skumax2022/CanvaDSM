"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { motion } from "framer-motion"
import { MousePointer2 } from "lucide-react"
import { registerCanvasHandlers, setCanvasZoomLevel, unregisterCanvasHandlers } from "@/lib/canvas-bridge"
import { clientToCanvas as canvasClientToCanvas } from "@/lib/canvas/coords"
import { useStore } from "@/lib/store"
import { childrenOf } from "@/lib/tree"
import type { NodeId } from "@/lib/types"
import { CanvasDock } from "@/components/canvas-dock"
import { CanvasCtx } from "./canvas-context"
import { NodeView } from "./node-view"
import { useCanvasDrag } from "./use-canvas-drag"

interface Camera {
  x: number
  y: number
  zoom: number
}

interface PanState {
  pointerId: number
  x: number
  y: number
  camX: number
  camY: number
}

interface MarqueeState {
  pointerId: number
  startCanvas: { x: number; y: number }
}

const MIN_ZOOM = 0.25
const MAX_ZOOM = 2.5
const GRID = 24

function snapCamera(cam: Camera): Camera {
  return {
    zoom: Math.round(cam.zoom * 1000) / 1000,
    x: Math.round(cam.x),
    y: Math.round(cam.y),
  }
}

export function CanvasWorkspace() {
  const nodes = useStore((s) => s.nodes)
  const path = useStore((s) => s.path)
  const viewParentId = path.length ? path[path.length - 1] : null
  const topLevel = useMemo(() => childrenOf(nodes, viewParentId), [nodes, viewParentId])

  const pushHistory = useStore((s) => s.pushHistory)
  const setNodesFromDrop = useStore((s) => s.setNodesFromDrop)
  const select = useStore((s) => s.select)
  const selectMany = useStore((s) => s.selectMany)
  const enterSquare = useStore((s) => s.enterSquare)
  const selectedId = useStore((s) => s.selectedId)
  const selectedIds = useStore((s) => s.selectedIds)

  const viewportRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const cameraRef = useRef<Camera>({ x: 60, y: 60, zoom: 1 })
  const [camera, setCamera] = useState<Camera>({ x: 60, y: 60, zoom: 1 })
  const cameraTargetRef = useRef<Camera>(camera)
  const rafRef = useRef<number | null>(null)
  const pointerInViewportRef = useRef({ x: 0, y: 0 })

  const panRef = useRef<PanState | null>(null)
  const marqueeRef = useRef<MarqueeState | null>(null)
  const [panning, setPanning] = useState(false)
  const [marquee, setMarquee] = useState<{ x: number; y: number; w: number; h: number } | null>(null)

  const getCamera = useCallback(() => cameraRef.current, [])

  const applyCamera = useCallback((next: Camera) => {
    const snapped = snapCamera(next)
    cameraTargetRef.current = snapped
    cameraRef.current = snapped
    if (rafRef.current != null) return
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null
      setCamera({ ...cameraTargetRef.current })
    })
  }, [])

  const clientToCanvas = useCallback((cx: number, cy: number) => {
    const vp = viewportRef.current?.getBoundingClientRect()
    if (!vp) return { x: 0, y: 0 }
    return canvasClientToCanvas(cx, cy, {
      rect: { left: vp.left, top: vp.top, width: vp.width, height: vp.height },
      camera: cameraRef.current,
    })
  }, [])

  const { startDrag, cancelDrag, visual, hoverDropId } = useCanvasDrag({
    nodes,
    viewParentId,
    selectedIds,
    viewportRef,
    getCamera,
    onSelect: select,
    onBeforeMutate: pushHistory,
    onApplyNodes: setNodesFromDrop,
    onEnterSquare: enterSquare,
  })

  const zoomAt = useCallback(
    (clientX: number, clientY: number, factor: number) => {
      const vp = viewportRef.current?.getBoundingClientRect()
      if (!vp) return
      const mx = clientX - vp.left
      const my = clientY - vp.top
      const c = cameraRef.current
      const zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, c.zoom * factor))
      const ratio = zoom / c.zoom
      applyCamera({ zoom, x: mx - (mx - c.x) * ratio, y: my - (my - c.y) * ratio })
    },
    [applyCamera],
  )

  const zoomBy = useCallback(
    (factor: number) => {
      const vp = viewportRef.current?.getBoundingClientRect()
      const p = pointerInViewportRef.current
      zoomAt(vp ? vp.left + p.x : 0, vp ? vp.top + p.y : 0, factor)
    },
    [zoomAt],
  )

  const zoomReset = useCallback(() => {
    applyCamera({ ...cameraRef.current, zoom: 1 })
  }, [applyCamera])

  useEffect(() => {
    setCanvasZoomLevel(camera.zoom)
  }, [camera.zoom])

  useEffect(() => {
    applyCamera({ x: 60, y: 60, zoom: 1 })
  }, [viewParentId, applyCamera])

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const vp = viewportRef.current?.getBoundingClientRect()
      if (vp) pointerInViewportRef.current = { x: e.clientX - vp.left, y: e.clientY - vp.top }

      const mq = marqueeRef.current
      if (mq && e.pointerId === mq.pointerId) {
        const cur = clientToCanvas(e.clientX, e.clientY)
        const sx = mq.startCanvas.x
        const sy = mq.startCanvas.y
        setMarquee({
          x: Math.min(sx, cur.x),
          y: Math.min(sy, cur.y),
          w: Math.abs(cur.x - sx),
          h: Math.abs(cur.y - sy),
        })
        const left = Math.min(sx, cur.x)
        const right = Math.max(sx, cur.x)
        const top = Math.min(sy, cur.y)
        const bottom = Math.max(sy, cur.y)
        const hits = topLevel.filter((n) => {
          const nx = n.ui_position.x
          const ny = n.ui_position.y
          return nx < right && nx + n.ui_size.width > left && ny < bottom && ny + n.ui_size.height > top
        })
        selectMany(hits.map((n) => n.id))
        return
      }

      const pan = panRef.current
      if (pan && e.pointerId === pan.pointerId) {
        applyCamera({
          ...cameraRef.current,
          x: pan.camX + (e.clientX - pan.x),
          y: pan.camY + (e.clientY - pan.y),
        })
      }
    }

    const onUp = (e: PointerEvent) => {
      if (panRef.current?.pointerId === e.pointerId) {
        panRef.current = null
        setPanning(false)
      }
      if (marqueeRef.current?.pointerId === e.pointerId) {
        marqueeRef.current = null
        setMarquee(null)
      }
    }

    window.addEventListener("pointermove", onMove)
    window.addEventListener("pointerup", onUp)
    return () => {
      window.removeEventListener("pointermove", onMove)
      window.removeEventListener("pointerup", onUp)
    }
  }, [applyCamera, clientToCanvas, selectMany, topLevel])

  const onViewportPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return
    if ((e.target as HTMLElement).closest?.("[data-canvas-ui]")) return
    const vp = viewportRef.current
    if (!vp) return
    vp.setPointerCapture(e.pointerId)

    if (e.shiftKey) {
      select(null)
      marqueeRef.current = { pointerId: e.pointerId, startCanvas: clientToCanvas(e.clientX, e.clientY) }
      const s = marqueeRef.current.startCanvas
      setMarquee({ x: s.x, y: s.y, w: 0, h: 0 })
      return
    }

    select(null)
    cancelDrag()
    panRef.current = {
      pointerId: e.pointerId,
      x: e.clientX,
      y: e.clientY,
      camX: cameraRef.current.x,
      camY: cameraRef.current.y,
    }
    setPanning(true)
  }

  const recenter = useCallback(() => {
    const vp = viewportRef.current
    const content = contentRef.current
    if (!vp) return
    const vpRect = vp.getBoundingClientRect()
    if (!content || topLevel.length === 0) {
      applyCamera({ x: 60, y: 60, zoom: 1 })
      return
    }
    const cam = cameraRef.current
    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity
    for (const child of Array.from(content.children)) {
      const r = child.getBoundingClientRect()
      minX = Math.min(minX, r.left)
      minY = Math.min(minY, r.top)
      maxX = Math.max(maxX, r.right)
      maxY = Math.max(maxY, r.bottom)
    }
    if (!Number.isFinite(minX)) {
      applyCamera({ x: 60, y: 60, zoom: 1 })
      return
    }
    const w = (maxX - minX) / cam.zoom
    const h = (maxY - minY) / cam.zoom
    const contentLeft = (minX - vpRect.left - cam.x) / cam.zoom
    const contentTop = (minY - vpRect.top - cam.y) / cam.zoom
    const PAD = 80
    const fitZoom = Math.min(
      MAX_ZOOM,
      Math.max(MIN_ZOOM, Math.min((vpRect.width - PAD) / w, (vpRect.height - PAD) / h)),
    )
    applyCamera({
      zoom: fitZoom,
      x: (vpRect.width - w * fitZoom) / 2 - contentLeft * fitZoom,
      y: (vpRect.height - h * fitZoom) / 2 - contentTop * fitZoom,
    })
  }, [topLevel.length, applyCamera])

  useEffect(() => {
    registerCanvasHandlers({
      zoomIn: () => zoomBy(1.2),
      zoomOut: () => zoomBy(1 / 1.2),
      zoomReset,
      recenter,
    })
    return () => unregisterCanvasHandlers()
  }, [zoomBy, zoomReset, recenter])

  useEffect(() => {
    const vp = viewportRef.current
    if (!vp) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      zoomAt(e.clientX, e.clientY, Math.exp(-e.deltaY * 0.0015))
    }
    vp.addEventListener("wheel", onWheel, { passive: false })
    return () => vp.removeEventListener("wheel", onWheel)
  }, [zoomAt])

  const ctxValue = useMemo(
    () => ({
      dragVisual: visual,
      startDrag,
      hoverDropId,
      selectedId,
      selectedIds,
    }),
    [visual, startDrag, hoverDropId, selectedId, selectedIds],
  )

  const delta = visual.canvasDelta ?? { x: 0, y: 0 }

  return (
    <CanvasCtx.Provider value={ctxValue}>
      <div className="relative h-full w-full overflow-hidden">
        <div
          ref={viewportRef}
          onPointerDown={onViewportPointerDown}
          className={`canvas-grid relative h-full w-full overflow-hidden touch-none ${panning ? "cursor-grabbing" : "cursor-grab"}`}
          style={{
            backgroundSize: `${Math.round(GRID * camera.zoom)}px ${Math.round(GRID * camera.zoom)}px`,
            backgroundPosition: `${Math.round(camera.x)}px ${Math.round(camera.y)}px`,
          }}
          data-droppable-id="__root__"
          aria-label="Infinite canvas"
        >
          <div
            className="absolute left-0 top-0 origin-top-left will-change-transform"
            style={{
              transform: `translate3d(${Math.round(camera.x)}px, ${Math.round(camera.y)}px, 0) scale(${camera.zoom})`,
            }}
          >
            <motion.div
              ref={contentRef}
              key={viewParentId ?? "__root__"}
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: "spring", stiffness: 260, damping: 26 }}
              className="relative"
            >
              {topLevel.map((node) => {
                const dragging =
                  visual.active && visual.dragIds.includes(node.id) && !visual.extracted
                const offset = dragging ? delta : { x: 0, y: 0 }
                return (
                  <motion.div
                    key={node.id}
                    layout={!dragging}
                    transition={{ type: "spring", stiffness: 300, damping: 25 }}
                    className="absolute"
                    style={{
                      left: node.ui_position.x + offset.x,
                      top: node.ui_position.y + offset.y,
                    }}
                  >
                    <NodeView nodeId={node.id} />
                  </motion.div>
                )
              })}
              {visual.extracted && visual.extractCanvasPos && visual.dragIds[0] && (
                <motion.div
                  className="pointer-events-none absolute z-40 opacity-95 drop-shadow-[0_8px_24px_rgba(0,0,0,0.45)]"
                  style={{
                    left: visual.extractCanvasPos.x,
                    top: visual.extractCanvasPos.y,
                  }}
                >
                  <NodeView nodeId={visual.dragIds[0]} />
                </motion.div>
              )}
            </motion.div>
          </div>

          {marquee && (
            <div
              className="pointer-events-none absolute z-40 border-2 border-foreground/70 bg-foreground/[0.06]"
              style={{
                left: camera.x + marquee.x * camera.zoom,
                top: camera.y + marquee.y * camera.zoom,
                width: marquee.w * camera.zoom,
                height: marquee.h * camera.zoom,
              }}
            />
          )}

          {topLevel.length === 0 && (
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2 text-center">
              <MousePointer2 className="size-6 text-muted-foreground" aria-hidden />
              <p className="text-sm text-muted-foreground">
                Пустая доска. Нажмите R / E / F или используйте панель внизу.
              </p>
            </div>
          )}
        </div>

        <CanvasDock showCamera />
      </div>
    </CanvasCtx.Provider>
  )
}
