/**
 * Standalone IIFE bundle entry — exposes window.CanvasEngine for index.html / app.js
 */
import * as CanvasEngine from "./index"

export {
  beginDrag,
  updateDrag,
  resolveDrop,
  toVisual,
  isDraggingNode,
  applyDropIntent,
  createBrowserDomAdapter,
  syncAllContainerLayouts,
  syncContainerBranch,
  measureContainerSize,
  sortChildrenByOrder,
  layoutItemsFromChildren,
  minInnerWidthFor,
  isCanvasChild,
  isNestedChild,
  clientToCanvas,
  canvasPosFromClient,
  viewParentFromPath,
  LAYOUT_GAP,
  LAYOUT_PAD,
  NESTED_HEADER_H,
} from "./index"

declare global {
  interface Window {
    CanvasEngine: typeof CanvasEngine
  }
}

if (typeof window !== "undefined") {
  window.CanvasEngine = CanvasEngine
}
