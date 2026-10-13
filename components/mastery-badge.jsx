"use client"

import { Check, LockKeyhole } from "lucide-react"
import { useFeatureFlags } from "@/components/feature-flags"
import { MASTERY_LEVELS } from "@/lib/progression"
import styles from "./mastery-badge.module.css"

const assets = ["starter", "explorer", "builder", "expert", "math-genius"]

export function MasteryBadge({ level, size = 56, className = "" }) {
  const { masteryBadges } = useFeatureFlags()
  if (!masteryBadges) return null
  const name = assets[level.number - 1]
  return <img src={`/badges/${name}.svg`} width={size} height={size} alt={`${level.name} badge`} className={`${styles.badge} ${className}`} />
}

export function BadgeJourney({ progress }) {
  const { masteryBadges } = useFeatureFlags()
  if (!masteryBadges) return null
  const level = progress.level
  return <div className={`${styles.journey} ${level.number === 5 ? styles.genius : ""}`}>
    <div className={styles.hero}>
      <div className={styles.spotlight}><MasteryBadge level={level} size={100} /></div>
      <div className={styles.copy}>
        <p className={styles.eyebrow}>YOUR MASTERY BADGE · LEVEL {level.number}</p>
        <h2 className={styles.name}>{level.name}</h2>
        <p className={styles.goal}>{!progress.total ? "Your adventure starts here!" : progress.nextLevel ? `${progress.factsToNextLevel} more ${progress.factsToNextLevel === 1 ? "fact" : "facts"} to ${progress.nextLevel.name}` : "Every assigned fact mastered. Legendary!"}</p>
      </div>
    </div>
    <details className={styles.collection}>
      <summary>See all five badges <span className={styles.summaryHint}>{level.number} of 5 unlocked</span></summary>
      <ol className={styles.shelf}>{MASTERY_LEVELS.map(badge => {
        const unlocked = badge.number <= level.number
        const current = badge.number === level.number
        return <li key={badge.number} className={`${styles.tile} ${current ? styles.current : ""}`}>
          <div className={unlocked ? "" : styles.locked}><MasteryBadge level={badge} size={64} /></div>
          <span className={styles.tileName}>{badge.name}</span>
          <span className={styles.status}>{unlocked ? <Check size={12} aria-hidden="true" /> : <LockKeyhole size={12} aria-hidden="true" />}{current ? "Current" : unlocked ? "Unlocked" : `${badge.percent}%`}</span>
        </li>
      })}</ol>
      <p className={styles.explanation}>Badges follow mastery of your assigned tables. Your saved progress already counts.</p>
    </details>
  </div>
}
