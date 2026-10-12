import test from 'node:test'
import assert from 'node:assert/strict'
import { streakProgress } from '../lib/streaks.js'

const answer = (table, multiplier, correct = true) => ({ table, multiplier, correct })
const five = Array.from({ length: 5 }, (_, i) => answer(3, i + 1))

test('five varied correct facts earn a streak and repeating that set cannot grow it', () => {
  const initial = streakProgress(null, five)
  assert.equal(initial.current, 5)
  assert.equal(initial.best, 5)
  const repeated = streakProgress(initial, [...five, ...five])
  assert.deepEqual(repeated, initial)
})

test('reversed facts count once, with growth when another fact is introduced', () => {
  const progress = streakProgress(null, [answer(3, 4), answer(4, 3), answer(4, 5)])
  assert.equal(progress.current, 2)
  assert.deepEqual(progress.seen, ['3x4', '4x5'])
})

test('a mistake resets the current streak and preserves the personal best', () => {
  const saved = streakProgress(null, five)
  const next = streakProgress(saved, [answer(3, 6, false), answer(3, 1)])
  assert.equal(next.current, 1)
  assert.equal(next.best, 5)
  assert.equal(saved.current, 5)
  assert.equal(saved.seen.length, 5)
})

test('saved streaks carry across rounds without changing XP or counting repeats', () => {
  const saved = streakProgress(null, five)
  const next = streakProgress(saved, [answer(3, 6), answer(3, 7)])
  assert.equal(next.current, 7)
  assert.equal(next.best, 7)
  assert.deepEqual(streakProgress(next), next)
  assert.equal(next.xp, undefined)
})
