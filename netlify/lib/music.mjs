// Apple Music "now playing": shared by the poller, the public read endpoint and the private sign-in endpoint.
// Everything takes its dependencies (store, fetch, env, clock, notifier) as arguments so it can be tested offline.
import { createHash, createHmac, randomUUID, timingSafeEqual } from 'node:crypto'

export const KEYS = { user: 'user-token', now: 'now', state: 'state', lease: 'refresh-lease' }
export const NOW_WINDOW = 8 * 60e3 // the top track changed this recently → "on repeat"
export const STALE = 24 * 3600e3 // older than this → hide the pill
export const FRESH = 60e3 // /api/now-playing asks Apple at most once per this, however many visitors
// Attempts per hour. Tradeoff, chosen on purpose: brute force is already infeasible (32+ random characters), so these
// limits are cost control. A client over its limit is refused before its secret is evaluated, which means someone
// sharing the owner's IP could lock the owner out, for one window at most. The global ceiling counts failures only.
export const LIMITS = { perClient: 10, global: 200, window: 3600e3 }
export const SITE_ORIGIN = 'https://sammyibeh.dev'
export const MIN_SECRET = 32 // `openssl rand -base64 32` gives 44
const API = 'https://api.music.apple.com/v1/me/recent/played/tracks?types=songs,library-songs&limit=1'

const b64url = buf => Buffer.from(buf).toString('base64url')

/** ES256 developer token signed with the MusicKit .p8 key (PKCS#8 PEM). WebCrypto already returns JWS-style r||s. */
export async function mintDevToken({ teamId, keyId, privateKey }, { ttl = 3600, now = Date.now(), origin } = {}) {
  const pem = privateKey.replace(/\\n/g, '\n').replace(/-----[^-]+-----|\s/g, '')
  const key = await crypto.subtle.importKey('pkcs8', Buffer.from(pem, 'base64'), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign'])
  const iat = Math.floor(now / 1000)
  const head = b64url(JSON.stringify({ alg: 'ES256', kid: keyId }))
  const body = b64url(JSON.stringify({ iss: teamId, iat, exp: iat + ttl, ...(origin && { origin }) }))
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, Buffer.from(`${head}.${body}`))
  return `${head}.${body}.${b64url(sig)}`
}

export const appleConfig = env =>
  env.APPLE_TEAM_ID && env.APPLE_KEY_ID && env.APPLE_MUSIC_PRIVATE_KEY
    ? { teamId: env.APPLE_TEAM_ID, keyId: env.APPLE_KEY_ID, privateKey: env.APPLE_MUSIC_PRIVATE_KEY }
    : null

/** Constant-time secret check. Hashing first makes the lengths equal; an unset or short secret never matches. */
export function secretOk(given, expected) {
  if (typeof given !== 'string' || typeof expected !== 'string' || expected.length < MIN_SECRET) return false
  const h = s => createHash('sha256').update(s).digest()
  return timingSafeEqual(h(given), h(expected))
}

/** One recently-played item → what we store. */
export function shapeTrack(item) {
  const a = item?.attributes
  if (!a?.name) return null
  return {
    id: item.id,
    track: a.name,
    artist: a.artistName || '',
    album: a.albumName || '',
    art: a.artwork?.url?.replace('{w}', '300').replace('{h}', '300') || null,
    url: /^https:\/\/music\.apple\.com\//.test(a.url) ? a.url : null, // library-only songs have no catalogue link; only trust Apple links
  }
}

export async function fetchRecent({ devToken, userToken, fetch, timeout = 8000 }) {
  const res = await fetch(API, { headers: { Authorization: `Bearer ${devToken}`, 'Music-User-Token': userToken }, signal: AbortSignal.timeout(timeout) })
  const data = res.ok ? await res.json() : null
  return { status: res.status, retryAfter: Number(res.headers.get('retry-after')) || 0, item: shapeTrack(data?.data?.[0]) }
}

/** Keep firstSeenAt while the top track is unchanged: that's our only clue to when it was played. */
export async function saveTrack(store, item, now) {
  const prev = await store.get(KEYS.now, { type: 'json' })
  const firstSeenAt = prev?.id === item.id ? prev.firstSeenAt : new Date(now).toISOString()
  await store.setJSON(KEYS.now, { ...item, firstSeenAt, lastCheckedAt: new Date(now).toISOString() })
}

/** Scheduled poll. Returns a short status string for the logs. */
export async function poll({ store, env, fetch, notifier, now = Date.now(), timeout }) {
  const cfg = appleConfig(env)
  if (!cfg) return 'unconfigured'
  const state = (await store.get(KEYS.state, { type: 'json' })) || {}
  if (state.expired) return 'expired' // nothing to do until the owner signs in again
  if (state.backoffUntil && now < state.backoffUntil) return 'backoff'
  const userToken = await store.get(KEYS.user)
  if (!userToken) return 'no-user-token'

  let r
  try {
    r = await fetchRecent({ devToken: await mintDevToken(cfg, { now }), userToken, fetch, timeout })
  } catch (e) {
    return `network-error: ${e.message}`
  }
  if (r.status === 401 || r.status === 403) {
    const strikes = (state.strikes || 0) + 1
    // the owner may have signed in again while this poll was running: that new token isn't expired
    if ((await store.get(KEYS.user)) !== userToken) return 'token-replaced'
    if (strikes < 2) {
      await store.setJSON(KEYS.state, { ...state, strikes }) // one blip isn't an expiry
      return 'auth-failed-once'
    }
    // persist first, so a failing alert can never cause a second alert for the same expiry
    const expired = { expired: true, expiredAt: new Date(now).toISOString() }
    await store.setJSON(KEYS.state, expired)
    const alerts = await notifier.expired(`${env.URL || SITE_ORIGIN}/music-auth/`)
    await store.setJSON(KEYS.state, { ...expired, alerts })
    return 'expired'
  }
  if (r.status === 429) {
    const wait = r.retryAfter ? r.retryAfter * 1000 : Math.min(2 * (state.backoffMs || 5 * 60e3), 6 * 3600e3)
    await store.setJSON(KEYS.state, { ...state, backoffUntil: now + wait, backoffMs: wait })
    return 'rate-limited'
  }
  if (r.status !== 200) return `apple-${r.status}`
  if (state.backoffMs || state.strikes) await store.setJSON(KEYS.state, {})
  if (r.item) await saveTrack(store, r.item, now)
  return 'ok'
}

/** On-demand revalidation for /api/now-playing: one poll() when the cache is older than FRESH, guarded by a lease
    (compare-and-swap on one blob, strong consistency) so concurrent visitors never add Apple calls. poll() keeps the
    expiry, backoff and strike rules; the short timeout keeps a slow Apple from holding up the page. */
export async function refresh({ store, now = Date.now(), timeout = 2500, ...deps }) {
  const t = await store.get(KEYS.now, { type: 'json' })
  if (t && now - Date.parse(t.lastCheckedAt) < FRESH) return 'fresh'
  const lease = await store.getWithMetadata(KEYS.lease, { type: 'text' })
  if (lease && now - Number(lease.data) < FRESH) return 'leased'
  const { modified } = await store.set(KEYS.lease, String(now), lease ? { onlyIfMatch: lease.etag } : { onlyIfNew: true })
  return modified ? poll({ ...deps, store, now, timeout }) : 'leased'
}

/** What /api/now-playing returns. Reads Blobs only; only these fields ever leave the server. */
export async function readNowPlaying({ store, now = Date.now() }) {
  const state = (await store.get(KEYS.state, { type: 'json' })) || {}
  const t = await store.get(KEYS.now, { type: 'json' })
  if (state.expired || !t) return null
  const seen = Date.parse(t.firstSeenAt)
  if (now - Date.parse(t.lastCheckedAt) > STALE || now - seen > STALE) return null
  return { track: t.track, artist: t.artist, album: t.album, art: t.art, url: t.url, nowPlaying: now - seen < NOW_WINDOW, playedAt: t.firstSeenAt }
}

const TOKEN_RE = /^[A-Za-z0-9+/=._-]{20,4096}$/

/* Attempt counting. Each attempt reserves its own blob (fails/<client>/<ms>-<uuid>), so concurrent attempts never
   overwrite each other's count; counting is a list() over the window, and old entries are pruned. */
const clientKey = (ip, secret) => createHmac('sha256', secret).update(ip).digest('hex').slice(0, 16)
const failedAt = key => Number(key.slice(key.lastIndexOf('/') + 1).split('-')[0])
async function countFailures(store, prefix, since, prune = false) {
  const { blobs } = await store.list({ prefix })
  const old = blobs.filter(b => failedAt(b.key) < since)
  if (prune) await Promise.all(old.map(b => store.delete(b.key)))
  return blobs.length - old.length
}
async function clearFailures(store, client) {
  const { blobs } = await store.list({ prefix: `fails/${client}/` })
  await Promise.all(blobs.map(b => store.delete(b.key)))
}

/** The private sign-in endpoint: {secret, action: 'devtoken' | 'store', token?}. Returns [status, body]. */
export async function authorize({ body, store, env, fetch, notifier, ip, now = Date.now() }) {
  const cfg = appleConfig(env)
  if (!cfg || !env.MUSIC_AUTH_SECRET || env.MUSIC_AUTH_SECRET.length < MIN_SECRET) return [503, { error: 'not configured' }]
  if (!ip) return [400, { error: 'missing client address' }] // never pool unknown callers into one shared bucket
  const tooMany = [429, { error: 'too many attempts, try again later' }]
  const client = clientKey(ip, env.MUSIC_AUTH_SECRET)
  const since = now - LIMITS.window
  // reserve this attempt before looking at the secret, so concurrent requests all count each other
  const attempt = `fails/${client}/${now}-${randomUUID()}`
  await store.set(attempt, '')
  if ((await countFailures(store, `fails/${client}/`, since)) > LIMITS.perClient) {
    await store.delete(attempt) // refused without evaluating the secret; don't let refusals pile up
    return tooMany
  }
  // a wrong secret leaves the reservation in place as the failure record
  if (!secretOk(body?.secret, env.MUSIC_AUTH_SECRET)) return (await countFailures(store, 'fails/', since, true)) > LIMITS.global ? tooMany : [401, { error: 'wrong secret' }]
  await clearFailures(store, client) // includes this attempt's reservation
  // for MusicKit JS in the browser: short-lived and only usable from the site itself
  if (body.action === 'devtoken') return [200, { token: await mintDevToken(cfg, { now, origin: [SITE_ORIGIN] }) }]
  if (body.action !== 'store') return [400, { error: 'unknown action' }]
  if (typeof body.token !== 'string' || !TOKEN_RE.test(body.token)) return [400, { error: 'bad token' }]

  // prove the token works before keeping it
  const r = await fetchRecent({ devToken: await mintDevToken(cfg, { now }), userToken: body.token, fetch })
  if (r.status !== 200) return [400, { error: `Apple rejected the token (${r.status})` }]
  const state = (await store.get(KEYS.state, { type: 'json' })) || {}
  await store.set(KEYS.user, body.token)
  await store.setJSON(KEYS.state, {})
  if (r.item) await saveTrack(store, r.item, now)
  if (state.alerts) await notifier.resolved(state.alerts)
  return [200, { ok: true, track: r.item ? `${r.item.track} — ${r.item.artist}` : null }]
}

// ---- HTTP handlers (the files in netlify/functions only wire in the real store, fetch and env) ----

export const NOW_HEADERS = {
  'Content-Type': 'application/json',
  'Cache-Control': 'public, max-age=15',
  'Netlify-CDN-Cache-Control': 'public, s-maxage=15, stale-while-revalidate=30', // visitors share one fresh answer
  'Netlify-Vary': 'query=_', // cache key ignores every real query string, so ?x=random can't reach the function
}

export async function nowPlayingResponse(deps) {
  let body = null
  if (deps.env)
    try {
      const r = await refresh(deps)
      if (r !== 'fresh') console.log('now-playing refresh:', r)
    } catch (e) {
      console.error('now-playing refresh:', e.message) // serve the cache below
    }
  try {
    body = await readNowPlaying(deps)
  } catch (e) {
    console.error('now-playing:', e.message) // Blobs unavailable: the pill just hides
  }
  return new Response(JSON.stringify(body), { headers: NOW_HEADERS })
}

const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } })

export async function authResponse(req, deps, { failDelay = 750 } = {}) {
  if (req.method !== 'POST') return json(405, { error: 'POST only' })
  const raw = await req.text()
  if (raw.length > 8192) return json(413, { error: 'too large' })
  let body
  try {
    body = JSON.parse(raw)
  } catch {
    return json(400, { error: 'bad json' })
  }
  const [status, out] = await authorize({ ...deps, body, ip: req.headers.get('x-nf-client-connection-ip') })
  if (status === 401) await new Promise(r => setTimeout(r, failDelay)) // slows guessing; not on 429, which would only add billed time
  return json(status, out)
}
