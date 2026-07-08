/** Bridge between canvas viewport and global hotkeys / bottom dock. */

export interface CanvasBridgeHandlers {
  zoomIn: () => void
  zoomOut: () => void
  zoomReset: () => void
  recenter: () => void
}

let handlers: CanvasBridgeHandlers | null = null
let zoomLevel = 1
const zoomListeners = new Set<(z: number) => void>()

export function registerCanvasHandlers(next: CanvasBridgeHandlers) {
  handlers = next
}

export function unregisterCanvasHandlers() {
  handlers = null
}

export function getCanvasHandlers(): CanvasBridgeHandlers | null {
  return handlers
}

export function setCanvasZoomLevel(z: number) {
  zoomLevel = z
  zoomListeners.forEach((fn) => fn(z))
}

export function getCanvasZoomLevel() {
  return zoomLevel
}

export function subscribeCanvasZoom(fn: (z: number) => void) {
  zoomListeners.add(fn)
  fn(zoomLevel)
  return () => zoomListeners.delete(fn)
}
