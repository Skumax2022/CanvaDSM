import { LAYOUT_PAD } from "../auto-layout"
import type { BodyRect, Camera, Point, ViewportInfo } from "./types"

export function pointInRect(
  clientX: number,
  clientY: number,
  rect: { left: number; top: number; right?: number; bottom?: number; width?: number; height?: number },
): boolean {
  const right = rect.right ?? rect.left + (rect.width ?? 0)
  const bottom = rect.bottom ?? rect.top + (rect.height ?? 0)
  return clientX >= rect.left && clientX <= right && clientY >= rect.top && clientY <= bottom
}

export function clientToCanvas(
  clientX: number,
  clientY: number,
  viewport: ViewportInfo,
): Point {
  const { rect, camera } = viewport
  return {
    x: (clientX - rect.left - camera.x) / camera.zoom,
    y: (clientY - rect.top - camera.y) / camera.zoom,
  }
}

export function canvasPosFromClient(
  clientX: number,
  clientY: number,
  viewport: ViewportInfo,
  grabCanvas: Point,
): Point {
  const pt = clientToCanvas(clientX, clientY, viewport)
  return { x: pt.x - grabCanvas.x, y: pt.y - grabCanvas.y }
}

export function bodyLocalFromClient(
  clientX: number,
  clientY: number,
  body: BodyRect,
  zoom: number,
): Point {
  return {
    x: (clientX - body.left) / zoom - LAYOUT_PAD,
    y: (clientY - body.top) / zoom - LAYOUT_PAD,
  }
}

export function bodyPosFromClient(
  clientX: number,
  clientY: number,
  body: BodyRect,
  zoom: number,
  grabBody: Point,
): Point {
  const local = bodyLocalFromClient(clientX, clientY, body, zoom)
  return { x: local.x - grabBody.x, y: local.y - grabBody.y }
}

export function nodeCanvasOriginFromScreen(
  screenLeft: number,
  screenTop: number,
  viewport: ViewportInfo,
): Point {
  return clientToCanvas(screenLeft, screenTop, viewport)
}

export function screenToBodyLocal(
  screenLeft: number,
  screenTop: number,
  body: BodyRect,
  zoom: number,
): Point {
  return {
    x: (screenLeft - body.left) / zoom,
    y: (screenTop - body.top) / zoom,
  }
}

export type { Camera, Point, ViewportInfo, BodyRect }
