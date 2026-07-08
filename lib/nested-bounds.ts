import type { NodeMap, SysNode } from "./types"
import {
  LAYOUT_PAD,
  measureContainerSize,
  measureContainerSizeFromNodes,
  minInnerWidthFor,
  type LayoutSize,
} from "./auto-layout"

export { LAYOUT_PAD, measureContainerSize } from "./auto-layout"
export const NESTED_BODY_PAD = LAYOUT_PAD
export const NESTED_BODY_MIN = 48
export const NESTED_HEADER_H = 36

export function nestedContainerSize(node: SysNode, children: SysNode[], nodes?: NodeMap): LayoutSize {
  if (nodes) return measureContainerSizeFromNodes(nodes, children, minInnerWidthFor(node))
  return measureContainerSize(children, minInnerWidthFor(node))
}
