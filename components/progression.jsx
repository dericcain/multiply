"use client"

import { useEffect, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { familyStandings, rankStandings } from "@/lib/progression"
import { useFeatureFlags } from "@/components/feature-flags"
import { BadgeJourney, MasteryBadge } from "@/components/mastery-badge"
import styles from "./progression.module.css"

export function Journey({ progress, nextStat }) {
  const { masteryBadges } = useFeatureFlags()
  const total = progress.total ?? 0, count = progress.count
  const percentage = total ? count / total * 100 : 0
  return <Card className="mt-4 border-primary/20 bg-primary/5"><CardContent className="p-4"><BadgeJourney progress={progress} /><div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-black">{masteryBadges ? "Your assigned tables" : `Level ${progress.level.number} · ${progress.level.name}`}</h2><b>{progress.hasEvidence ? `${Math.round(percentage)}% mastered` : "Getting started"}</b></div><Progress className="mt-3 h-3" value={percentage} aria-label={`${count} of ${total} assigned facts mastered`} /><p className="mt-2 text-sm font-semibold">{total ? `${count} / ${total} assigned facts mastered` : "Ask a parent to assign your tables."}</p><p className="mt-1 text-sm">{count === total && total ? "Finish line reached! Review your tables, or ask a parent for your next goal." : `Next goal: ${progress.nextTarget ? `master ${progress.nextTarget.label}` : "master one more fact"}.`}</p>{nextStat && <p className="mt-2 text-sm">Next fact: {Math.min(nextStat.recent?.length ?? 0, 5)}/5 responses recorded · {nextStat.recent?.length ? Math.round(nextStat.recent.filter(Boolean).length / nextStat.recent.length * 100) : 0}% correct in recent responses. Mastery needs at least 80%.</p>}</CardContent></Card>
}

export function FamilyStandings({ data, standings, activePlayer }) {
  const rows = standings ? rankStandings(standings) : familyStandings(data)
  if (!rows.length) return <p className="mt-4 text-sm">Add a player to start earning XP.</p>
  return <Card className="mt-5"><CardContent className="p-4">
    <h2 className="text-xl font-black">🏆 Family leaderboard</h2>
    <p className="mt-1 text-sm">Earn XP to take the lead. Master facts to level up.</p>
    <ol className="mt-3 space-y-3">{rows.map(row => {
      const tied = rows.filter(other => other.rank === row.rank).length > 1
      const leading = rows.length > 1 && row.rank === 1 && row.xp > 0
      return <li key={row.player.id} className={`rounded-xl border p-3 ${row.player.id === activePlayer ? "border-primary bg-primary/10" : "bg-muted/50"}`}>
        <div className="flex items-center gap-2">
          <b className="min-w-8 text-primary">#{row.rank}</b>
          <MasteryBadge level={row.level} size={48} />
          <div className="min-w-0 flex-1">
            <b className="block break-words">{row.player.name}{row.player.id === activePlayer ? " (you)" : ""}</b>
            <span className="text-xs font-semibold">Level {row.level.number} · {row.level.name}</span>
            {leading && <span className="mt-1 block text-xs font-bold text-primary">{tied ? "Tied for the lead" : "In the lead"}</span>}
            {tied && !leading && <span className="block text-xs text-muted-foreground">Shared rank</span>}
          </div>
          <b className="shrink-0 text-right text-xl">{row.xp.toLocaleString()}<span className="block text-xs font-semibold">XP</span></b>
        </div>
        <div className="mt-3 flex justify-between gap-2 text-xs font-semibold"><span>{row.count}/{row.total} facts mastered</span><span>{Number((row.masteryPercent ?? 0).toFixed(1))}%</span></div>
        <Progress className="mt-1 h-2" value={row.progress} aria-label={`${row.player.name}: ${row.count} of ${row.total} assigned facts mastered`} />
        <p className="mt-2 text-xs text-muted-foreground">{!row.total ? "Ask a parent to assign your tables." : row.nextLevel ? `${row.factsToNextLevel} more ${row.factsToNextLevel === 1 ? "fact" : "facts"} to ${row.nextLevel.name}` : "All assigned facts mastered!"}</p>
        {row.scope && <details className="mt-2 text-sm"><summary className="min-h-8 cursor-pointer font-semibold">View assigned tables</summary><p className="mt-1">1–{row.scope.maxTable} × 1–{row.scope.maxMultiplier}</p></details>}
      </li>
    })}</ol>
  </CardContent></Card>
}

export function MasteryCelebration({ reward }) {
  const [confetti, setConfetti] = useState(true)
  useEffect(() => { setConfetti(true); const timer = setTimeout(() => setConfetti(false), 3000); return () => clearTimeout(timer) }, [reward.sessionId])
  const earned = reward.masteredFacts || [], equations = earned.map(fact => fact.replace("x", " × "))
  return <>{earned.length > 0 && confetti && <div className={styles.confetti} aria-hidden="true">{Array.from({ length: 24 }, (_, i) => <i key={i} style={{ left: `${(i * 37) % 100}%`, background: ["var(--coral)", "var(--sky)", "var(--success)", "var(--grape)"][i % 4], animationDelay: `${i % 8 * .12}s`, "--drift": `${(i % 7 - 3) * 35}px` }} />)}</div>}<div className="mt-5 rounded-2xl bg-primary/10 p-5" role="status"><p className="text-4xl font-black">+{reward.totalXp} XP</p><p className="mt-2 text-sm font-semibold">Saved this round</p><p className="mt-2">✓ {reward.answerXp} answer XP + ★ {reward.masteryXp} first mastery XP{reward.challengeXp > 0 ? ` + ⌨️ ${reward.challengeXp} typed challenge XP` : ""} = {reward.totalXp} XP</p>{equations.length > 0 && <p className="mt-3 text-lg font-black">🎉 Mastered {equations.slice(0, 2).join(" · ")}</p>}{equations.length > 2 && <details className="mt-2 text-sm"><summary className="cursor-pointer">All {equations.length} newly mastered facts</summary><p className="mt-2">{equations.join(" · ")}</p></details>}{reward.legacy && <p className="mt-2 text-sm">This earlier round was already saved. Its XP is included in your opening balance.</p>}</div></>
}
