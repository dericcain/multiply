import test from 'node:test'
import assert from 'node:assert/strict'
import { playerProgress, familyStandings, isMastered } from '../lib/progression.js'

const mastered = { correct: 4, attempts: 5, recent: [true, true, true, true, false] }
const scope = (maxTable, maxMultiplier = maxTable) => ({ maxTable, maxMultiplier })
const statsWithMastered = (id, n, maxTable, maxMultiplier = maxTable) => {
  const stats = {}
  let count = 0
  for (let table = 1; table <= maxTable && count < n; table++) {
    for (let multiplier = 1; multiplier <= maxMultiplier && count < n; multiplier++) {
      stats[`${id}:${table}x${multiplier}`] = mastered
      count++
    }
  }
  return stats
}

test('mastery requires five answers and actual 80% accuracy in latest responses', () => {
  assert.equal(isMastered({ recent: [true, true, true, true] }), false)
  assert.equal(isMastered(mastered), true)
  assert.equal(isMastered({ recent: [true, true, true, true, true, true, true, false, false] }), false)
})

test('progress and next target use only the assigned scope', () => {
  const stats = { 'p:1x1': mastered, 'p:15x15': mastered }
  const p = playerProgress(stats, 'p', scope(2), 29)
  assert.equal(p.count, 1)
  assert.equal(p.total, 4)
  assert.equal(p.masteryPercent, 25)
  assert.deepEqual(p.nextTarget, { table: 1, multiplier: 2, label: '1 × 2' })
  assert.equal(p.xp, 29)
  assert.equal(p.solo, undefined)
})

test('20/25 and 80/100 tie even with different XP and stable name ordering', () => {
  const data = {
    players: [
      { id: 'joseph', name: 'Joseph', ...scope(5), xp: 1 },
      { id: 'josiah', name: 'Josiah', ...scope(10), xp: 10000 },
      { id: 'ethan', name: 'Ethan', ...scope(15), xp: 50000 },
    ],
    stats: { ...statsWithMastered('joseph', 20, 5), ...statsWithMastered('josiah', 80, 10), ...statsWithMastered('ethan', 135, 15) },
    xp: { joseph: 1, josiah: 10000, ethan: 50000 },
  }
  assert.deepEqual(familyStandings(data).map(r => [r.player.id, r.count, r.rank]), [
    ['joseph', 20, 1], ['josiah', 80, 1], ['ethan', 135, 3],
  ])
})

test('exact fraction ordering does not collapse nearby ratios to a rounded tie', () => {
  const data = {
    players: [{ id: 'a', name: 'A', ...scope(7) }, { id: 'b', name: 'B', ...scope(9) }],
    stats: { ...statsWithMastered('a', 5, 7), ...statsWithMastered('b', 6, 9) },
    xp: { a: 0, b: 999999 },
  }
  // 5/7 is slightly greater than 6/9; both can round to a similar display value.
  assert.deepEqual(familyStandings(data).map(r => [r.player.id, r.rank]), [['a', 1], ['b', 2]])
})

test('empty scope and players without sufficient evidence have no rank', () => {
  const data = {
    players: [{ id: 'new', name: 'New', ...scope(5) }, { id: 'bad', name: 'Bad', maxTable: 0, maxMultiplier: 5 }],
    stats: { 'new:1x1': { recent: [true, true, true] } },
    xp: {},
  }
  const rows = familyStandings(data)
  assert.equal(rows.find(r => r.player.id === 'new').rank, null)
  assert.equal(rows.find(r => r.player.id === 'bad').rank, null)
  assert.equal(rows.find(r => r.player.id === 'new').personalGoal, 'Master 1 × 1')
})

test('solo player gets a personal goal and no synthetic scored rival', () => {
  const rows = familyStandings({ players: [{ id: 'p', name: 'P', ...scope(1) }], stats: {}, xp: { p: 7 } })
  assert.equal(rows.length, 1)
  assert.equal(rows[0].solo, true)
  assert.equal(rows[0].personalGoal, 'Master 1 × 1')
  assert.equal(rows[0].xp, 7)
})

test('XP comes from the server balance and is independent of current mastery', () => {
  const stats = { 'p:1x1': mastered }
  const beforeLoss = playerProgress(stats, 'p', scope(1), 42)
  const afterLoss = playerProgress({ 'p:1x1': { recent: [true, false, false, false, false] } }, 'p', scope(1), 42)
  assert.equal(beforeLoss.xp, 42)
  assert.equal(afterLoss.xp, 42)
  assert.equal(afterLoss.count, 0)
})
