/** Зеркало hotkeys.config.js — code = физическая клавиша (работает на любой раскладке) */
export const HOTKEYS_CONFIG = {
  createRectangle: { key: "r", code: "KeyR" },
  createSpace: { key: "e", code: "KeyE" },
  createSquare: { key: "f", code: "KeyF" },
  undo: { key: "z", code: "KeyZ", ctrl: false },
  duplicate: { key: " ", code: "Space" },
  delete: { keys: ["Delete", "Backspace"], codes: ["Delete", "Backspace"] },
  copy: { key: "c", code: "KeyC", ctrl: true },
  paste: { key: "v", code: "KeyV", ctrl: true },
  zoomIn: { keys: ["+", "="], codes: ["Equal", "NumpadAdd"] },
  zoomOut: { key: "-", codes: ["Minus", "NumpadSubtract"] },
  zoomReset: { key: "0", code: "Digit0" },
  marqueeSelect: { shift: true, drag: true },
} as const

export type HotkeySpec = {
  key?: string
  keys?: string[]
  code?: string
  codes?: string[]
  ctrl?: boolean
  shift?: boolean
  alt?: boolean
  drag?: boolean
}
