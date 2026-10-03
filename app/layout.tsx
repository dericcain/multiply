import type { Metadata, Viewport } from "next"
import "./globals.css"
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

export const metadata: Metadata = {
  title: "Multiply!",
  description: "A friendly multiplication practice game for the whole family.",
}

export const viewport: Viewport = { themeColor: "#5b5ce2", width: "device-width", initialScale: 1 }

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" className={cn("font-sans", geist.variable)}><body>{children}</body></html>
}
