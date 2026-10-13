import { Check, Home, Link2, Settings2, Users } from "lucide-react"
import { FamilyStandings } from "@/components/progression"
import { MultiplyLogo } from "@/components/multiply-logo"
import { sampleStandings } from "./preview-parts"
import styles from "./landing.module.css"

export function FamilyShowcase() {
  return <section id="family" className={styles.family} aria-labelledby="family-heading"><div className={styles.container}>
    <div className={styles.sectionHeading}><p className={styles.eyebrow}>The whole family, in the loop.</p><h2 id="family-heading">Made for kids.{" "}<br />Helpful for parents.</h2></div>
    <div className={styles.familyLayout}>
      <div className={styles.familyDashboard} aria-label="Sample family progress dashboard"><div className={styles.dashboardHeader}><MultiplyLogo /><span><Settings2 size={19} /> Parent view</span></div><h3>Your family’s progress</h3><FamilyStandings standings={sampleStandings} data={undefined} activePlayer={undefined} /><p className={styles.visualNote}>Lifetime XP sets the rank. Mastery sets the level.</p><p className={styles.sampleNote}>Sample family · Learning history and earned XP stay saved.</p></div>
      <div className={styles.parentTiles}>
        <article className={styles.sky}><Users size={21} /><h3>One family. Multiple players.</h3><div className={styles.avatarRow}><span>E</span><span>J</span><span>J</span></div></article>
        <article className={styles.peach}><Settings2 size={21} /><h3>Set their learning range.</h3><div className={styles.assignment}><b>Joseph</b><span>Tables 1–4</span><Check size={16} /></div></article>
        <article className={styles.mint}><Check size={21} /><h3>Progress that stays saved.</h3><div className={styles.savedProgress}><b>1,250 XP</b><span>45 / 100 facts mastered</span><span>Level 3 · Builder</span></div></article>
        <article className={styles.lavender}><Users size={21} /><h3>Share progress with another parent.</h3><div className={styles.sharedParents}><span>P</span><Link2 size={18} /><span>P</span><small>One family. Two parents.</small></div></article>
        <article className={styles.homeTile}><div className={styles.homeScreen} aria-label="Multiply web app icon on a phone home screen"><span /><div><img src="/icons/icon-192.png?v=3" alt="Multiply! home-screen icon" width={44} height={44} /><small>Multiply!</small></div></div><div><Home size={21} /><h3>Ready on their phone.</h3><p>Add the web app to their home screen.</p></div></article>
      </div>
    </div>
  </div></section>
}
