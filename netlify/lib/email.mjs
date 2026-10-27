// One HTML template for every email the site sends: the site's "Shell" as a terminal-window card, Night Lamp palette.
// Email-client rules: tables + inline styles, bgcolor attributes as well as CSS (Outlook), no web fonts, no images, no JS.
// Callers pass trusted markup built from these helpers; every visitor-supplied string must go through esc() first.

export const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])

const C = { ink: '#0c1220', panel: '#141c2d', bar: '#080d17', line: '#242e42', tx: '#e8e1d4', mu: '#a9a196', ac: '#ffb547', ac2: '#ff8a5b', brace: '#c79a63' }
const MONO = "Menlo,Consolas,'Courier New',monospace"
const SANS = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif"

/** Body copy. */
export const p = html => `<p class="tx" style="margin:0 0 16px;font:15px/1.6 ${SANS};color:${C.tx}">${html}</p>`

/** CLI-style rows like the contact form: `? label › value`. rows = [[label, valueHtml], …] */
export const prompts = rows =>
  `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 8px">${rows
    .map(
      ([k, v]) =>
        `<tr><td class="ac2" style="padding:5px 0;font:14px/1.6 ${MONO};color:${C.ac2};white-space:nowrap;vertical-align:top;width:1%">? <span class="ac" style="color:${C.ac}">${k}</span> <span class="mu" style="color:${C.mu}">&#8250;</span></td><td class="tx" style="padding:5px 0 5px 12px;font:15px/1.6 ${SANS};color:${C.tx};word-break:break-word">${v}</td></tr>`
    )
    .join('')}</table>`

/** A quoted block for free text (the visitor's message). html must already be escaped. */
export const block = html =>
  `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:12px 0 24px"><tr><td class="tx" bgcolor="${C.ink}" style="padding:16px 18px;background:${C.ink};border-left:3px solid ${C.ac};border-radius:4px;font:15px/1.6 ${SANS};color:${C.tx};white-space:pre-wrap;word-break:break-word">${html}</td></tr></table>`

/** Bulletproof-ish button: a bordered cell, so it still reads as a button if a client drops the fill. */
export const button = (href, label, primary = true) =>
  `<table role="presentation" cellpadding="0" cellspacing="0" style="display:inline-table;margin:0 8px 10px 0"><tr><td class="${primary ? 'btn' : 'btn2'}" bgcolor="${primary ? C.ac : C.panel}" style="border-radius:6px;border:1px solid ${primary ? C.ac : C.ac2}"><a href="${href}" style="display:inline-block;padding:12px 20px;font:bold 15px/1.2 ${MONO};color:${primary ? C.ink : C.ac2};text-decoration:none;border-radius:6px">${label}</a></td></tr></table>`

/** A small monospace line for raw links and notes. */
export const note = html => `<p class="mu" style="margin:8px 0 0;font:12px/1.6 ${MONO};color:${C.mu};word-break:break-all">${html}</p>`

/** The whole document. path is the title bar (`sammy@ibeh: ~/contact`), heading follows a `$` prompt. */
export const shell = ({ path, heading, preheader = '', body, footer }) => `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark light"><meta name="supported-color-schemes" content="dark light"><title>${heading}</title>
<style>
:root{color-scheme:dark light;supported-color-schemes:dark light}
@media (max-width:620px){.pad{padding:22px 18px!important}.outer{padding:0!important}.card{border-radius:0!important;border-left:0!important;border-right:0!important}}
/* Outlook.com/app dark-mode and forced-colour rewrites mark the nodes they touch with data-ogsc: keep text on a light ground readable */
[data-ogsc] .tx{color:#2d251d!important}[data-ogsc] .mu{color:#6a5b4b!important}[data-ogsc] .ac{color:#a3500b!important}[data-ogsc] .ac2{color:#b4441b!important}[data-ogsc] .btn a{color:#18120c!important}[data-ogsc] .btn2 a{color:#b4441b!important}
</style></head>
<body style="margin:0;padding:0;background:${C.ink}" bgcolor="${C.ink}">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:${C.ink}">${preheader}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="${C.ink}" style="background:${C.ink}"><tr><td class="outer" align="center" style="padding:28px 12px">
<table role="presentation" class="card" width="100%" cellpadding="0" cellspacing="0" bgcolor="${C.panel}" style="max-width:600px;background:${C.panel};border:1px solid ${C.line};border-radius:10px">
<tr><td class="mu" bgcolor="${C.bar}" style="background:${C.bar};padding:10px 16px;border-bottom:1px solid ${C.line};border-radius:10px 10px 0 0;font:12px/1.4 ${MONO};color:${C.mu}"><span aria-hidden="true" style="color:${C.ac2}">&#9679;</span> <span aria-hidden="true" style="color:${C.ac}">&#9679;</span> <span aria-hidden="true" style="color:${C.line}">&#9679;</span>&nbsp;&nbsp;${path}</td></tr>
<tr><td class="pad" style="padding:30px 32px 18px">
<p style="margin:0 0 22px;font:bold 17px/1 ${MONO};color:${C.tx}" class="tx"><span aria-hidden="true"><span style="color:${C.brace}">{</span><span class="ac" style="color:${C.ac}">&#9646;</span><span style="color:${C.brace}">}</span>&nbsp;</span>sammyibeh.<span class="ac" style="color:${C.ac}">dev</span></p>
<h1 class="tx" style="margin:0 0 20px;font:bold 19px/1.4 ${MONO};color:${C.tx}"><span class="mu" aria-hidden="true" style="color:${C.mu}">$ </span>${heading}</h1>
${body}
</td></tr>
<tr><td class="pad mu" style="padding:14px 32px 18px;border-top:1px solid ${C.line};font:12px/1.6 ${MONO};color:${C.mu}">${footer}</td></tr>
</table></td></tr></table></body></html>`
