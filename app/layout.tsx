import type { Metadata, Viewport } from "next"
import { connection } from "next/server"
import { VercelToolbar } from "@vercel/toolbar/next"
import { evaluate } from "flags/next"
import { childPracticeLinks, practiceLinkShowcase, landingPage } from "@/lib/flags"
import { FeatureFlagsProvider } from "@/components/feature-flags"
import "./globals.css"
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";
import { Pwa } from "@/components/pwa";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

export const metadata: Metadata = {
  title: "Multiply!",
  description: "A friendly multiplication practice game for the whole family.",
  applicationName: "Multiply!",
  appleWebApp: { capable: true, title: "Multiply!", statusBarStyle: "default" },
  icons: {
    icon: [{ url: "/icons/icon-32.png?v=3", sizes: "32x32", type: "image/png" }],
    apple: [{ url: "/icons/icon-512.png?v=3", sizes: "512x512", type: "image/png" }],
  },
}

export const viewport: Viewport = { themeColor: "#5c55d5", width: "device-width", initialScale: 1 }

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  await connection()
  const flags = await evaluate({ childPracticeLinks, practiceLinkShowcase, landingPage })
  return <html lang="en" className={cn("font-sans", geist.variable)}><body><FeatureFlagsProvider flags={flags}>{children}<Pwa /></FeatureFlagsProvider>{process.env.NODE_ENV === "development" && <VercelToolbar />}</body></html>
}
