// Only completed games are cached. Every game has its own key so another tab
// cannot replace or delete a pending save from this tab.
const prefix = (userId, familyId) => `multiply:pending-game:${encodeURIComponent(userId)}:${encodeURIComponent(familyId)}:`
const key = (userId, familyId, gameId) => `${prefix(userId, familyId)}${encodeURIComponent(gameId)}`

export function storePendingGame(storage, userId, familyId, game) {
  storage.setItem(key(userId, familyId, game.id), JSON.stringify({ userId, familyId, game }))
}

export function removePendingGame(storage, userId, familyId, gameId) {
  storage.removeItem(key(userId, familyId, gameId))
}

export function pendingGames(storage, userId, familyId) {
  const games = []
  const scopedPrefix = prefix(userId, familyId)
  for (let index = 0; index < storage.length; index++) {
    const storedKey = storage.key(index)
    if (!storedKey?.startsWith(scopedPrefix)) continue
    try {
      const saved = JSON.parse(storage.getItem(storedKey))
      const game = saved?.game
      if (saved?.userId === userId && saved.familyId === familyId && typeof game?.id === "string" && storedKey === key(userId, familyId, game.id) && Array.isArray(game.results) && game.results.length > 0) games.push(game)
    } catch {}
  }
  return games.sort((a, b) => (a.date || 0) - (b.date || 0) || a.id.localeCompare(b.id))
}
