"use client"

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { Box, CheckCircle2, Circle, CircleDashed, Hash, Loader, Pencil, Settings2, Square, X } from "lucide-react"
import { useStore } from "@/lib/store"
import { RECT_KIND_META } from "@/lib/rect-kinds"
import { nestedContainerSize } from "@/lib/nested-bounds"
import { sortChildrenByOrder } from "@/lib/auto-layout"
import { childrenOf } from "@/lib/tree"
import type { NodeStatus, RectKind, SysNode } from "@/lib/types"
import { useCanvasCtx } from "./canvas-context"

const STATUS_META: Record<
  NodeStatus,
  { label: string; icon: typeof Circle; color: string; ring: string }
> = {
  todo: { label: "Не готова", icon: CircleDashed, color: "text-muted-foreground", ring: "hover:bg-foreground/10" },
  "in-progress": { label: "В работе", icon: Loader, color: "text-amber-500", ring: "hover:bg-amber-500/15" },
  done: { label: "Готова", icon: CheckCircle2, color: "text-emerald-500", ring: "hover:bg-emerald-500/15" },
}

function StatusBadge({ nodeId, status }: { nodeId: string; status: NodeStatus }) {
  const cycleStatus = useStore((s) => s.cycleStatus)
  const meta = STATUS_META[status]
  const Icon = meta.icon
  return (
    <button
      type="button"
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation()
        cycleStatus(nodeId)
      }}
      title={`Статус: ${meta.label} — нажмите для смены`}
      aria-label={`Статус: ${meta.label}. Нажмите, чтобы изменить`}
      className={`flex items-center justify-center rounded-full bg-background/70 p-0.5 backdrop-blur-sm transition-colors ${meta.color} ${meta.ring}`}
    >
      <Icon className="size-3.5" aria-hidden />
    </button>
  )
}

function RectKindIcon({ kind, className }: { kind: RectKind; className?: string }) {
  switch (kind) {
    case "FUNCTION":
      return <Settings2 className={className} aria-hidden />
    case "NUMBER":
      return <Hash className={className} aria-hidden />
    case "OBJECT":
      return <Box className={className} aria-hidden />
    default:
      return <Square className={className} fill="currentColor" aria-hidden />
  }
}

export function NodeView({ nodeId }: { nodeId: string }) {
  const node = useStore((s) => s.nodes[nodeId])
  const nodes = useStore((s) => s.nodes)
  const children = useMemo(() => childrenOf(nodes, nodeId), [nodes, nodeId])
  const setTitle = useStore((s) => s.setTitle)
  const deleteNode = useStore((s) => s.deleteNode)
  const cycleRectKind = useStore((s) => s.cycleRectKind)
  const { dragVisual, hoverDropId, startDrag, selectedId, selectedIds } = useCanvasCtx()
  const { active: dragActive, dragIds, mode: dragMode, extracted, reorderIndex, bodyLocalPos } = dragVisual
  const dragId = dragVisual.dragIds[0] ?? null

  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus()
      inputRef.current?.select()
    }
  }, [editing])

  if (!node) return null

  const hasChildren = children.length > 0
  const isContainer = node.type === "RECTANGLE" || node.type === "SPACE"
  const nested = hasChildren && isContainer
  const rectKind = node.rectKind ?? "DEFAULT"
  const kindMeta = node.type === "RECTANGLE" ? RECT_KIND_META[rectKind] : null
  const status: NodeStatus = node.status ?? "todo"
  const isSquare = node.type === "SQUARE"
  const isPlate = node.type === "RECTANGLE" && !nested
  const isDragging = dragActive && dragIds.includes(nodeId) && !extracted
  const isDropTarget = hoverDropId === nodeId
  const isSelected = selectedIds.includes(nodeId) || selectedId === nodeId

  const sortedChildren = useMemo(() => sortChildrenByOrder(children), [children])

  const nestedLayout = useMemo(() => {
    if (!nested) return null
    return nestedContainerSize(node, sortedChildren, nodes)
  }, [nested, sortedChildren, node, nodes])

  const draggingChild =
    dragActive && dragMode === "nested" && !extracted && dragId && sortedChildren.some((c) => c.id === dragId)
      ? dragId
      : null
  const dragNode = draggingChild ? nodes[draggingChild] : null
  const visibleChildren = draggingChild ? sortedChildren.filter((c) => c.id !== draggingChild) : sortedChildren

  const beginEdit = () => {
    setDraft(node.title)
    setEditing(true)
  }
  const commit = () => {
    if (draft.trim()) setTitle(nodeId, draft.trim())
    setEditing(false)
  }

  const typeStyles: Record<SysNode["type"], string> = {
    SPACE: "border-dashed border-border/80 bg-foreground/[0.03]",
    RECTANGLE: kindMeta ? `${kindMeta.border} ${kindMeta.bg}` : "border-border bg-card",
    SQUARE: "border-border bg-card",
  }

  const controls = !editing && (
    <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover/node:opacity-100">
      {node.type === "RECTANGLE" && (
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation()
            cycleRectKind(nodeId)
          }}
          title={`Тип: ${kindMeta?.label ?? "Базовый"} — нажмите для смены`}
          className={`rounded-sm p-1 hover:bg-background/60 ${kindMeta?.accent ?? "text-muted-foreground"}`}
          aria-label="Cycle rectangle type"
        >
          <RectKindIcon kind={rectKind} className="size-3" />
        </button>
      )}
      <button
        type="button"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation()
          beginEdit()
        }}
        className="rounded-sm p-1 text-muted-foreground hover:bg-background/60 hover:text-foreground"
        aria-label="Rename"
      >
        <Pencil className="size-3" aria-hidden />
      </button>
      <button
        type="button"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation()
          deleteNode(nodeId)
        }}
        className="rounded-sm p-1 text-muted-foreground hover:bg-destructive/20 hover:text-destructive"
        aria-label="Delete"
      >
        <X className="size-3" aria-hidden />
      </button>
    </div>
  )

  const titleInner = editing ? (
    <input
      ref={inputRef}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter" && !e.nativeEvent.isComposing) commit()
        if (e.key === "Escape") setEditing(false)
      }}
      onPointerDown={(e) => e.stopPropagation()}
      className={`node-input w-full min-w-0 rounded-sm bg-input px-1 py-0.5 text-sm text-foreground outline-none ring-1 ring-foreground/50 ${
        isPlate || isSquare ? "text-center uppercase tracking-widest" : ""
      }`}
    />
  ) : (
    <span
      className={`truncate ${
        isSquare
          ? "line-clamp-4 whitespace-normal text-[9px] font-bold uppercase tracking-widest text-neutral-200"
          : isPlate
            ? `line-clamp-3 whitespace-normal node-plate-label ${kindMeta?.text ?? "text-foreground"}`
            : "text-sm font-medium text-foreground"
      }`}
    >
      {node.title}
    </span>
  )

  if (isSquare) {
    return (
      <div
        data-node-id={nodeId}
        onPointerDown={(e) => {
          if (e.button !== 0) return
          e.stopPropagation()
          startDrag(nodeId, e)
        }}
        onDoubleClick={(e) => {
          e.stopPropagation()
          beginEdit()
        }}
        style={{ width: node.ui_size.width, height: node.ui_size.height }}
        className={`group/node node-square relative flex cursor-grab flex-col items-center justify-center active:cursor-grabbing ${
          isDragging ? "opacity-40" : ""
        } ${isSelected ? "ring-1 ring-foreground shadow-[0_0_0_1px_rgba(255,255,255,0.35)]" : ""} ${
          isDropTarget ? "ring-2 ring-foreground/50" : ""
        }`}
      >
        <div className="relative z-[1] flex h-full w-full items-center justify-center px-2 py-2 text-center">
          {titleInner}
        </div>
        <div className="absolute left-1 top-1 z-[2]">
          <StatusBadge nodeId={nodeId} status={status} />
        </div>
        <div className="absolute right-1 top-1">{controls}</div>
      </div>
    )
  }

  const title = (
    <div
      className={`flex min-w-0 items-center gap-1.5 ${isPlate ? "node-plate-label w-full justify-center" : ""}`}
    >
      {!isPlate && node.type === "RECTANGLE" && kindMeta && (
        <RectKindIcon kind={rectKind} className={`size-3.5 shrink-0 ${kindMeta.accent}`} />
      )}
      {!isPlate && node.type === "SPACE" && (
        <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Space</span>
      )}
      {titleInner}
    </div>
  )

  return (
    <div
      data-droppable-id={isContainer || isPlate ? nodeId : undefined}
      data-node-id={nodeId}
      onPointerDown={(e) => {
        if (e.button !== 0) return
        e.stopPropagation()
        startDrag(nodeId, e)
      }}
      onDoubleClick={(e) => {
        e.stopPropagation()
        if (isContainer || isPlate) beginEdit()
      }}
      style={
        nested && nestedLayout
          ? {
              width: nestedLayout.containerWidth,
              height: nestedLayout.containerHeight,
            }
          : { width: node.ui_size.width, height: node.ui_size.height }
      }
      className={`group/node relative flex flex-col transition-[box-shadow,opacity] duration-150 ${
        nested ? "node-nested overflow-visible" : "overflow-hidden"
      } ${
        isPlate
          ? `node-plate cursor-grab active:cursor-grabbing ${kindMeta?.cssKind ?? ""}`
          : `rounded-lg border ${typeStyles[node.type]} cursor-grab active:cursor-grabbing`
      } ${isDragging ? "opacity-40" : ""} ${
        isSelected
          ? isPlate
            ? "ring-1 ring-foreground shadow-[0_0_0_1px_rgba(255,255,255,0.35)]"
            : "ring-2 ring-foreground/70"
          : ""
      } ${isDropTarget ? "ring-2 ring-foreground/50 shadow-[0_0_0_4px_rgba(255,255,255,0.06)]" : ""}`}
    >
      {nested ? (
        <>
          <div className="flex items-center justify-between gap-2 border-b border-border/70 bg-background/30 px-2.5 py-1.5">
            <div className="flex min-w-0 items-center gap-1.5">
              <StatusBadge nodeId={nodeId} status={status} />
              {title}
            </div>
            {controls}
          </div>
          <div
            className="node-body node-body--auto relative flex w-full flex-1 flex-shrink-0 flex-wrap content-start gap-3 overflow-visible p-3"
            style={nestedLayout ? { minHeight: nestedLayout.bodyHeight } : undefined}
          >
            {visibleChildren.flatMap((child, i) => {
              const items: ReactNode[] = []
              if (draggingChild && reorderIndex === i) {
                items.push(
                  <div
                    key={`slot-${i}`}
                    className="node-layout-slot shrink-0 rounded-[10px] border-2 border-dashed border-foreground/30 bg-foreground/[0.05]"
                    style={{ width: dragNode?.ui_size.width, height: dragNode?.ui_size.height }}
                  />,
                )
              }
              items.push(
                <div key={child.id} className="node-child-wrap shrink-0">
                  <NodeView nodeId={child.id} />
                </div>,
              )
              return items
            })}
            {draggingChild && reorderIndex === visibleChildren.length && (
              <div
                className="node-layout-slot shrink-0 rounded-[10px] border-2 border-dashed border-foreground/30 bg-foreground/[0.05]"
                style={{ width: dragNode?.ui_size.width, height: dragNode?.ui_size.height }}
              />
            )}
            {draggingChild && dragNode && bodyLocalPos && (
              <div
                className="node-child-wrap pointer-events-none absolute z-20 opacity-90"
                style={{ left: bodyLocalPos.x, top: bodyLocalPos.y }}
              >
                <NodeView nodeId={draggingChild} />
              </div>
            )}
          </div>
        </>
      ) : (
        <div className={`relative flex flex-1 items-center justify-center ${isPlate ? "px-[18px] py-3 text-center" : "px-3 py-2 text-center"}`}>
          {title}
          <div className="absolute left-1 top-1 z-[2]">
            <StatusBadge nodeId={nodeId} status={status} />
          </div>
          <div className="absolute right-1 top-1">{controls}</div>
        </div>
      )}
    </div>
  )
}
