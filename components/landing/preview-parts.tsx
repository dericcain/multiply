import { Clock3, Infinity, Sparkles, Trophy } from "lucide-react"
import { Progress } from "@/components/ui/progress"
import styles from "./landing.module.css"

export const samplePlayers = [
  { id: "ethan", name: "Ethan", xp: 1250, count: 45, total: 100, maxTable: 10, maxMultiplier: 10, color: "var(--coral)" },
  { id: "josiah", name: "Josiah", xp: 850, count: 30, total: 60, maxTable: 6, maxMultiplier: 10, color: "var(--sky)" },
  { id: "joseph", name: "Joseph", xp: 425, count: 10, total: 40, maxTable: 4, maxMultiplier: 10, color: "var(--success)" },
]

export const sampleStandings = samplePlayers.map(({ color, xp, count, total, ...player }) => ({ player, xp, count, total, hasEvidence: true }))

export function PlayerCards() {
  return <div className={styles.playerCards}>{samplePlayers.map(player => <div key={player.id} style={{ background: player.color }}><span>{player.name[0]}</span><div><b>{player.name}</b><small>{player.xp.toLocaleString()} XP</small></div></div>)}</div>
}

export function ActivityCards({ detailed = false }: { detailed?: boolean }) {
  return <div className={styles.activityCards}><div className={styles.practice}><Sparkles aria-hidden="true" /><b>Practice</b><small>{detailed ? "Keep going or use a timer" : "Build your confidence"}</small>{detailed && <span>No round score. Just practice.</span>}</div><div className={styles.challenge}><Trophy aria-hidden="true" /><b>Challenge</b><small>{detailed ? "A fixed set of questions" : "See what you know"}</small>{detailed && <span>Finish with a score and XP.</span>}</div></div>
}

export function DurationPreview() {
  return <div className={styles.duration}><div><Infinity size={20} /><span><b>Keep going</b><small>Stop when you choose</small></span><i aria-hidden="true" /></div><div><Clock3 size={19} /><span><b>Use a timer</b><small>1–10 minutes</small></span></div><div className={styles.staticSlider} aria-hidden="true"><span /></div><p>5 minutes</p></div>
}
