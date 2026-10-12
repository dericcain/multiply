"use client"

import { useEffect, useState } from "react"
import { useFeatureFlags } from "@/components/feature-flags"
import { Button } from "@/components/ui/button"
import { installationManifestUrl } from "@/lib/pwa-manifest"

interface InstallEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>
}

export function Pwa() {
  const { childPracticeLinks } = useFeatureFlags()
  const [installEvent, setInstallEvent] = useState<InstallEvent | null>(null)
  const [showIosHelp, setShowIosHelp] = useState(false)
  const [practiceInstallBlocked, setPracticeInstallBlocked] = useState(false)
  const [playerInstall, setPlayerInstall] = useState(false)

  useEffect(() => {
    let revision = 0
    const updateManifest = async () => {
      const current = ++revision
      setInstallEvent(null)
      setPracticeInstallBlocked(!childPracticeLinks && new URLSearchParams(window.location.hash.slice(1)).has("play"))
      try {
        const href = childPracticeLinks ? await installationManifestUrl(window.location.href) : "/manifest.webmanifest"
        if (current !== revision) return
        const link = document.querySelector<HTMLLinkElement>('link[rel="manifest"]')
        if (link) link.href = href
        setPlayerInstall(href !== "/manifest.webmanifest")
      } catch (error) {
        console.error("Could not prepare home screen installation", error)
      }
    }
    void updateManifest()
    window.addEventListener("hashchange", updateManifest)
    return () => {
      revision++
      window.removeEventListener("hashchange", updateManifest)
    }
  }, [childPracticeLinks])

  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js", { updateViaCache: "none" })
        .catch(error => console.error("Could not register offline support", error))
    }

    const standalone = window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone
    if (standalone) return

    setShowIosHelp(/iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1))
    const offerInstall = (event: Event) => {
      event.preventDefault()
      setInstallEvent(event as InstallEvent)
    }
    const installed = () => {
      setInstallEvent(null)
      setShowIosHelp(false)
    }
    window.addEventListener("beforeinstallprompt", offerInstall)
    window.addEventListener("appinstalled", installed)
    return () => {
      window.removeEventListener("beforeinstallprompt", offerInstall)
      window.removeEventListener("appinstalled", installed)
    }
  }, [])

  async function install() {
    if (!installEvent) return
    await installEvent.prompt()
    await installEvent.userChoice
    setInstallEvent(null)
  }

  if (practiceInstallBlocked || (!installEvent && !showIosHelp)) return null

  return (
    <aside aria-label="Install Multiply!" className="mx-auto max-w-xl bg-background px-4 pb-6 text-center">
      {installEvent ? (
        <Button variant="secondary" className="rounded-2xl" onClick={install}>Install Multiply!</Button>
      ) : (
        <p className="text-sm text-muted-foreground">To install Multiply!, tap Share, then Add to Home Screen.{playerInstall && " Save from this practice link to open your player without a login."}</p>
      )}
    </aside>
  )
}
