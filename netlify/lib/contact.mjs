// Emails the owner a verified contact-form submission via Resend. Everything in the payload is
// visitor-supplied: fields are length-capped, HTML-escaped, and anything bound for a header is one line.
import { resend } from './notify.mjs'
import { esc, shell, prompts, block, button } from './email.mjs'

const MAX = { name: 100, email: 254, phone: 40, message: 5000 }
const field = (d, k) => String(d?.[k] ?? '').trim().slice(0, MAX[k])
export const oneLine = s => s.replace(/[\x00-\x1f\x7f\u2028\u2029]+/g, ' ').trim() // no CR/LF or other controls in headers
export const validEmail = s => /^[^\s@<>()[\]\\,;:"]+@[^\s@<>()[\]\\,;:"]+\.[^\s@<>()[\]\\,;:"]+$/.test(s) // plain addr-spec only, no display names

/** Subject, text, html and replyTo (or null) for one submission's data. */
export function compose(data, createdAt) {
  const name = oneLine(field(data, 'name')) || 'someone', email = oneLine(field(data, 'email')), phone = oneLine(field(data, 'phone'))
  const message = field(data, 'message'), replyTo = validEmail(email) ? email : null
  const at = new Date(createdAt), when = `${(isNaN(at) ? new Date() : at).toLocaleString('en-GB', { timeZone: 'Europe/London', dateStyle: 'medium', timeStyle: 'short' })} (London)`
  const wa = /^(\+|00)/.test(phone) ? `https://wa.me/${phone.replace(/\D/g, '').replace(/^00/, '')}` : null // only international numbers make a working wa.me link
  const text = [`Name: ${name}`, `Email: ${email}${replyTo ? '' : ' (not a valid address)'}`, ...(phone ? [`WhatsApp: ${phone}${wa ? ` (${wa})` : ''}`] : []), `Sent: ${when}`, '', message].join('\n')
  const link = (href, text) => `<a href="${esc(href)}" style="color:inherit">${esc(text)}</a>`
  const html = shell({
    path: 'sammy@ibeh: ~/contact',
    heading: `new message from ${esc(name)}`,
    preheader: esc(message.slice(0, 120)),
    body:
      prompts([
        ['name', esc(name)],
        ['email', replyTo ? link(`mailto:${email}`, email) : `${esc(email)} <span class="mu" style="color:#a9a196">(not a valid address)</span>`],
        ...(phone ? [['whatsapp', wa ? link(wa, phone) : esc(phone)]] : []),
      ]) +
      block(esc(message)) +
      (replyTo ? button(`mailto:${email}?subject=${encodeURIComponent('Re: your message on sammyibeh.dev')}`, `Reply to ${esc(name)}`) : '') +
      (wa ? button(wa, `WhatsApp ${esc(name)}`, false) : ''),
    footer: `sent ${esc(when)} · via the contact form on sammyibeh.dev`,
  })
  return { subject: `sammyibeh.dev: message from ${name}`, text: `${text}\n`, html, replyTo }
}

/** Handles one submission-created payload. Never throws: Netlify has already stored the submission.
    store (optional) remembers sent submission ids so a redelivered event doesn't email twice; if Blobs fails we still send. */
export async function handleSubmission(payload, env, fetch = globalThis.fetch, store = null) {
  try {
    if ((payload?.form_name ?? payload?.data?.['form-name']) !== 'contact') return 'ignored'
    if (payload.data?.['bot-field']) return 'spam'
    const send = resend({ apiKey: env.RESEND_API_KEY, to: env.ALERT_EMAIL_TO, from: env.ALERT_EMAIL_FROM || undefined, fetch })
    if (!send) return 'skipped: RESEND_API_KEY or ALERT_EMAIL_TO not set'
    const id = typeof payload.id === 'string' && /^[\w-]{1,64}$/.test(payload.id) ? payload.id : null
    if (store && id && (await store.get(id).catch(() => null))) return 'duplicate'
    const m = compose(payload.data, payload.created_at)
    await send(m.subject, m.text, m.html, m.replyTo)
    if (store && id) await store.set(id, '1').catch(e => console.error('contact dedupe:', e.message))
    return 'sent'
  } catch (e) {
    console.error('contact email failed:', e.message) // no visitor data in logs
    return 'failed'
  }
}
