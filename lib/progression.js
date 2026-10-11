export const MASTERY_BONUS = 25
export const MILESTONES = [0, 1, 3, 5, 10, 15, 20, 30, 40, 50, 65, 80, 100, 125, 150, 175, 200, 225]
export const statKey = (player, table, multiplier) => `${player}:${table}x${multiplier}`
export const isMastered = stat => stat?.recent?.length >= 5 && stat.recent.filter(Boolean).length / stat.recent.length >= .8

export function playerProgress(stats, playerId) {
  const mastered = [], facts = []
  for (let table = 1; table <= 15; table++) for (let multiplier = 1; multiplier <= 15; multiplier++) {
    const stat = stats[statKey(playerId, table, multiplier)]
    if (stat) facts.push(stat)
    if (isMastered(stat)) mastered.push(`${table} × ${multiplier}`)
  }
  const count = mastered.length
  const levelIndex = MILESTONES.findLastIndex(goal => count >= goal)
  const next = MILESTONES[levelIndex + 1] ?? null
  const floor = MILESTONES[levelIndex]
  return { mastered, count, level: levelIndex + 1, next, progress: next === null ? 100 : (count - floor) / (next - floor) * 100, xp: facts.reduce((sum, stat) => sum + stat.correct, 0) + count * MASTERY_BONUS }
}

export function familyStandings(data) {
  const rows = data.players.map(player => ({ player, ...playerProgress(data.stats, player.id) }))
    .sort((a, b) => b.count - a.count || b.xp - a.xp || a.player.name.localeCompare(b.player.name))
  rows.forEach((row, index) => { row.rank = index && row.count === rows[index - 1].count && row.xp === rows[index - 1].xp ? rows[index - 1].rank : index + 1 })
  return rows
}
