import test from 'node:test'
import assert from 'node:assert/strict'
import { playerProgress, familyStandings, rankStandings, isMastered, masteryLevel } from '../lib/progression.js'

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

test('total XP determines rank regardless of mastery percentage or assigned range', () => {
  const data = {
    players: [
      { id: 'joseph', name: 'Joseph', ...scope(5) },
      { id: 'josiah', name: 'Josiah', ...scope(10) },
      { id: 'ethan', name: 'Ethan', ...scope(15) },
    ],
    stats: { ...statsWithMastered('joseph', 20, 5), ...statsWithMastered('josiah', 80, 10), ...statsWithMastered('ethan', 135, 15) },
    xp: { joseph: 1, josiah: 10000, ethan: 50000 },
  }
  assert.deepEqual(familyStandings(data).map(r => [r.player.id, r.count, r.rank]), [
    ['ethan', 135, 1], ['josiah', 80, 2], ['joseph', 20, 3],
  ])
})

test('players without mastery are ranked by XP from the start', () => {
  const rows = familyStandings({
    players: [{ id: 'joseph', name: 'Joseph', ...scope(5) }, { id: 'dad', name: 'Dad', ...scope(15) }, { id: 'josiah', name: 'Josiah', ...scope(10) }],
    stats: {}, xp: { dad: 90, joseph: 29, josiah: 48 },
  })
  assert.deepEqual(rows.map(r => [r.player.id, r.rank]), [['dad', 1], ['josiah', 2], ['joseph', 3]])
  assert.ok(rows.every(r => r.count === 0 && r.level.name === 'Starter'))
})

test('equal XP shares competition rank with stable name ordering, including zero XP', () => {
  const players = [{ id: 'c', name: 'C', ...scope(5) }, { id: 'b', name: 'B', ...scope(10) }, { id: 'a', name: 'A', ...scope(1) }]
  const stats = statsWithMastered('b', 50, 10)
  assert.deepEqual(familyStandings({ players, stats, xp: { a: 90, b: 90, c: 20 } }).map(r => [r.player.id, r.rank]), [['a', 1], ['b', 1], ['c', 3]])
  assert.deepEqual(familyStandings({ players, stats, xp: {} }).map(r => r.rank), [1, 1, 1])
})

test('empty scope still ranks and asks for an assignment', () => {
  const [row] = familyStandings({ players: [{ id: 'bad', name: 'Bad', maxTable: 0, maxMultiplier: 5 }], stats: {}, xp: {} })
  assert.equal(row.rank, 1)
  assert.equal(row.level.name, 'Starter')
  assert.equal(row.nextLevel, null)
  assert.equal(row.personalGoal, 'Choose an assigned range')
})

test('mastery levels use exact percentages and round next milestones up to whole facts', () => {
  for (const total of [25, 100, 144, 225]) {
    for (const [percent, name] of [[10, 'Explorer'], [25, 'Builder'], [50, 'Expert'], [100, 'Math Genius']]) {
      const threshold = Math.ceil(total * percent / 100)
      assert.equal(masteryLevel(threshold, total).level.name, name)
      assert.notEqual(masteryLevel(threshold - 1, total).level.name, name)
    }
  }
  const starter = masteryLevel(0, 25)
  assert.equal(starter.factsToNextLevel, 3)
  assert.equal(starter.nextLevel.name, 'Explorer')
  assert.equal(masteryLevel(25, 25).nextLevel, null)
  assert.equal(masteryLevel(0, 0).level.name, 'Starter')
  assert.equal(masteryLevel(0, 0).nextLevel, null)
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

test('child summaries use XP ranks and mastery levels without histories', () => {
  const summaries = [
    { player: { id: 'b', name: 'B' }, count: 80, total: 100, hasEvidence: true, xp: 1000 },
    { player: { id: 'a', name: 'A' }, count: 20, total: 25, hasEvidence: true, xp: 26 },
    { player: { id: 'c', name: 'C' }, count: 0, total: 25, hasEvidence: false, xp: 2 },
  ]
  const rows = rankStandings(summaries)
  assert.deepEqual(rows.map(row => [row.player.id, row.rank]), [['b', 1], ['a', 2], ['c', 3]])
  assert.equal(rows[0].level.name, 'Expert')
  assert.equal(rows[2].level.name, 'Starter')
  assert.equal(rows[2].progress, 0)
  assert.equal(summaries[0].rank, undefined, 'sorting does not mutate server summaries')
  assert.equal(rankStandings([summaries[0]])[0].solo, true)
})
