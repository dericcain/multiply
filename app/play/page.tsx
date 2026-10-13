import type { Metadata } from "next"
import { MultiplyAppClient } from "@/components/multiply-app-client"

export const metadata: Metadata = {
  title: "Play Multiply!",
  description: "Practice your times tables, earn XP, and see your family’s progress.",
  robots: { index: false, follow: false },
}

export default function PlayPage() {
  return <MultiplyAppClient />
}
