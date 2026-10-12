export const MASTERY_BONUS = 25

export const MASTERY_LEVELS = [
  { number: 1, name: 'Starter', percent: 0 },
  { number: 2, name: 'Explorer', percent: 10 },
  { number: 3, name: 'Builder', percent: 25 },
  { number: 4, name: 'Expert', percent: 50 },
  { number: 5, name: 'Math Genius', percent: 100 },
]

export function masteryLevel(count, total) {
  const level = MASTERY_LEVELS.findLast(level => count * 100 >= level.percent * total && (total > 0 || level.percent === 0))
  const nextLevel = total > 0 ? MASTERY_LEVELS[level.number] ?? null : null
  return { level, nextLevel, factsToNextLevel: nextLevel ? Math.ceil(nextLevel.percent * total / 100) - count : null }
}
export const statKey = (player, table, multiplier) => `${player}:${table}x${multiplier}`

// A fact is mastered after five or more of the latest (up to ten) responses
// are correct, preserving the product's existing evidence rule.
export const isMastered = stat => Array.isArray(stat?.recent) && stat.recent.length >= 5 &&
  stat.recent.filter(Boolean).length / stat.recent.length >= .8

function assignedScope(player = {}) {
  const { maxTable, maxMultiplier } = player
  if (!Number.isInteger(maxTable) || !Number.isInteger(maxMultiplier) || maxTable < 1 || maxMultiplier < 1) return null
  return { maxTable, maxMultiplier, total: maxTable * maxMultiplier }
}

/**
 * Progress within a player's parent-assigned rectangular scope. `xp` is an
 * authoritative long-running balance supplied by the server; it is never
 * reconstructed from current mastery, so losing mastery cannot reduce XP.
 */
export function playerProgress(stats, playerId, player = {}, xpBalance = player.xp) {
  const scope = assignedScope(player)
  const mastered = [], masteredFacts = []
  let hasEvidence = false
  if (scope) {
    for (let table = 1; table <= scope.maxTable; table++) for (let multiplier = 1; multiplier <= scope.maxMultiplier; multiplier++) {
      const stat = stats?.[statKey(playerId, table, multiplier)]
      if (Array.isArray(stat?.recent) && stat.recent.length >= 5) hasEvidence = true
      if (isMastered(stat)) {
        mastered.push(`${table} × ${multiplier}`)
        masteredFacts.push({ table, multiplier })
      }
    }
  }
  const count = mastered.length
  const total = scope?.total ?? 0
  const nextFact = scope && count < total
    ? (() => {
        for (let table = 1; table <= scope.maxTable; table++) for (let multiplier = 1; multiplier <= scope.maxMultiplier; multiplier++) {
          if (!isMastered(stats?.[statKey(playerId, table, multiplier)])) return { table, multiplier, label: `${table} × ${multiplier}` }
        }
      })()
    : null
  const xp = Number.isFinite(xpBalance) && xpBalance >= 0 ? xpBalance : 0
  return {
    mastered, count, total, xp,
    scope: scope ? { maxTable: scope.maxTable, maxMultiplier: scope.maxMultiplier } : null,
    hasEvidence,
    hasRank: true,
    ratio: total ? { numerator: count, denominator: total } : null,
    masteryPercent: total ? count * 100 / total : null,
    progress: total ? count * 100 / total : 0,
    nextTarget: nextFact,
    personalGoal: total ? (nextFact ? `Master ${nextFact.label}` : 'Mastered your assigned tables') : 'Choose an assigned range',
    ...masteryLevel(count, total),
    next: nextFact?.label ?? null,
  }
}

export function familyStandings(data) {
  const rows = (data.players ?? []).map(player => ({
    player,
    ...playerProgress(data.stats, player.id, player, data.xp?.[player.id]),
  }))
  return rankStandings(rows)
}

// Child links expose summaries without other players' answer histories.
// Both views use the same XP ranking and mastery levels.
export function rankStandings(progressRows) {
  const rows = progressRows.map(row => ({
    ...row,
    xp: Number.isFinite(row.xp) && row.xp >= 0 ? row.xp : 0,
    hasRank: true,
    masteryPercent: row.total > 0 ? row.count * 100 / row.total : null,
    progress: row.total > 0 ? row.count * 100 / row.total : 0,
    ...masteryLevel(row.count, row.total),
  }))
  rows.sort((a, b) => b.xp - a.xp || (a.player.name ?? '').localeCompare(b.player.name ?? '') || a.player.id.localeCompare(b.player.id))
  let previous = null
  rows.forEach((row, index) => {
    row.rank = previous && previous.xp === row.xp ? previous.rank : index + 1
    previous = row
  })
  // A one-student family gets a personal goal and no synthetic scored rival.
  const solo = rows.length === 1
  return rows.map(row => ({ ...row, solo }))
}
