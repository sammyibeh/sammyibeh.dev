import { test } from 'node:test'
import assert from 'node:assert/strict'
import { compose, handleSubmission, validEmail } from '../netlify/lib/contact.mjs'

const ENV = { RESEND_API_KEY: 're_test', ALERT_EMAIL_TO: 'me@example.com', ALERT_EMAIL_FROM: 'site@example.com' }
const mockResend = (status = 200) => {
  const calls = []
  const f = async (url, init) => { calls.push({ url, body: JSON.parse(init.body) }); return { ok: status < 300, status } }
  return { f, calls }
}
const payload = (data, form_name = 'contact') => ({ form_name, created_at: '2026-10-27T09:30:00Z', data: { name: 'Ada', email: 'ada@example.com', message: 'hi', ...data } })

test('contact email: sends to the owner with subject, Reply-To and every field', async () => {
  const { f, calls } = mockResend()
  assert.equal(await handleSubmission(payload({ phone: '+44 7700 900123' }), ENV, f), 'sent')
  const b = calls[0].body
  assert.equal(calls[0].url, 'https://api.resend.com/emails')
  assert.deepEqual([b.from, b.to, b.subject, b.reply_to], ['site@example.com', ['me@example.com'], 'sammyibeh.dev: message from Ada', 'ada@example.com'])
  assert.match(b.text, /WhatsApp: \+44 7700 900123 \(https:\/\/wa\.me\/447700900123\)/)
  assert.match(b.text, /27 Oct 2026, 09:30 \(London\)/)
  assert.match(b.html, /href="https:\/\/wa\.me\/447700900123"/)
  assert.match(compose({ phone: '0044 7700 900123' }).text, /wa\.me\/447700900123\)/)
  assert.doesNotMatch(compose({ phone: '07700 900123' }).text, /wa\.me/) // national format: shown, not linked
})

test('contact email: HTML-escapes every visitor field inside the template', () => {
  const x = '<img src=x onerror=alert(1)>"\'&'
  for (const k of ['name', 'email', 'phone', 'message']) {
    const { html } = compose({ name: 'Ada', email: 'ada@example.com', phone: '+44 7700 900123', message: 'hi', [k]: x })
    assert.ok(!html.includes('<img') && !html.includes('"\'&'), k) // never raw, never able to close an attribute
    assert.ok(html.includes('&lt;img src=x onerror=alert(1)&gt;&quot;&#39;&amp;'), k) // shown, escaped
  }
  const { html } = compose({ name: x, email: 'ada@example.com', phone: '+44 7700 900123', message: x })
  assert.match(html, /^<!doctype html>/)
  assert.match(html, /href="mailto:ada@example\.com\?subject=Re%3A%20your%20message%20on%20sammyibeh\.dev"/) // Reply button
  assert.match(html, /href="https:\/\/wa\.me\/447700900123"/) // WhatsApp button
  assert.ok(!/<script|<link|<img|@import|url\(/i.test(html)) // no JS, external CSS or remote images
})

test('contact email: no CR/LF reaches a header, and Reply-To must be a plain address', async () => {
  const { f, calls } = mockResend()
  await handleSubmission(payload({ name: 'Eve\r\nBcc: victim@example.com', email: 'eve@example.com\r\nBcc: victim@example.com' }), ENV, f)
  const b = calls[0].body
  assert.ok(!/[\r\n]/.test(b.subject), b.subject)
  assert.equal(b.reply_to, undefined) // injected address is not valid, so no Reply-To at all
  for (const bad of ['', 'nope', 'a@b', 'Eve <eve@example.com>', 'a@b.com, c@d.com', 'a b@c.com']) assert.equal(validEmail(bad), false, bad)
  assert.equal(validEmail('first.last+tag@sub.example.co.uk'), true)
})

test('contact email: caps field lengths', () => {
  const { subject, text } = compose({ name: 'n'.repeat(500), email: 'a@b.co', message: 'm'.repeat(20000) })
  assert.ok(subject.length < 140)
  assert.ok(text.length < 5400)
})

test('contact email: a redelivered submission id sends once; a broken store still sends', async () => {
  const m = new Map(), store = { get: async k => m.get(k) ?? null, set: async (k, v) => void m.set(k, v) }
  const { f, calls } = mockResend()
  const p = { ...payload({}), id: '5f2a9c' }
  assert.equal(await handleSubmission(p, ENV, f, store), 'sent')
  assert.equal(await handleSubmission(p, ENV, f, store), 'duplicate')
  const broken = { get: async () => { throw new Error('blobs down') }, set: async () => { throw new Error('blobs down') } }
  const orig = console.error; console.error = () => {}
  try { assert.equal(await handleSubmission(p, ENV, f, broken), 'sent') } finally { console.error = orig }
  assert.equal(calls.length, 2)
})

test('contact email: ignores other forms and honeypot hits, skips without env, never throws', async () => {
  const { f, calls } = mockResend()
  assert.equal(await handleSubmission(payload({}, 'newsletter'), ENV, f), 'ignored')
  assert.equal(await handleSubmission(undefined, ENV, f), 'ignored')
  assert.equal(await handleSubmission(payload({ 'bot-field': 'x' }), ENV, f), 'spam')
  assert.match(await handleSubmission(payload({}), { RESEND_API_KEY: 're_test' }, f), /^skipped/)
  assert.match(await handleSubmission(payload({}), {}, f), /^skipped/)
  assert.equal(calls.length, 0)
  assert.equal(await handleSubmission(payload({}), ENV, mockResend(500).f), 'failed')
  assert.equal(await handleSubmission(payload({}), ENV, async () => { throw new Error('network') }), 'failed')
})
