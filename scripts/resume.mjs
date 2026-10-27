// Renders resume/resume.html to public/resume.pdf with local Chrome (set CHROME to override), like scripts/assets.mjs.
//   npm run resume
// The resume's content lives in resume/resume.html (fuller than the site's, for ATS). Run by hand and commit the PDF.
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../', import.meta.url))
const html = readFileSync(join(root, 'resume/resume.html'), 'utf8').replaceAll('{{pub}}', `file://${root}public/`)

const dir = mkdtempSync(join(tmpdir(), 'resume-'))
const page = join(dir, 'resume.html'), raw = join(dir, 'resume.pdf')
writeFileSync(page, html)
const chrome = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
execFileSync(chrome, ['--headless=new', '--disable-gpu', '--allow-file-access-from-files', '--no-pdf-header-footer', '--virtual-time-budget=3000', `--print-to-pdf=${raw}`, `file://${page}`], { stdio: 'ignore' })

/** Chrome sets the title but no author. Append an incremental update with a fresh Info dictionary (classic xref only). */
export function setInfo(pdf, info) {
  const s = pdf.toString('latin1')
  const trailer = s.slice(s.lastIndexOf('trailer'))
  const root = trailer.match(/\/Root\s+(\d+\s+\d+\s+R)/)?.[1], size = +trailer.match(/\/Size\s+(\d+)/)?.[1]
  const prev = +s.match(/startxref\s+(\d+)\s+%%EOF\s*$/)?.[1]
  if (!root || !size || !prev) throw new Error('unexpected PDF structure (xref stream?)')
  const str = v => `(${v.replace(/[\\()]/g, '\\$&')})`
  const obj = `\n${size} 0 obj\n<< ${Object.entries(info).map(([k, v]) => `/${k} ${str(v)}`).join(' ')} >>\nendobj\n`
  const at = pdf.length + 1, xref = pdf.length + obj.length
  const tail = `xref\n0 1\n0000000000 65535 f \n${size} 1\n${String(at).padStart(10, '0')} 00000 n \ntrailer\n<< /Size ${size + 1} /Root ${root} /Info ${size} 0 R /Prev ${prev} >>\nstartxref\n${xref}\n%%EOF\n`
  return Buffer.concat([pdf, Buffer.from(obj + tail, 'latin1')])
}

const out = setInfo(readFileSync(raw), { Title: 'Sammy Ibeh, Resume', Author: 'Sammy Ibeh', Creator: 'sammyibeh.dev' })
console.assert(out.toString('latin1').includes('/Author (Sammy Ibeh)'), 'resume self-check: author set')
writeFileSync(join(root, 'public/resume.pdf'), out)
console.log(`public/resume.pdf: ${out.length} bytes`)
