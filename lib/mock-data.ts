import type { NodeMap } from "./types"
import { nextChildOrder } from "./auto-layout"

/** A realistic pre-populated system so every feature works out of the box. */
export const MOCK_NODES: NodeMap = {
  "space-backend": {
    id: "space-backend",
    type: "SPACE",
    title: "Backend Platform",
    parentId: null,
    dependencies: [],
    ui_position: { x: 80, y: 120 },
    ui_size: { width: 420, height: 320 },
    ui_order: 0,
  },
  "rect-auth": {
    id: "rect-auth",
    type: "RECTANGLE",
    rectKind: "FUNCTION",
    title: "Auth Service",
    parentId: "space-backend",
    dependencies: [],
    ui_position: { x: 0, y: 0 },
    ui_size: { width: 240, height: 72 },
    ui_order: 0,
  },
  "sq-crypto": {
    id: "sq-crypto",
    type: "SQUARE",
    title: "Encryption Algorithm",
    parentId: "rect-auth",
    dependencies: ["sq-user-db"],
    ui_position: { x: 0, y: 0 },
    ui_size: { width: 96, height: 96 },
    ui_order: 0,
  },
  "sq-session": {
    id: "sq-session",
    type: "SQUARE",
    title: "Session Store",
    parentId: "rect-auth",
    dependencies: [],
    ui_position: { x: 0, y: 0 },
    ui_size: { width: 96, height: 96 },
    ui_order: 1,
  },
  "rect-api": {
    id: "rect-api",
    type: "RECTANGLE",
    rectKind: "OBJECT",
    title: "API Gateway",
    parentId: "space-backend",
    dependencies: ["rect-auth"],
    ui_position: { x: 0, y: 0 },
    ui_size: { width: 240, height: 72 },
    ui_order: 1,
  },
  "sq-user-db": {
    id: "sq-user-db",
    type: "SQUARE",
    title: "User Database",
    parentId: "space-backend",
    dependencies: [],
    ui_position: { x: 0, y: 0 },
    ui_size: { width: 96, height: 96 },
    ui_order: 2,
  },
  "space-frontend": {
    id: "space-frontend",
    type: "SPACE",
    title: "Frontend App",
    parentId: null,
    dependencies: [],
    ui_position: { x: 680, y: 160 },
    ui_size: { width: 360, height: 300 },
    ui_order: 1,
  },
  "rect-dashboard": {
    id: "rect-dashboard",
    type: "RECTANGLE",
    rectKind: "NUMBER",
    title: "Dashboard Module",
    parentId: "space-frontend",
    dependencies: ["rect-api"],
    ui_position: { x: 0, y: 0 },
    ui_size: { width: 240, height: 72 },
    ui_order: 0,
  },
  "sq-charts": {
    id: "sq-charts",
    type: "SQUARE",
    title: "Charts Engine",
    parentId: "rect-dashboard",
    dependencies: ["sq-user-db"],
    ui_position: { x: 0, y: 0 },
    ui_size: { width: 96, height: 96 },
    ui_order: 0,
  },
  "sq-analytics": {
    id: "sq-analytics",
    type: "SQUARE",
    title: "Analytics Pipeline",
    parentId: null,
    dependencies: ["rect-api", "sq-user-db"],
    ui_position: { x: 300, y: 560 },
    ui_size: { width: 96, height: 96 },
    ui_order: 2,
  },
}

/** Assign ui_order to nodes loaded without it. */
export function normalizeLayoutOrders(nodes: NodeMap): NodeMap {
  const byParent = new Map<string | null, string[]>()
  for (const n of Object.values(nodes)) {
    const key = n.parentId
    if (!byParent.has(key)) byParent.set(key, [])
    byParent.get(key)!.push(n.id)
  }
  const out = { ...nodes }
  for (const [, ids] of byParent) {
    const sorted = ids
      .map((id) => out[id])
      .sort((a, b) => (a.ui_order ?? a.ui_position.x * 1000 + a.ui_position.y) - (b.ui_order ?? b.ui_position.x * 1000 + b.ui_position.y))
    sorted.forEach((n, i) => {
      out[n.id] = { ...n, ui_order: n.ui_order ?? i }
    })
  }
  return out
}

export function nextOrderInParent(nodes: NodeMap, parentId: string | null): number {
  return nextChildOrder(Object.values(nodes).filter((n) => n.parentId === parentId))
}
