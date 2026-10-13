import { Check, Star, Trophy } from "lucide-react"
import { Progress } from "@/components/ui/progress"
import { StreakBadge } from "@/components/streak-badge"
import { ActivityCards, DurationPreview } from "./preview-parts"
import styles from "./landing.module.css"

function FeatureCard({ title, className = "", children, copy }: { title: string; className?: string; children: React.ReactNode; copy?: string }) {
  return <article className={`${styles.featureCard} ${className}`}><h3>{title}</h3>{copy && <p className={styles.featureCopy}>{copy}</p>}<div className={styles.featureVisual}>{children}</div></article>
}

export function FeatureShowcase() {
  return <section id="features" className={styles.features} aria-labelledby="features-heading"><div className={styles.container}>
    <div className={styles.sectionHeading}><p className={styles.eyebrow}>A game with growing room.</p><h2 id="features-heading">Big fun. Real progress.</h2></div>
    <div className={styles.featureGrid}>
      <FeatureCard title="Two ways to play." className={`${styles.wide} ${styles.lavender}`}><ActivityCards detailed /><p className={styles.visualNote}>Both games build learning progress.</p></FeatureCard>
      <FeatureCard title="Pick it or type it." className={styles.sky}><div className={styles.answerMethods}><div><b>3 × 4 = ?</b><div className={styles.miniAnswers}>{[7, 12, 16, 24].map(n => <span key={n} className={n === 12 ? styles.chosen : ""}>{n}{n === 12 && <Check size={12} />}</span>)}</div><small>Pick an answer</small></div><div><b>3 × 4 = ?</b><div className={styles.fakeInput}>12<span aria-hidden="true">│</span></div><span className={styles.checkAnswer}>Check answer</span><small>Type an answer</small></div></div></FeatureCard>
      <FeatureCard title="Their tables. Their pace." className={`${styles.wide} ${styles.peach}`} copy="Practice tables from 1 to 15."><div className={styles.tableGrid}>{Array.from({ length: 15 }, (_, i) => <span key={i} className={i === 5 ? styles.tableSelected : ""}>{i + 1}</span>)}</div><div className={styles.rangePreview}><b>Multipliers up to 10</b><div className={styles.staticSlider} aria-hidden="true"><span /></div><p>6 × 1 <span>→</span> 6 × 10</p></div><p className={styles.visualNote}>Parents set each child’s available range.</p></FeatureCard>
      <FeatureCard title="Every answer counts." className={styles.sunshine}><div className={styles.reward}><span><Check size={17} /> Correct! +1 XP</span><div><Star size={26} /><b>+25 XP</b><small>First mastery reward</small></div></div></FeatureCard>
      <FeatureCard title="Learn it. Master it." className={styles.mint}><div className={styles.masteryPreview}><span>Level 3 · Builder</span><b>25<span> / 100</span></b><p>facts mastered</p><Progress value={25} aria-label="Sample progress: 25 of 100 facts mastered" /><small>Starter → Explorer → Builder → Expert → Math Genius</small></div><p className={styles.visualNote}>Accuracy over multiple responses builds mastery.</p></FeatureCard>
      <FeatureCard title="Keep the streak going!" className={styles.peach}><StreakBadge streak={{ current: 5, best: 8 }} /><div className={styles.streakFacts}>{["3 × 4", "6 × 2", "4 × 5", "7 × 3", "8 × 2"].map(fact => <span key={fact}><Check size={12} /> {fact}</span>)}</div></FeatureCard>
      <FeatureCard title="Know what to practice next." className={styles.sky}><div className={styles.review}><p>Nice work!</p><b>8 <span>of 10 correct</span></b><div><strong>Try these again next round</strong><span>6 × 7 = 42</span><span>8 × 9 = 72</span></div></div></FeatureCard>
      <FeatureCard title="Play at your pace." className={styles.lavender}><DurationPreview /></FeatureCard>
      <FeatureCard title="Type it. Earn more." className={`${styles.wide} ${styles.bonus}`}><div><span className={styles.bonusIcon}><Trophy size={25} /></span><div><b>Typed challenge complete!</b><p>8 of 10 correct · <strong>+5 bonus XP</strong></p></div></div><p className={styles.visualNote}>Finish a typed challenge with at least 80% correct.</p></FeatureCard>
    </div>
  </div></section>
}
