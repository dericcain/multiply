export const MASTERY_BONUS = 25
export const XP_CHECKPOINT = MASTERY_BONUS
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
    hasRank: total > 0 && hasEvidence,
    ratio: total ? { numerator: count, denominator: total } : null,
    masteryPercent: total ? count * 100 / total : null,
    progress: total ? count * 100 / total : 0,
    nextTarget: nextFact,
    personalGoal: total ? (nextFact ? `Master ${nextFact.label}` : 'Mastered your assigned tables') : 'Choose an assigned range',
    // Compatibility fields for callers transitioning from levels to goals.
    level: null, next: nextFact?.label ?? null,
  }
}

function compareRatios(a, b) {
  // Counts and denominators are integers, so cross multiplication avoids
  // floating point ordering errors and preserves exact ties.
  return b.count * a.total - a.count * b.total
}

export function familyStandings(data) {
  const rows = (data.players ?? []).map(player => ({
    player,
    ...playerProgress(data.stats, player.id, player, data.xp?.[player.id]),
  }))
  rows.sort((a, b) => {
    if (a.hasRank !== b.hasRank) return a.hasRank ? -1 : 1
    if (a.hasRank) {
      const ratioOrder = compareRatios(a, b)
      if (ratioOrder) return ratioOrder
    }
    return (a.player.name ?? '').localeCompare(b.player.name ?? '')
  })
  let previous = null
  rows.forEach((row, index) => {
    if (!row.hasRank) row.rank = null
    else if (previous && compareRatios(previous, row) === 0) row.rank = previous.rank
    else row.rank = index + 1
    if (row.hasRank) previous = row
  })
  const leaderXp = rows.reduce((max, row) => Math.max(max, row.xp), 0)
  const xpLeaders = rows.filter(row => row.xp === leaderXp && leaderXp > 0)
  for (const row of rows) {
    row.xpLeader = xpLeaders.length === 1 && row.xp === leaderXp
    row.xpCheckpoint = row.xp % XP_CHECKPOINT
    row.xpCheckpointPercent = row.xpCheckpoint / XP_CHECKPOINT * 100
  }
  // A one-student family gets a personal goal and no synthetic scored rival.
  const solo = rows.length === 1
  return rows.map(row => ({ ...row, solo }))
}
