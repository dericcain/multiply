"use client"

import { useEffect, useState } from "react"
import { legacyAppTarget } from "@/lib/app-entry"
import { MultiplyAppClient } from "@/components/multiply-app-client"

export function LandingEntry({ enabled, children }: { enabled: boolean; children: React.ReactNode }) {
  const [checked, setChecked] = useState(false)
  useEffect(() => {
    const check = () => {
      const standalone = window.matchMedia("(display-mode: standalone)").matches ||
        !!(navigator as Navigator & { standalone?: boolean }).standalone
      const target = legacyAppTarget(window.location.href, standalone)
      if (target) { window.location.replace(target); return }
      setChecked(true)
    }
    check()
    window.addEventListener("hashchange", check)
    return () => window.removeEventListener("hashchange", check)
  }, [])
  if (enabled) return children
  return checked ? <MultiplyAppClient /> : <main className="mx-auto max-w-xl px-4 py-20 text-center">Loading…</main>
}
