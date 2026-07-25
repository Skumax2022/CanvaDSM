"use client"

import { Suspense } from "react"
import { Boxes } from "lucide-react"
import { BreadcrumbNav } from "./breadcrumb-nav"
import { ViewSwitcher } from "./view-switcher"
import { FileIO } from "./file-io"

export function Header() {
  return (
    <header className="z-30 flex flex-wrap items-center gap-3 border-b border-border bg-background/90 px-3 py-2 backdrop-blur-md">
      <div className="flex min-w-0 items-center gap-2">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-foreground/[0.08] text-foreground">
          <Boxes className="size-5" aria-hidden />
        </div>
        <BreadcrumbNav />
      </div>

      <div className="order-3 flex w-full items-center justify-center md:order-none md:w-auto md:flex-1">
        <ViewSwitcher />
      </div>

      <div className="ml-auto flex items-center">
        <Suspense fallback={null}>
          <FileIO />
        </Suspense>
      </div>
    </header>
  )
}
