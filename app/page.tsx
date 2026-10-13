import type { Metadata } from "next"
import { evaluate } from "flags/next"
import { landingPage, practiceLinkShowcase, childPracticeLinks } from "@/lib/flags"
import { LandingEntry } from "@/components/landing/landing-entry"
import { LandingPage } from "@/components/landing/landing-page"

export async function generateMetadata(): Promise<Metadata> {
  if (!await landingPage()) return { title: "Multiply!" }
  const title = "Multiply! — Fun Multiplication Practice for Kids"
  const description = "Make times tables fun with Multiply! Practice multiplication, earn XP, master facts, and track progress with the whole family."
  return {
    title, description,
    alternates: { canonical: "https://playmultiply.com" },
    openGraph: { title, description, type: "website", url: "https://playmultiply.com", siteName: "Multiply!", images: [{ url: "https://playmultiply.com/social-preview.png", width: 1200, height: 630, alt: "Multiply! Times tables. Game on. A sample 3 × 4 practice question." }] },
    twitter: { card: "summary_large_image", title, description, images: ["https://playmultiply.com/social-preview.png"] },
  }
}

export default async function Page() {
  const enabled = await landingPage()
  const [showcase, childLinks] = enabled ? await evaluate([practiceLinkShowcase, childPracticeLinks]) : [false, false]
  return <LandingEntry enabled={enabled}>{enabled && <LandingPage showPracticeLinks={showcase && childLinks} />}</LandingEntry>
}
