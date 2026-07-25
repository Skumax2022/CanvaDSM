export type NodeId = string

export type NodeType = "SPACE" | "RECTANGLE" | "SQUARE"

/** Визуальный подтип прямоугольника (ноды) */
export type RectKind = "DEFAULT" | "FUNCTION" | "NUMBER" | "OBJECT"

/** Статус готовности карточки: не готова / в работе / готова */
export type NodeStatus = "todo" | "in-progress" | "done"

export interface SysNode {
  id: NodeId
  type: NodeType
  /** Подтип для RECTANGLE; циклически переключается кнопкой на ноде */
  rectKind?: RectKind
  /** Статус готовности; переключается значком в левом верхнем углу */
  status?: NodeStatus
  title: string
  /** null for items living at the root of the current canvas level */
  parentId: NodeId | null
  /** IDs this node depends on (directed edge: this -> target) */
  dependencies: NodeId[]
  /** free position on the canvas level it belongs to */
  ui_position: { x: number; y: number }
  /** order among siblings when parent uses auto-layout */
  ui_order?: number
  ui_size: { width: number; height: number }
}

export type NodeMap = Record<NodeId, SysNode>

export type ViewMode = "canvas" | "split" | "dsm"

export interface ProjectFile {
  version: 1
  name: string
  nodes: NodeMap
}
