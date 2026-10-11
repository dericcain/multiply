import { useEffect, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { familyStandings } from "@/lib/progression"
import styles from "./progression.module.css"

export function Journey({ progress, nextStat }) {
  const total = progress.total ?? 0, count = progress.count
  const percentage = total ? count / total * 100 : 0
  return <Card className="mt-4 border-primary/20 bg-primary/5"><CardContent className="p-4"><div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-black">Your mastery goal</h2><b>{progress.hasEvidence ? `${Math.round(percentage)}% mastered` : "Getting started"}</b></div><Progress className="mt-3 h-3" value={percentage} aria-label={`${count} of ${total} assigned facts mastered`} /><p className="mt-2 text-sm font-semibold">{total ? `${count} / ${total} assigned facts mastered` : "Ask a parent to assign your tables."}</p><p className="mt-1 text-sm">{count === total && total ? "Finish line reached! Review your tables, or ask a parent for your next goal." : `Next goal: ${progress.nextTarget ? `master ${progress.nextTarget.label}` : "master one more fact"}.`}</p>{nextStat && <p className="mt-2 text-sm">Next fact: {Math.min(nextStat.recent?.length ?? 0, 5)}/5 responses recorded · {nextStat.recent?.length ? Math.round(nextStat.recent.filter(Boolean).length / nextStat.recent.length * 100) : 0}% correct in recent responses. Mastery needs at least 80%.</p>}</CardContent></Card>
}

export function FamilyStandings({ data, activePlayer }) {
  const [robot, setRobot] = useState(false)
  const rows = familyStandings(data)
  if (!rows.length) return <p className="mt-4 text-sm">Add a player to start a mastery goal.</p>
  if (rows.length === 1) {
    const row = rows[0], percentage = row.total ? row.count / row.total * 100 : 0
    return <Card className="mt-5"><CardContent className="p-4"><h2 className="text-lg font-black">Your next finish line</h2><p className="mt-2">{row.count === row.total && row.total ? "You mastered your assigned tables! Ask a parent to choose your next range." : `${row.total - row.count} assigned facts to master. Pick a table and practice one fact at a time.`}</p><button type="button" className="mt-3 min-h-11 rounded-xl border px-3 font-semibold" aria-pressed={robot} onClick={() => setRobot(!robot)}>{robot ? "Hide robot goal" : "Show a robot goal"}</button>{robot && <div className="mt-3 rounded-xl bg-muted p-3"><p className="font-bold">🤖 Robot goal: 80% mastered</p><Progress className="mt-2" value={80} aria-label="Robot's fixed mastery goal: 80 percent" /><p className="mt-2 text-sm">{percentage >= 80 ? "You reached the robot’s goal!" : "See if you can reach 80% of your own tables."} This is a fixed practice target.</p></div>}</CardContent></Card>
  }
  return <Card className="mt-5"><CardContent className="p-4"><h2 className="text-xl font-black">🏁 Family mastery</h2><p className="mt-1 text-sm">Your tables. Same finish line.</p><ol className="mt-3 space-y-3">{rows.map(row => {
    const percentage = row.total ? row.count / row.total * 100 : 0
    const tied = row.rank != null && rows.filter(other => other.rank === row.rank).length > 1
    return <li key={row.player.id} className={`rounded-xl border p-3 ${row.player.id === activePlayer ? "border-primary bg-primary/10" : "bg-muted/50"}`}><div className="flex items-center gap-2"><b className="min-w-8 text-primary">{row.rank == null ? "—" : `#${row.rank}`}</b><div className="min-w-0 flex-1"><b className="block break-words">{row.player.name}{row.player.id === activePlayer ? " (you)" : ""}</b><span className="text-sm">{row.xp.toLocaleString()} XP{tied ? " · Joint rank" : ""}</span></div><div className="shrink-0 text-right"><b className="block text-xl">{row.rank == null ? "—" : `${Number(percentage.toFixed(1))}%`}</b><span className="text-xs">{row.count}/{row.total} mastered</span></div></div><Progress className="mt-2 h-2" value={percentage} aria-label={`${row.player.name}: ${row.count} of ${row.total} assigned facts mastered`} /><details className="mt-2 text-sm"><summary className="min-h-8 cursor-pointer font-semibold">{row.rank == null ? "Getting started · View assigned tables" : "View assigned tables"}</summary><p className="mt-1">{row.count}/{row.total} mastered · 1–{row.player.maxTable} × 1–{row.player.maxMultiplier}</p></details></li>
  })}</ol></CardContent></Card>
}

export function MasteryCelebration({ reward }) {
  const [confetti, setConfetti] = useState(true)
  useEffect(() => { setConfetti(true); const timer = setTimeout(() => setConfetti(false), 3000); return () => clearTimeout(timer) }, [reward.sessionId])
  const earned = reward.masteredFacts || [], equations = earned.map(fact => fact.replace("x", " × "))
  return <>{earned.length > 0 && confetti && <div className={styles.confetti} aria-hidden="true">{Array.from({ length: 24 }, (_, i) => <i key={i} style={{ left: `${(i * 37) % 100}%`, background: ["var(--coral)", "var(--sky)", "var(--success)", "var(--grape)"][i % 4], animationDelay: `${i % 8 * .12}s`, "--drift": `${(i % 7 - 3) * 35}px` }} />)}</div>}<div className="mt-5 rounded-2xl bg-primary/10 p-5" role="status"><p className="text-4xl font-black">+{reward.totalXp} XP</p><p className="mt-2 text-sm font-semibold">Saved this round</p><p className="mt-2">✓ {reward.answerXp} answer XP + ★ {reward.masteryXp} first mastery XP = {reward.totalXp} XP</p>{equations.length > 0 && <p className="mt-3 text-lg font-black">🎉 Mastered {equations.slice(0, 2).join(" · ")}</p>}{equations.length > 2 && <details className="mt-2 text-sm"><summary className="cursor-pointer">All {equations.length} newly mastered facts</summary><p className="mt-2">{equations.join(" · ")}</p></details>}{reward.legacy && <p className="mt-2 text-sm">This earlier round was already saved. Its XP is included in your opening balance.</p>}</div></>
}
