import { Check, Star } from "lucide-react"
import { Progress } from "@/components/ui/progress"
import { PlayerCards, ActivityCards } from "./preview-parts"
import styles from "./landing.module.css"

export function HowItWorks() {
  return <section id="how-it-works" className={styles.how} aria-labelledby="how-heading"><div className={styles.container}>
    <div className={styles.sectionHeading}><p className={styles.eyebrow}>Small steps. Big smiles.</p><h2 id="how-heading">Ready. Set. Multiply!</h2></div>
    <div className={styles.steps}>
      <article><div className={styles.stepHeading}><span>1</span><h3>Pick your player.</h3></div><div className={styles.stepPreview}><PlayerCards /></div></article>
      <article><div className={styles.stepHeading}><span>2</span><h3>Choose your game.</h3></div><div className={styles.stepPreview}><ActivityCards /></div></article>
      <article><div className={styles.stepHeading}><span>3</span><h3>Watch them grow.</h3></div><div className={styles.stepPreview}><div className={styles.miniResults}><span><Star size={19} /> Nice work!</span><b>+35 XP</b><small>10 answer XP + 25 first mastery XP</small><p><Check size={16} /> 3 × 4 = 12 · Mastered!</p><Progress value={26} aria-label="Sample mastery: 26 of 100 facts" /><small>26 / 100 facts mastered</small></div></div></article>
    </div><p className={styles.sectionNote}>Sample screens throughout. Real progress belongs to your family.</p>
  </div></section>
}
