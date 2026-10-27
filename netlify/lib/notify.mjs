// How the owner hears that Apple Music sign-in expired, and that it's fixed. A channel is
// { name, expired(link) → ref, resolved(ref) }; a channel whose env vars are missing is simply left out.
// One failing channel is logged and never blocks the others.
import { esc, shell, prompts, p, button, note } from './email.mjs'

export function githubChannel({ token, repo = 'sammyibeh/sammyibeh.dev', fetch = globalThis.fetch }) {
  if (!token) return null
  const gh = (path, method, body) =>
    fetch(`https://api.github.com/repos/${repo}${path}`, {
      method,
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' },
      body: JSON.stringify(body),
    }).then(r => {
      if (!r.ok) throw new Error(`${method} ${path}: ${r.status}`)
      return r.json()
    })
  return {
    name: 'github',
    async expired(link) {
      const body = `The now-playing pill on the site is hidden until you sign in again.\n\nRe-auth: ${link}\n\nThis issue closes itself once you have.`
      return (await gh('/issues', 'POST', { title: 'Apple Music sign-in expired', body })).number
    },
    resolved: number => gh(`/issues/${number}`, 'PATCH', { state: 'closed', state_reason: 'completed' }),
  }
}

/** A Resend sender to the owner, or null when the env vars are missing. replyTo must already be validated. */
export function resend({ apiKey, to, from = 'onboarding@resend.dev', fetch = globalThis.fetch }) {
  if (!apiKey || !to) return null
  return (subject, text, html, replyTo) =>
    fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: [to], subject, text, html, ...(replyTo && { reply_to: replyTo }) }),
    }).then(r => {
      if (!r.ok) throw new Error(`Resend: ${r.status}`)
      return true
    })
}

export function emailChannel(opts) {
  const send = resend(opts)
  if (!send) return null
  return {
    name: 'email',
    expired: link =>
      send(
        'sammyibeh.dev: Apple Music sign-in expired',
        `Apple Music sign-in for sammyibeh.dev has expired, so the now-playing pill is hidden.\n\nSign in again: ${link}\n`,
        shell({
          path: 'sammy@ibeh: ~/music',
          heading: 'apple music sign-in expired',
          preheader: 'The now-playing pill is hidden until you sign in again.',
          body: prompts([['status', 'signed out'], ['pill', 'hidden']]) + p('Apple Music sign-in for sammyibeh.dev has expired, so the now-playing pill is hidden until you sign in again.') + button(esc(link), 'Sign in to Apple Music again') + note(`or open ${esc(link)}`),
          footer: 'automated alert from sammyibeh.dev',
        })
      ),
    resolved: () =>
      send(
        'sammyibeh.dev: Apple Music reconnected',
        'Apple Music is connected again. Nothing else to do.\n',
        shell({
          path: 'sammy@ibeh: ~/music',
          heading: 'apple music reconnected',
          preheader: 'The now-playing pill is back. Nothing else to do.',
          body: prompts([['status', 'connected'], ['pill', 'back on the site']]) + p('Apple Music is connected again and the now-playing pill is back. Nothing else to do.'),
          footer: 'automated alert from sammyibeh.dev',
        })
      ),
  }
}

/** Runs every configured channel; returns { [name]: ref } for the ones that worked. */
export function notifier(channels) {
  const live = channels.filter(Boolean)
  const each = async (fn, refs = {}) => {
    const out = {}
    await Promise.all(
      live.map(async c => {
        try {
          out[c.name] = await fn(c, refs[c.name])
        } catch (e) {
          console.error(`notify ${c.name}:`, e.message)
        }
      })
    )
    return out
  }
  return {
    expired: link => each(c => c.expired(link)),
    resolved: refs => each((c, ref) => (ref ? c.resolved(ref) : undefined), refs),
  }
}

/** The channels configured in this environment. */
export const fromEnv = env =>
  notifier([
    githubChannel({ token: env.GITHUB_ISSUES_TOKEN, repo: env.GITHUB_ISSUES_REPO || undefined }),
    emailChannel({ apiKey: env.RESEND_API_KEY, to: env.ALERT_EMAIL_TO, from: env.ALERT_EMAIL_FROM || undefined }),
  ])
