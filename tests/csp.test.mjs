import { test } from 'node:test'
import assert from 'node:assert/strict'
import { hash, inlineScripts } from '../scripts/csp.mjs'

test('picks up inline scripts, skips external and JSON-LD', () => {
  const html = `<script>a()</script><script type="module" src="/x.js"></script>
<script type="application/ld+json">{"a":1}</script><script is:inline>
b()
</script>`
  assert.deepEqual(inlineScripts(html), ['a()', '\nb()\n'])
})

test('hash is a CSP sha256 source', () => {
  assert.equal(hash(''), "'sha256-47DEQpj8HBSa+/TImW+5JCeuQeRkm5NMpJWZG3hSuFU='")
})
