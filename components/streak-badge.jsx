import { Flame } from "lucide-react"
import { STREAK_BADGE_AT } from "@/lib/streaks"

export function StreakBadge({ streak, pending = false }) {
  const earned = streak.current >= STREAK_BADGE_AT
  return <div className={`mt-4 rounded-2xl border p-3 ${earned ? "border-[var(--coral)]/40 bg-[var(--coral)]/10" : "bg-muted/50"}`}>
    <div className="flex flex-wrap items-center justify-between gap-2">
      <p className="flex items-center gap-2 font-black"><Flame aria-hidden="true" className={earned ? "text-[var(--coral)]" : "text-muted-foreground"} />
        {earned ? `${streak.current}-fact streak!` : `${streak.current}/${STREAK_BADGE_AT} toward a streak`}
        {pending && <span className="text-xs font-semibold">pending save</span>}
      </p>
      <span className="text-sm font-semibold">Best: {streak.best}</span>
    </div>
    <p className="mt-1 text-sm">Different facts grow your streak. A mistake starts a new run.</p>
  </div>
}
