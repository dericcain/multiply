import test from 'node:test'
import assert from 'node:assert/strict'
import { playerProgress, familyStandings, isMastered } from '../lib/progression.js'
const mastered = { correct: 4, attempts: 5, recent: [true, true, true, true, false] }
test('mastery requires five answers and actual 80% accuracy', () => {
  assert.equal(isMastered({ recent: [true, true, true, true] }), false)
  assert.equal(isMastered(mastered), true)
  assert.equal(isMastered({ recent: [true, true, true, true, true, true, true, false, false] }), false)
})
test('early levels and XP use all facts regardless of selected practice range', () => {
  const p = playerProgress({ 'p:15x15': mastered }, 'p')
  assert.equal(p.count, 1); assert.equal(p.level, 2); assert.equal(p.next, 3); assert.equal(p.xp, 29)
  assert.equal(playerProgress({}, 'p').next, 1)
})
test('master title requires the full ordered 15 by 15 table', () => {
  const stats = {}
  for (let a = 1; a <= 15; a++) for (let b = 1; b <= 15; b++) stats[`p:${a}x${b}`] = mastered
  assert.equal(playerProgress(stats, 'p').next, null)
  delete stats['p:15x15']
  assert.equal(playerProgress(stats, 'p').next, 225)
})
test('standings rank mastery then XP and share tied ranks', () => {
  const data = { players: ['a', 'b', 'c'].map(id => ({ id, name: id })), stats: { 'c:1x1': mastered } }
  assert.deepEqual(familyStandings(data).map(r => [r.player.id, r.rank]), [['c', 1], ['a', 2], ['b', 2]])
})
