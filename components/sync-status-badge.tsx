"use client"

import { AlertCircle, CheckCircle2, CloudOff, Download, Loader2, RotateCcw } from "lucide-react"
import { cn } from "@/lib/utils"
import type { StorageStatus } from "@/lib/storage/types"

interface SyncStatusBadgeProps {
  status: StorageStatus
  lastSaved: Date | null
  error?: string | null
  onRetry?: () => void
  onDownloadLocal?: () => void
}

function formatTime(date: Date | null): string {
  if (!date) return ""
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
}

export function SyncStatusBadge({ status, lastSaved, error, onRetry, onDownloadLocal }: SyncStatusBadgeProps) {
  const base =
    "inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-medium transition-colors"

  if (status === "saving") {
    return (
      <span className={cn(base, "border-amber-500/30 bg-amber-500/10 text-amber-500")} aria-live="polite">
        <Loader2 className="size-3.5 animate-spin" aria-hidden />
        <span className="hidden sm:inline">Saving…</span>
      </span>
    )
  }

  if (status === "saved") {
    const label = lastSaved ? `Saved at ${formatTime(lastSaved)}` : "Saved"
    return (
      <span
        className={cn(base, "border-emerald-500/30 bg-emerald-500/10 text-emerald-500")}
        title={label}
        aria-live="polite"
      >
        <CheckCircle2 className="size-3.5" aria-hidden />
        <span className="hidden sm:inline">{label}</span>
        <span className="sm:hidden sr-only">{label}</span>
      </span>
    )
  }

  if (status === "error" || status === "offline") {
    const Icon = status === "offline" ? CloudOff : AlertCircle
    return (
      <span className="inline-flex items-center gap-1" aria-live="assertive">
        <span
          className={cn(base, "border-red-500/30 bg-red-500/10 text-red-500")}
          title={error ?? (status === "offline" ? "Offline" : "Sync error")}
        >
          <Icon className="size-3.5" aria-hidden />
          <span className="hidden sm:inline">{status === "offline" ? "Offline" : "Error"}</span>
        </span>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            title="Retry sync"
            className="flex items-center gap-1 rounded-md border border-border bg-card px-1.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <RotateCcw className="size-3.5" aria-hidden />
            <span className="hidden md:inline">Retry</span>
          </button>
        )}
        {onDownloadLocal && (
          <button
            type="button"
            onClick={onDownloadLocal}
            title="Download a local copy"
            className="flex items-center gap-1 rounded-md border border-border bg-card px-1.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <Download className="size-3.5" aria-hidden />
            <span className="hidden md:inline">Download</span>
          </button>
        )}
      </span>
    )
  }

  // idle
  return (
    <span className={cn(base, "border-border bg-card text-muted-foreground")}>
      <CheckCircle2 className="size-3.5 opacity-50" aria-hidden />
      <span className="hidden sm:inline">Not synced</span>
    </span>
  )
}
