import type { RectKind } from "./types"

export const RECT_KIND_META: Record<
  RectKind,
  {
    label: string
    bg: string
    border: string
    accent: string
    text: string
    dsmColor: string
    cssKind: string
  }
> = {
  DEFAULT: {
    label: "Базовый",
    bg: "bg-card",
    border: "border-border",
    accent: "text-foreground",
    text: "text-foreground",
    dsmColor: "text-foreground/80",
    cssKind: "",
  },
  FUNCTION: {
    label: "Функция",
    bg: "bg-violet-500/15",
    border: "border-violet-400/55",
    accent: "text-violet-300",
    text: "text-violet-100",
    dsmColor: "text-violet-400",
    cssKind: "kind-function",
  },
  NUMBER: {
    label: "Число",
    bg: "bg-emerald-500/15",
    border: "border-emerald-400/55",
    accent: "text-emerald-300",
    text: "text-emerald-100",
    dsmColor: "text-emerald-400",
    cssKind: "kind-number",
  },
  OBJECT: {
    label: "Объект",
    bg: "bg-orange-500/15",
    border: "border-orange-400/55",
    accent: "text-orange-300",
    text: "text-orange-100",
    dsmColor: "text-orange-400",
    cssKind: "kind-object",
  },
}

export const RECT_KINDS: RectKind[] = ["DEFAULT", "FUNCTION", "NUMBER", "OBJECT"]
