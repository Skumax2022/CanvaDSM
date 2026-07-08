/**
 * @deprecated Import from `@/lib/canvas/coords` or `@/lib/canvas` instead.
 */
import { bodyPosFromClient, canvasPosFromClient } from "./canvas/coords"
import { createBrowserDomAdapter } from "./canvas/dom-adapter"
import { isCanvasChild } from "./canvas/view"

export {
  pointInRect,
  clientToCanvas,
  canvasPosFromClient,
  bodyLocalFromClient,
  bodyPosFromClient,
} from "./canvas/coords"

export function pointerCanvasPos(
  clientX: number,
  clientY: number,
  viewportRect: DOMRect,
  camera: { x: number; y: number; zoom: number },
  offsetInNode: { x: number; y: number },
) {
  return canvasPosFromClient(
    clientX,
    clientY,
    {
      rect: {
        left: viewportRect.left,
        top: viewportRect.top,
        width: viewportRect.width,
        height: viewportRect.height,
      },
      camera,
    },
    offsetInNode,
  )
}

export function pointerLocalInBody(
  clientX: number,
  clientY: number,
  bodyRect: DOMRect,
  zoom: number,
  offsetInNode: { x: number; y: number },
) {
  return bodyPosFromClient(clientX, clientY, bodyRect, zoom, offsetInNode)
}

export function findDropTargetAt(
  clientX: number,
  clientY: number,
  forbidden: Set<string>,
): string | "root" {
  return createBrowserDomAdapter().dropTargetAt(clientX, clientY, forbidden)
}

export function isCanvasLevelNode(nodeParentId: string | null, viewParentId: string | null): boolean {
  return isCanvasChild(nodeParentId, viewParentId)
}

export function canvasLocalInParent(
  canvasX: number,
  canvasY: number,
  _parentId: string,
  viewportRect: DOMRect,
  camera: { x: number; y: number; zoom: number },
) {
  const originX = -camera.x / camera.zoom
  const originY = -camera.y / camera.zoom
  return { x: canvasX - originX, y: canvasY - originY }
}
