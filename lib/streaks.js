export const STREAK_BADGE_AT = 5

export function streakProgress(saved, results = []) {
  let seen = new Set(saved?.seen ?? [])
  let best = saved?.best ?? 0
  for (const result of results) {
    if (!result.correct) { seen = new Set(); continue }
    // Reversed equations are one fact for streaks, even though mastery tracks
    // both directions. Repeating a correct fact preserves, but cannot grow, a run.
    const fact = `${Math.min(result.table, result.multiplier)}x${Math.max(result.table, result.multiplier)}`
    seen.add(fact)
    best = Math.max(best, seen.size)
  }
  return { current: seen.size, best, seen: [...seen] }
}
