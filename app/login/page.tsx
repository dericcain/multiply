import type { Metadata } from "next"
import { MultiplyAppClient } from "@/components/multiply-app-client"

export const metadata: Metadata = { title: "Sign in · Multiply!", robots: { index: false, follow: false } }

export default function LoginPage() {
  return <MultiplyAppClient />
}
