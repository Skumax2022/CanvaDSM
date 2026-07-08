import type { NodeId } from "../types"
import { pointInRect } from "./coords"
import type { BodyRect, CanvasDomAdapter } from "./types"

function parseRect(el: Element | null): BodyRect | null {
  if (!(el instanceof HTMLElement)) return null
  const r = el.getBoundingClientRect()
  return { left: r.left, top: r.top, width: r.width, height: r.height }
}

export function createBrowserDomAdapter(): CanvasDomAdapter {
  return {
    bodyRect(parentId: NodeId): BodyRect | null {
      const roots = document.querySelectorAll(`[data-node-id="${parentId}"]`)
      for (const root of roots) {
        if (!(root instanceof HTMLElement)) continue
        if (root.closest(".is-dragging, .dragging")) continue
        const el = root.querySelector(".node-body")
        const rect = parseRect(el)
        if (rect) return rect
      }
      return null
    },

    dropTargetAt(clientX: number, clientY: number, forbidden: Set<NodeId>): NodeId | "root" {
      const elements = document.elementsFromPoint?.(clientX, clientY) ?? [
        document.elementFromPoint(clientX, clientY),
      ].filter(Boolean)

      for (const el of elements) {
        if (!(el instanceof HTMLElement)) continue
        if (el.classList.contains("is-dragging") || el.classList.contains("dragging")) continue
        const id = el.getAttribute("data-droppable-id")
        if (!id) continue
        if (id === "__root__") return "root"
        if (!forbidden.has(id)) return id
      }
      return "root"
    },

    pointInBody(parentId: NodeId, clientX: number, clientY: number): boolean {
      const rect = this.bodyRect(parentId)
      return rect ? pointInRect(clientX, clientY, rect) : false
    },
  }
}

export type { CanvasDomAdapter }
