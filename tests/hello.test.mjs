import { test } from 'node:test'
import assert from 'node:assert/strict'
import { KEY, OTHERS, greeter } from '../src/scripts/hello.js'

const seeded = (a = 42) => () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t ^= t + Math.imul(t ^ (t >>> 7), 61 | t); return ((t ^ (t >>> 14)) >>> 0) / 2 ** 32 } // mulberry32

test('greeting: English first, no repeats in the recent window, keys ~3× as often, every language shows', () => {
  const next = greeter(seeded()), picks = Array.from({ length: 10000 }, next)
  assert.equal(picks[0], KEY[0])
  picks.forEach((p, i) => assert.ok(!picks.slice(Math.max(0, i - 3), i).includes(p), `repeat at ${i}`))
  const count = p => picks.filter(x => x === p).length
  for (const p of [...KEY, ...OTHERS]) assert.ok(count(p) > 0, p)
  const avg = list => list.reduce((a, p) => a + count(p), 0) / list.length, ratio = avg(KEY) / avg(OTHERS)
  assert.ok(Math.abs(ratio - 3) < 0.3, `key:other ratio ${ratio.toFixed(2)}`)
})
