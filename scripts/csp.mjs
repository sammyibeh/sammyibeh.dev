// Post-build: hash every inline <script> in dist/ into the CSP in dist/_headers,
// so the theme bootstrap can change without anyone hand-editing a hash.
import { createHash } from 'node:crypto'
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const dist = fileURLToPath(new URL('../dist/', import.meta.url))
const TOKEN = '{inline-script-hashes}'

export const inlineScripts = html =>
  [...html.matchAll(/<script(?![^>]*\bsrc=)([^>]*)>([^]*?)<\/script>/g)]
    .filter(([, attrs]) => !/type="application\/ld\+json"/.test(attrs)) // data blocks never execute
    .map(([, , body]) => body)

export const hash = body => `'sha256-${createHash('sha256').update(body).digest('base64')}'`

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const pages = readdirSync(dist, { recursive: true }).filter(f => f.endsWith('.html'))
  const hashes = [...new Set(pages.flatMap(f => inlineScripts(readFileSync(join(dist, f), 'utf8')).map(hash)))]
  const file = join(dist, '_headers')
  const headers = readFileSync(file, 'utf8')
  if (!headers.includes(TOKEN)) throw new Error(`${TOKEN} not found in dist/_headers`)
  writeFileSync(file, headers.replaceAll(TOKEN, hashes.join(' ')))
  console.log(`csp: ${hashes.length} inline script hash(es) across ${pages.length} pages`)
}
