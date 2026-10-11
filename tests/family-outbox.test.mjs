import test from "node:test"
import assert from "node:assert/strict"
import { pendingGames, removePendingGame, storePendingGame } from "../components/family-outbox.js"

function storage() {
  const items = new Map()
  return { get length() { return items.size }, key: index => [...items.keys()][index], getItem: key => items.get(key) || null, setItem: (key, value) => items.set(key, value), removeItem: key => items.delete(key) }
}
const game = (id, date) => ({ id, date, playerId: "kid", results: [{ table: 2, multiplier: 3, correct: true }] })

test("a successful save in one tab preserves another tab's failed game across reload", () => {
  const sharedStorage = storage()
  storePendingGame(sharedStorage, "parent", "family", game("A", 1))
  storePendingGame(sharedStorage, "parent", "family", game("B", 2))
  removePendingGame(sharedStorage, "parent", "family", "A")
  assert.deepEqual(pendingGames(sharedStorage, "parent", "family").map(item => item.id), ["B"])
  removePendingGame(sharedStorage, "parent", "family", "A")
  assert.equal(pendingGames(sharedStorage, "parent", "family")[0].id, "B")
})

test("outbox restores oldest game first and isolates accounts and families", () => {
  const saved = storage()
  storePendingGame(saved, "parent", "family", game("late", 20))
  storePendingGame(saved, "parent", "family", game("early", 10))
  storePendingGame(saved, "other", "family", game("private", 1))
  storePendingGame(saved, "parent", "other-family", game("separate", 1))
  assert.deepEqual(pendingGames(saved, "parent", "family").map(item => item.id), ["early", "late"])
  removePendingGame(saved, "parent", "family", "early")
  assert.equal(pendingGames(saved, "parent", "family")[0].id, "late")
})

test("corrupt and mismatched envelopes are ignored", () => {
  const saved = storage()
  saved.setItem("multiply:pending-game:parent:family:broken", "{")
  saved.setItem("multiply:pending-game:parent:family:wrong", JSON.stringify({ userId: "other", familyId: "family", game: game("wrong", 1) }))
  assert.deepEqual(pendingGames(saved, "parent", "family"), [])
})
