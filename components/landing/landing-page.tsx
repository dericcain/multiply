import { ArrowDown, ArrowRight } from "lucide-react"
import { MultiplyLogo } from "@/components/multiply-logo"
import { Button } from "@/components/ui/button"
import { PracticeLinkShowcase } from "@/components/practice-link-showcase"
import { InteractiveDemo } from "./interactive-demo"
import { HowItWorks } from "./how-it-works"
import { FeatureShowcase } from "./feature-showcase"
import { FamilyShowcase } from "./family-showcase"
import styles from "./landing.module.css"

const startUrl = "/play?signup=1"

export function LandingPage({ showPracticeLinks }: { showPracticeLinks: boolean }) {
  return <div className={styles.landing}>
    <a href="#main" className={styles.skipLink}>Skip to content</a>
    <header className={styles.header}><nav className={styles.nav} aria-label="Main navigation"><a href="/" aria-label="Multiply home"><MultiplyLogo /></a><div><a className={styles.howLink} href="#how-it-works">How it works</a><a className={styles.signInLink} href="/login">Sign in</a><Button asChild className={styles.headerCta}><a href={startUrl}>Start playing <ArrowRight size={16} /></a></Button></div></nav></header>
    <main id="main">
      <section className={styles.hero} aria-labelledby="hero-heading"><div className={`${styles.container} ${styles.heroLayout}`}>
        <div className={styles.heroCopy}><h1 id="hero-heading">Times tables.{" "}<br /><span>Game on.</span></h1><p className={styles.heroSubtitle}>Fun multiplication practice for kids.<br className={styles.desktopBreak} /> Progress parents can see.</p><div className={styles.heroActions}><Button asChild className={styles.primaryCta}><a href={startUrl}>Start playing <ArrowRight size={20} /></a></Button><a href="#how-it-works" className={styles.secondaryCta}>See how it works <ArrowDown size={16} /></a></div></div>
        <InteractiveDemo />
      </div></section>
      <HowItWorks />
      {showPracticeLinks && <PracticeLinkShowcase />}
      <FeatureShowcase />
      <FamilyShowcase />
      <section className={styles.finalCta} aria-labelledby="cta-heading"><span className={styles.decorativeTimes} aria-hidden="true">×</span><div><h2 id="cta-heading">Ready to multiply?</h2><p>Create your family and start playing.</p><Button asChild className={styles.finalButton}><a href={startUrl}>Start playing <ArrowRight size={20} /></a></Button></div><span className={styles.decorativeStar} aria-hidden="true">✦</span></section>
    </main>
    <footer className={styles.footer}><div className={styles.container}><div><MultiplyLogo /><p>A friendly multiplication game for the whole family.</p></div><nav aria-label="Footer navigation"><a href="/login">Sign in</a><a href={startUrl}>Start playing <ArrowRight size={15} /></a></nav><small>© {new Date().getFullYear()} Multiply!</small></div></footer>
  </div>
}
