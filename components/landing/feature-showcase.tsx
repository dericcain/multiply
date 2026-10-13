import { Check } from "lucide-react"
import { Progress } from "@/components/ui/progress"
import { StreakBadge } from "@/components/streak-badge"
import { MasteryBadge } from "@/components/mastery-badge"
import { DurationPreview } from "./preview-parts"
import styles from "./landing.module.css"

function FeatureCard({ title, className, children }: { title: string; className: string; children: React.ReactNode }) {
  return <article className={`${styles.featureCard} ${className}`}><h3>{title}</h3><div className={styles.featureVisual}>{children}</div></article>
}

export function FeatureShowcase() {
  return <section id="features" className={styles.features} aria-labelledby="features-heading"><div className={styles.container}>
    <div className={styles.sectionHeading}><h2 id="features-heading">Big fun. Real progress.</h2></div>
    <div className={styles.featureGrid}>
      <FeatureCard title="Pick it or type it." className={styles.sky}>
        <div className={styles.answerMethods}><div><b>3 × 4 = ?</b><div className={styles.miniAnswers}>{[7, 12, 16, 24].map(n => <span key={n} className={n === 12 ? styles.chosen : ""}>{n}{n === 12 && <Check size={12} />}</span>)}</div><small>Pick an answer</small></div><div><b>3 × 4 = ?</b><div className={styles.fakeInput}>12</div><small>Type an answer</small></div></div>
        <p className={styles.bonusSummary}><strong>+5 bonus XP</strong><br />Finish a typed challenge with at least 80% correct.</p>
      </FeatureCard>
      <FeatureCard title="Their tables. Their pace." className={styles.peach}>
        <p className={styles.featureCopy}>Practice tables from 1 to 15.</p>
        <div className={styles.tableGrid}>{Array.from({ length: 15 }, (_, i) => <span key={i} className={i === 5 ? styles.tableSelected : ""}>{i + 1}</span>)}</div>
        <div className={styles.rangePreview}><b>Multipliers up to 10</b><div className={styles.staticSlider} aria-hidden="true"><span /></div><p>6 × 1 <span>→</span> 6 × 10</p></div>
        <p className={styles.visualNote}>Parents set each child’s available range.</p>
        <div className={styles.timerPreview}><DurationPreview /></div>
      </FeatureCard>
      <FeatureCard title="Learn it. Master it." className={styles.mint}>
        <div className={styles.masteryPreview}>
          <div className={styles.badgeSpotlight}><MasteryBadge level={{ number: 3, name: "Builder" }} size={88} /><span>Level 3 · Builder</span></div>
          <b>25<span> / 100</span></b><p>facts mastered</p><Progress value={25} aria-label="Sample progress: 25 of 100 facts mastered" />
          <small>Accuracy over multiple responses builds mastery.</small>
        </div>
        <p className={styles.visualNote}>+1 XP per correct answer · +25 XP when a fact is first mastered.</p>
        <div className={styles.growthStreak}><StreakBadge streak={{ current: 5, best: 8 }} /></div>
      </FeatureCard>
      <FeatureCard title="Know what to practice next." className={styles.lavender}>
        <div className={styles.review}><p>Nice work!</p><b>8 <span>of 10 correct</span></b><div><strong>Try these again next round</strong><span>6 × 7 = 42</span><span>8 × 9 = 72</span></div></div>
      </FeatureCard>
    </div>
  </div></section>
}
