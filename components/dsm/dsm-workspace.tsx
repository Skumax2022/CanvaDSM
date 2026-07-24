"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Box, ChevronDown, ChevronRight, Hash, Search, Settings2, Square, SquareDashed } from "lucide-react"
import { useStore } from "@/lib/store"
import { RECT_KIND_META } from "@/lib/rect-kinds"
import { ancestorChain, flattenTree, isLinkable, resolveCell, childrenOf, type DsmRow } from "@/lib/tree"
import type { NodeType, RectKind } from "@/lib/types"

const TYPE_ICON: Record<NodeType, typeof Box> = {
  SPACE: SquareDashed,
  RECTANGLE: Box,
  SQUARE: Square,
}

function RectKindDsmIcon({ kind }: { kind: RectKind }) {
  const meta = RECT_KIND_META[kind]
  switch (kind) {
    case "FUNCTION":
      return <Settings2 className={`size-3 shrink-0 ${meta.accent}`} aria-hidden />
    case "NUMBER":
      return <Hash className={`size-3 shrink-0 ${meta.accent}`} aria-hidden />
    case "OBJECT":
      return <Box className={`size-3 shrink-0 ${meta.accent}`} aria-hidden />
    default:
      return <Square className="size-3 shrink-0 text-foreground" fill="currentColor" aria-hidden />
  }
}

function NodeIcon({ node }: { node: DsmRow["node"] }) {
  if (node.type === "RECTANGLE") {
    return <RectKindDsmIcon kind={node.rectKind ?? "DEFAULT"} />
  }
  const Icon = TYPE_ICON[node.type]
  return <Icon className={`size-3.5 shrink-0 ${node.type === "SPACE" ? "text-muted-foreground" : "text-foreground/80"}`} aria-hidden />
}

const LABEL_W = 248
const PREFERRED_CELL = 30
const MIN_CELL = 24
const MAX_CELL = 36

export function DSMWorkspace() {
  const nodes = useStore((s) => s.nodes)
  const collapsed = useStore((s) => s.collapsed)
  const toggleCollapse = useStore((s) => s.toggleCollapse)
  const toggleDependency = useStore((s) => s.toggleDependency)
  const search = useStore((s) => s.dsmSearch)
  const setSearch = useStore((s) => s.setDsmSearch)
  const selectedId = useStore((s) => s.selectedId)
  const select = useStore((s) => s.select)

  const scrollRef = useRef<HTMLDivElement>(null)
  const [containerW, setContainerW] = useState(0)
  const [hover, setHover] = useState<{ r?: number; c?: number } | null>(null)
  const [zoom, setZoom] = useState(1)

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => {
      setContainerW(entry.contentRect.width)
    })
    ro.observe(el)
    setContainerW(el.clientWidth)
    return () => ro.disconnect()
  }, [])

  const collapsedEff = useMemo(() => (search ? new Set<string>() : collapsed), [search, collapsed])

  const rows: DsmRow[] = useMemo(() => {
    let list = flattenTree(nodes, collapsedEff)
    if (search) {
      const q = search.toLowerCase()
      const matched = Object.values(nodes).filter((n) => n.title.toLowerCase().includes(q))
      const keep = new Set(matched.map((n) => n.id))
      for (const n of matched) ancestorChain(nodes, n.id).forEach((a) => keep.add(a.id))
      list = list.filter((r) => keep.has(r.node.id))
    }
    return list
  }, [nodes, collapsedEff, search])

  const baseCell = useMemo(() => {
    if (!containerW || rows.length === 0) return PREFERRED_CELL
    const available = containerW - LABEL_W - 8
    const fit = Math.floor(available / rows.length)
    if (fit >= PREFERRED_CELL) return Math.min(MAX_CELL, fit)
    if (fit >= MIN_CELL) return fit
    return PREFERRED_CELL
  }, [containerW, rows.length])

  const cellSize = useMemo(() => {
    return Math.round(Math.min(MAX_CELL * 2, Math.max(MIN_CELL, baseCell * zoom)))
  }, [baseCell, zoom])

  const colHeaderHeight = useMemo(() => {
    const longest = rows.reduce((m, r) => Math.max(m, r.node.title.length), 0)
    const charW = 6.5
    const diagSpan = longest * charW * 0.707 + 28
    return Math.min(220, Math.max(72, Math.ceil(diagSpan), cellSize * 2.5))
  }, [rows, cellSize])

  const canLink = (row: DsmRow) =>
    isLinkable(row.node) && !(collapsedEff.has(row.node.id) && childrenOf(nodes, row.node.id).length > 0)

  const tableMinWidth = LABEL_W + rows.length * cellSize

  return (
    <div className="flex h-full flex-col bg-background">
      <div className="flex items-center gap-3 border-b border-border px-3 py-2">
        <div className="relative max-w-sm flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter nodes by title…"
            className="w-full rounded-md border border-border bg-card py-1.5 pl-8 pr-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-primary"
          />
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="hidden select-none sm:inline">Scale</span>
          <input
            type="range"
            min={0.5}
            max={2}
            step={0.05}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            aria-label="Adjust matrix horizontal scale"
            className="h-1 w-28 cursor-pointer appearance-none rounded-full bg-border accent-primary"
          />
          <span className="w-9 tabular-nums text-foreground">{Math.round(zoom * 100)}%</span>
          <button
            type="button"
            onClick={() => setZoom(1)}
            className="rounded-md border border-border px-2 py-1 text-[11px] text-muted-foreground hover:bg-card hover:text-foreground"
          >
            Reset
          </button>
        </div>
        <div className="hidden items-center gap-3 text-xs text-muted-foreground lg:flex">
          <span className="flex items-center gap-1.5">
            <span className="inline-block size-3 rounded-[3px] bg-primary" /> direct
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block size-3 rounded-full border-2 border-primary/70" /> aggregated
          </span>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
          No nodes match “{search}”.
        </div>
      ) : (
        <div
          ref={scrollRef}
          className="thin-scroll flex-1 overflow-auto"
          onMouseLeave={() => setHover(null)}
        >
          <table
            className="border-separate border-spacing-0"
            style={{ tableLayout: "fixed", width: tableMinWidth, minWidth: tableMinWidth }}
          >
            <thead>
              <tr>
                <th
                  className="sticky left-0 top-0 border-b border-r border-border bg-card"
                  style={{ width: LABEL_W, minWidth: LABEL_W, height: colHeaderHeight, zIndex: 40 + rows.length }}
                >
                  <div className="flex h-full items-end justify-start p-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                    rows depend on ↓ / cols →
                  </div>
                </th>
                {rows.map((col, c) => {
                  const colActive = hover?.c === c
                  const isSpaceCol = col.node.type === "SPACE"
                  // Diagonal length available before the label would run off the top of the header band.
                  const maxLabelW = Math.round((colHeaderHeight - 16) * 1.414)
                  return (
                    <th
                      key={col.node.id}
                      onMouseEnter={() => setHover({ c })}
                      className={`sticky top-0 border-b border-border transition-colors duration-75 ${
                        colActive ? "bg-primary/12" : isSpaceCol ? "bg-muted/25" : "bg-card"
                      }`}
                      style={{
                        width: cellSize,
                        minWidth: cellSize,
                        height: colHeaderHeight,
                        // Earlier (left) columns paint above later ones so a label overflowing
                        // up-and-to-the-right stays on top of its right-hand neighbours.
                        zIndex: 20 + (rows.length - c),
                      }}
                    >
                      <div className="relative h-full w-full">
                        <div
                          className="pointer-events-none absolute bottom-1 left-0 flex origin-bottom-left items-center gap-1 whitespace-nowrap text-[11px] leading-none"
                          style={{ transform: `translateX(${cellSize / 2 - 5}px) rotate(-45deg)` }}
                          title={col.node.title}
                        >
                          <NodeIcon node={col.node} />
                          <span
                            className={`truncate ${
                              col.node.type === "RECTANGLE"
                                ? RECT_KIND_META[col.node.rectKind ?? "DEFAULT"].dsmColor
                                : isSpaceCol
                                  ? "text-muted-foreground/70"
                                  : "text-foreground"
                            }`}
                            style={{ maxWidth: maxLabelW }}
                          >
                            {col.node.title}
                          </span>
                        </div>
                      </div>
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, r) => {
                const rowActive = hover?.r === r
                const isSpace = row.node.type === "SPACE"
                return (
                  <tr key={row.node.id}>
                    <th
                      scope="row"
                      onMouseEnter={() => setHover({ r })}
                      className={`sticky left-0 z-10 border-b border-r border-border text-left transition-colors duration-75 ${
                        rowActive
                          ? "bg-primary/12"
                          : isSpace
                            ? "bg-muted/25"
                            : "bg-card"
                      } ${selectedId === row.node.id ? "outline outline-1 outline-primary" : ""}`}
                      style={{ width: LABEL_W, minWidth: LABEL_W, height: cellSize }}
                    >
                      <div
                        className="flex items-center gap-1 pr-2"
                        style={{ paddingLeft: 6 + row.depth * 14 }}
                      >
                        {row.hasChildren ? (
                          <button
                            type="button"
                            onClick={() => toggleCollapse(row.node.id)}
                            className="rounded-sm p-0.5 text-muted-foreground hover:bg-background hover:text-foreground"
                            aria-label={row.collapsed ? "Expand" : "Collapse"}
                          >
                            {row.collapsed ? <ChevronRight className="size-3.5" /> : <ChevronDown className="size-3.5" />}
                          </button>
                        ) : (
                          <span className="w-[18px]" />
                        )}
                        <NodeIcon node={row.node} />
                        <button
                          type="button"
                          onClick={() => select(row.node.id)}
                          className={`truncate text-sm hover:underline ${
                            row.node.type === "RECTANGLE"
                              ? RECT_KIND_META[row.node.rectKind ?? "DEFAULT"].dsmColor
                              : "text-foreground"
                          }`}
                          title={row.node.title}
                        >
                          {row.node.title}
                        </button>
                        {isSpace && (
                          <span className="ml-auto text-[9px] uppercase tracking-wider text-muted-foreground">group</span>
                        )}
                      </div>
                    </th>

                    {rows.map((col, c) => {
                      const isDiagonal = r === c
                      const state = resolveCell(nodes, collapsedEff, row.node.id, col.node.id)
                      const linkable = canLink(row) && canLink(col) && !isDiagonal
                      const inCrosshair = hover != null && (hover.r === r || hover.c === c)
                      const atCrosshair = hover?.r === r && hover?.c === c
                      const disabled = row.node.type === "SPACE" || col.node.type === "SPACE"

                      let cellBg = "bg-transparent"
                      if (atCrosshair) {
                        cellBg = disabled ? "bg-primary/14" : "bg-primary/22"
                      } else if (inCrosshair) {
                        cellBg = disabled ? "bg-primary/[0.06]" : "bg-primary/[0.08]"
                      } else if (isDiagonal) {
                        cellBg = "bg-muted/20"
                      } else if (disabled) {
                        cellBg = "bg-muted/25"
                      }

                      return (
                        <td
                          key={col.node.id}
                          onMouseEnter={() => setHover({ r, c })}
                          onClick={() => {
                            if (linkable && state !== "aggregate") toggleDependency(row.node.id, col.node.id)
                          }}
                          className={`border-b border-r border-border/60 p-0 text-center align-middle transition-colors duration-75 ${cellBg} ${
                            linkable && state !== "aggregate" ? "cursor-pointer" : disabled ? "cursor-default" : ""
                          }`}
                          style={{ width: cellSize, minWidth: cellSize, height: cellSize }}
                        >
                          {isDiagonal ? (
                            <span className="inline-block size-1 rounded-full bg-muted-foreground/40" />
                          ) : state === "direct" ? (
                            <span
                              className={`mx-auto block rounded-[4px] shadow-sm ${
                                cellSize >= 28 ? "size-3.5" : "size-2.5"
                              } ${
                                row.node.type === "RECTANGLE"
                                  ? row.node.rectKind === "FUNCTION"
                                    ? "bg-violet-500"
                                    : row.node.rectKind === "NUMBER"
                                      ? "bg-emerald-500"
                                      : row.node.rectKind === "OBJECT"
                                        ? "bg-orange-500"
                                        : "bg-primary"
                                  : "bg-primary"
                              }`}
                            />
                          ) : state === "aggregate" ? (
                            <span
                              className={`mx-auto block rounded-full border-2 border-primary/70 ${
                                cellSize >= 28 ? "size-3" : "size-2"
                              }`}
                              title="Aggregated dependency inside a collapsed branch"
                            />
                          ) : null}
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
