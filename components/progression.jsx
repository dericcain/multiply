import { useEffect, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { familyStandings, MASTERY_BONUS, MILESTONES } from "@/lib/progression"
import styles from "./progression.module.css"

export function Journey({ progress }) {
  return <Card className="mt-6 border-primary/20 bg-primary/5"><CardContent className="p-5">
    <div className="flex items-center justify-between gap-3"><h2 className="text-xl font-black">{progress.next === null ? "🏆 Multiplication master!" : `🌟 Level ${progress.level}`}</h2><b className="text-primary">{progress.xp} XP</b></div>
    <p className="mt-2 font-bold">{progress.count} / 225 facts mastered</p>
    <Progress className="mt-3 h-3" value={progress.progress} aria-label="Progress to next level" />
    <p className="mt-2 text-sm font-semibold">{progress.next === null ? "You mastered all 225 facts through 15 × 15!" : `${progress.next - progress.count} more mastered ${progress.next - progress.count === 1 ? "fact" : "facts"} to level ${progress.level + 1}`}</p>
    <details className="mt-4 text-sm"><summary className="cursor-pointer font-bold">Levels and points</summary><div className="mt-3 flex flex-wrap gap-2">{MILESTONES.slice(1).map((goal, index) => <span key={goal} className={`rounded-xl px-3 py-2 ${progress.count >= goal ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground"}`}>{progress.count >= goal ? "✓ " : ""}Level {index + 2} · {goal} facts</span>)}</div><p className="mt-3 text-muted-foreground">A fact counts as mastered after at least 5 answers, with 80% correct in your latest answers (up to 10). Practice and challenges both count. XP means level points: 1 per correct answer, plus {MASTERY_BONUS} for each fact currently mastered.</p></details>
  </CardContent></Card>
}

export function FamilyStandings({ data, activePlayer, alwaysShow }) {
  if (!alwaysShow && data.players.length < 2) return null
  const rows = familyStandings(data)
  return <Card className="mt-6"><CardContent className="p-5"><h2 className="text-xl font-black">🏁 Family standings</h2><p className="mt-1 text-xs text-muted-foreground">Ranked by facts mastered, then XP.</p><ol className="mt-3 space-y-3">{rows.map(row => <li key={row.player.id} className={`rounded-xl p-3 ${row.player.id === activePlayer ? "bg-primary/10" : "bg-muted/50"}`}><div className="flex items-center gap-3"><b className="text-primary">#{row.rank}</b><div className="min-w-0 flex-1"><b className="block break-words">{row.player.name}{row.player.id === activePlayer ? " (you)" : ""}</b><span className="text-xs">Level {row.level} · {row.xp} XP</span></div><b className="text-sm">{row.count}/225</b></div><Progress className="mt-2 h-2" value={row.count / 225 * 100} aria-label={`${row.player.name}: ${row.count} of 225 facts mastered`} /></li>)}</ol></CardContent></Card>
}

export function MasteryCelebration({ reward }) {
  const [confetti, setConfetti] = useState(true)
  useEffect(() => { const timer = setTimeout(() => setConfetti(false), 4000); return () => clearTimeout(timer) }, [])
  const celebrate = reward.earned.length > 0 || reward.level
  return <>{celebrate && confetti && <div className={styles.confetti} aria-hidden="true">{Array.from({ length: 48 }, (_, i) => <i key={i} style={{ left: `${(i * 37) % 100}%`, background: ["var(--coral)", "var(--sky)", "var(--success)", "var(--grape)", "#facc15"][i % 5], animationDelay: `${i % 8 * .12}s`, "--drift": `${(i % 7 - 3) * 35}px` }} />)}</div>}<div className="mt-5 rounded-2xl bg-primary/10 p-5" role="status">{celebrate && <><p className="text-2xl font-black">{reward.earned.length > 0 ? `🎉 You mastered ${reward.earned.length} ${reward.earned.length === 1 ? "new fact" : "new facts"}!` : "🎉 Level up!"}</p>{reward.level && <p className="mt-2 text-lg font-black">You reached level {reward.level}!</p>}{reward.earned.length > 0 && <><p className="mt-2 font-bold text-primary">+{reward.earned.length * MASTERY_BONUS} bonus XP</p><p className="mt-2 text-sm">{reward.earned.join(" · ")}</p></>}</>}<p className="mt-2 font-bold">+{reward.xp} XP this round</p></div></>
}
