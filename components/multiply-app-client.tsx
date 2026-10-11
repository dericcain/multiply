"use client"

import dynamic from "next/dynamic"

const MultiplyApp = dynamic(
  () => import("@/components/multiply-app").then(module => module.MultiplyApp),
  {
    ssr: false,
    loading: () => <main className="mx-auto min-h-dvh max-w-xl bg-background px-4 pb-9"><div className="py-20 text-center text-muted-foreground">Loading…</div></main>,
  }
)

export function MultiplyAppClient() {
  return <MultiplyApp />
}
