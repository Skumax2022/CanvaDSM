"use client"

import { useEffect } from "react"
import { getCanvasHandlers } from "@/lib/canvas-bridge"
import { HOTKEYS_CONFIG as FALLBACK_CONFIG, type HotkeySpec } from "@/lib/hotkeys-config"
import { useStore } from "@/lib/store"

const BOARD_COMMAND_CODES = new Set([
  "KeyR", "KeyE", "KeyF", "KeyZ", "Space",
  "Delete", "Backspace", "Equal", "NumpadAdd",
  "Minus", "NumpadSubtract", "Digit0",
])

function isEditableTarget(el: EventTarget | null, e: KeyboardEvent): boolean {
  if (!(el instanceof HTMLElement)) return false
  if (el.id === "dsm-search" && BOARD_COMMAND_CODES.has(e.code)) return false
  if (el.classList.contains("node-input")) return true
  const tag = el.tagName
  return tag === "INPUT" || tag === "TEXTAREA" || el.isContentEditable
}

function modifiersMatch(e: KeyboardEvent, spec: HotkeySpec): boolean {
  const wantCtrl = spec.ctrl === true
  const forbidCtrl = spec.ctrl === false
  if (wantCtrl && !(e.ctrlKey || e.metaKey)) return false
  if (forbidCtrl && (e.ctrlKey || e.metaKey)) return false
  if (!wantCtrl && !forbidCtrl && (e.ctrlKey || e.metaKey)) return false
  if (spec.shift === true && !e.shiftKey) return false
  if (spec.shift === false && e.shiftKey) return false
  if (spec.alt === true && !e.altKey) return false
  if (spec.alt === false && e.altKey) return false
  return true
}

function matchHotkey(e: KeyboardEvent, spec: HotkeySpec): boolean {
  const codes = spec.codes ?? (spec.code ? [spec.code] : [])
  const keys = spec.keys ?? (spec.key ? [spec.key] : [])

  const codeMatch = codes.length > 0 && codes.includes(e.code)
  const keyMatch =
    keys.length > 0 &&
    keys.some((k) => e.key === k || e.key.toLowerCase() === k.toLowerCase())

  if (!codeMatch && !keyMatch) return false
  return modifiersMatch(e, spec)
}

/** Глобальные горячие клавиши — монтируются на уровне страницы */
export function useHotkeys() {
  const addNode = useStore((s) => s.addNode)
  const undo = useStore((s) => s.undo)
  const duplicateSelected = useStore((s) => s.duplicateSelected)
  const deleteSelected = useStore((s) => s.deleteSelected)
  const copySelected = useStore((s) => s.copySelected)
  const pasteClipboard = useStore((s) => s.pasteClipboard)
  const path = useStore((s) => s.path)

  useEffect(() => {
    const cfg =
      (typeof window !== "undefined" &&
        (window as Window & { HOTKEYS_CONFIG?: typeof FALLBACK_CONFIG }).HOTKEYS_CONFIG) ??
      FALLBACK_CONFIG

    const spawn = (type: "RECTANGLE" | "SPACE" | "SQUARE") => {
      const jitter = (Math.random() * 80 - 40) | 0
      addNode(type, { x: 180 + jitter, y: 160 + jitter }, path.length ? path[path.length - 1] : null)
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (isEditableTarget(e.target, e)) return
      if (e.repeat) return

      const canvas = getCanvasHandlers()

      // Ctrl+Z / Cmd+Z — стандартный undo
      if ((e.ctrlKey || e.metaKey) && e.code === "KeyZ" && !e.shiftKey) {
        e.preventDefault()
        e.stopPropagation()
        undo()
        return
      }

      if (matchHotkey(e, cfg.createRectangle as HotkeySpec)) {
        e.preventDefault()
        e.stopPropagation()
        spawn("RECTANGLE")
        return
      }
      if (matchHotkey(e, cfg.createSpace as HotkeySpec)) {
        e.preventDefault()
        e.stopPropagation()
        spawn("SPACE")
        return
      }
      if (matchHotkey(e, cfg.createSquare as HotkeySpec)) {
        e.preventDefault()
        e.stopPropagation()
        spawn("SQUARE")
        return
      }
      if (matchHotkey(e, cfg.undo as HotkeySpec)) {
        e.preventDefault()
        e.stopPropagation()
        undo()
        return
      }
      if (matchHotkey(e, cfg.duplicate as HotkeySpec)) {
        e.preventDefault()
        e.stopPropagation()
        duplicateSelected()
        return
      }
      if (matchHotkey(e, cfg.delete as HotkeySpec)) {
        e.preventDefault()
        e.stopPropagation()
        deleteSelected()
        return
      }
      if (matchHotkey(e, cfg.copy as HotkeySpec)) {
        e.preventDefault()
        e.stopPropagation()
        copySelected()
        return
      }
      if (matchHotkey(e, cfg.paste as HotkeySpec)) {
        e.preventDefault()
        e.stopPropagation()
        pasteClipboard()
        return
      }
      if (matchHotkey(e, cfg.zoomIn as HotkeySpec)) {
        e.preventDefault()
        e.stopPropagation()
        canvas?.zoomIn()
        return
      }
      if (matchHotkey(e, cfg.zoomOut as HotkeySpec)) {
        e.preventDefault()
        e.stopPropagation()
        canvas?.zoomOut()
        return
      }
      if (matchHotkey(e, cfg.zoomReset as HotkeySpec)) {
        e.preventDefault()
        e.stopPropagation()
        canvas?.zoomReset()
        return
      }
    }

    window.addEventListener("keydown", onKeyDown, true)
    return () => window.removeEventListener("keydown", onKeyDown, true)
  }, [
    addNode,
    undo,
    duplicateSelected,
    deleteSelected,
    copySelected,
    pasteClipboard,
    path,
  ])
}
