// Regenerates the committed image assets. Run by hand after changing the icon or a page's share card:
//   node scripts/assets.mjs
// Icons are rendered from public/favicon.svg with sharp (already installed by Astro).
// Share cards are HTML screenshotted by local Chrome, so they use the real fonts; set CHROME to override the path.
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const pub = fileURLToPath(new URL('../public/', import.meta.url))

/* ---------- icons ---------- */
// librsvg ignores the light-scheme media query, so rasters come out in Night Lamp.
const svg = readFileSync(join(pub, 'favicon.svg'), 'utf8')
// Full-bleed square with the glyph inside the maskable safe zone (also what iOS wants for touch icons).
const bleed = svg
  .replace('rx="7"', '')
  .replace(/(<g class="br"[^]*<\/svg>)/, '<g transform="translate(16 16) scale(.62) translate(-16 -16)">$1')
  .replace('</svg>', '</g></svg>')
const png = (s, size) => sharp(Buffer.from(s), { density: (72 * size * 4) / 32 }).resize(size, size).png().toBuffer()

writeFileSync(join(pub, 'apple-touch-icon.png'), await png(bleed, 180))
writeFileSync(join(pub, 'icons/icon-192.png'), await png(svg, 192))
writeFileSync(join(pub, 'icons/icon-512.png'), await png(svg, 512))
writeFileSync(join(pub, 'icons/maskable-512.png'), await png(bleed, 512))

// favicon.ico holding PNG-encoded 16 and 32 entries
const sizes = [16, 32]
const imgs = await Promise.all(sizes.map(n => png(svg, n)))
const head = Buffer.alloc(6 + 16 * imgs.length)
head.writeUInt16LE(1, 2)
head.writeUInt16LE(imgs.length, 4)
let offset = head.length
imgs.forEach((b, i) => {
  const e = 6 + 16 * i
  head.writeUInt8(sizes[i], e)
  head.writeUInt8(sizes[i], e + 1)
  head.writeUInt16LE(1, e + 4)
  head.writeUInt16LE(32, e + 6)
  head.writeUInt32LE(b.length, e + 8)
  head.writeUInt32LE(offset, e + 12)
  offset += b.length
})
writeFileSync(join(pub, 'favicon.ico'), Buffer.concat([head, ...imgs]))

/* ---------- share cards (1200×630) ---------- */
// [file, command, heading, line under it]
const cards = [
  ['default', 'whoami', 'Sammy Ibeh', 'Senior developer at the Government Digital Service, London.'],
  ['about', 'cat about.md', 'About me', 'Senior developer at GDS. Before that, a CTO.'],
  ['experience', 'git log --graph career', 'Where I’ve worked', 'A career, as a git log.'],
  ['contact', './contact', 'Get in touch', 'hello@sammyibeh.com'],
]
const font = (family, file) =>
  `@font-face{font-family:'${family}';src:url('file://${pub}fonts/${file}') format('woff2');font-weight:100 900}`
const html = ([, cmd, h, sub]) => `<!doctype html><meta charset="utf-8"><style>
${font('Inter', 'inter-latin.woff2')}${font('JetBrains Mono', 'jetbrains-mono-latin.woff2')}
*{margin:0;box-sizing:border-box}
body{width:1200px;height:630px;background:#0c1220;color:#e8e1d4;font-family:'JetBrains Mono';position:relative;overflow:hidden;
  background-image:linear-gradient(rgba(169,161,150,.06) 1px,transparent 1px),linear-gradient(90deg,rgba(169,161,150,.06) 1px,transparent 1px);background-size:40px 40px}
.band{position:absolute;inset:0;background:linear-gradient(100deg,#ffc163,#ff7a45);clip-path:polygon(100% 62%,100% 100%,58% 100%)}
.win{position:absolute;left:72px;top:64px;width:1056px;border:1px solid #242e42;border-radius:14px;background:#141c2d;box-shadow:0 30px 60px -30px rgba(0,0,0,.6)}
.bar{display:flex;gap:10px;align-items:center;padding:16px 20px;border-bottom:1px solid #242e42;color:#a9a196;font-size:20px}
.bar i{width:14px;height:14px;border-radius:50%;background:#242e42}.bar span{margin-left:12px}
.body{padding:40px 44px 48px}
.p{font-size:28px;color:#a9a196}.p b{color:#fff4e0;font-weight:400}
h1{font-size:80px;line-height:1.05;font-weight:800;color:#ffb547;margin:22px 0 22px;letter-spacing:-.02em}
h1::after{content:'';display:inline-block;width:.5em;height:.9em;background:#ff8a5b;vertical-align:-.1em;margin-left:14px}
.sub{font:500 30px/1.4 Inter;color:#e8e1d4}
.logo{position:absolute;left:72px;bottom:52px;font-size:34px;font-weight:500;color:#ffb547}.logo .br{color:#c79a63}.logo .d{color:#e8e1d4;font-weight:800}
</style><div class="band"></div>
<div class="win"><div class="bar"><i></i><i></i><i></i><span>sammy@ibeh: ~</span></div>
<div class="body"><p class="p">sammy@ibeh:~$ <b>${cmd}</b></p><h1>${h}</h1><p class="sub">${sub}</p></div></div>
<p class="logo"><span class="br">{</span>sammyibeh.<span class="d">dev</span><span class="br">}</span></p>`

const chrome = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const tmp = mkdtempSync(join(tmpdir(), 'og-'))
mkdirSync(join(pub, 'og'), { recursive: true })
for (const card of cards) {
  const page = join(tmp, `${card[0]}.html`)
  writeFileSync(page, html(card))
  const shot = join(tmp, `${card[0]}.png`)
  execFileSync(chrome, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--allow-file-access-from-files', '--window-size=1200,630', '--virtual-time-budget=2000', `--screenshot=${shot}`, `file://${page}`], { stdio: 'ignore' })
  // palette-quantised PNG: flat colours, so this is visually lossless and a fraction of the size
  await sharp(shot).png({ palette: true, quality: 90 }).toFile(join(pub, 'og', `${card[0]}.png`))
}
console.log('icons and share cards written to public/')
