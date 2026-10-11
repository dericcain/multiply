import type { Metadata, Viewport } from "next"
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
    icon: [{ url: "/icons/icon-32.png?v=2", sizes: "32x32", type: "image/png" }],
    apple: [{ url: "/icons/icon-180.png?v=2", sizes: "180x180", type: "image/png" }],
  },
}

export const viewport: Viewport = { themeColor: "#5c55d5", width: "device-width", initialScale: 1 }

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" className={cn("font-sans", geist.variable)}><body>{children}<Pwa /></body></html>
}
