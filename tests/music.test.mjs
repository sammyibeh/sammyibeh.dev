import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mintDevToken, secretOk, poll, readNowPlaying, authorize, shapeTrack, authResponse, nowPlayingResponse, refresh, KEYS, LIMITS } from '../netlify/lib/music.mjs'
import { notifier, githubChannel, emailChannel } from '../netlify/lib/notify.mjs'

// --- fakes -------------------------------------------------------------------------------------
const memStore = (init = {}) => {
  const m = new Map(Object.entries(init).map(([k, v]) => [k, typeof v === 'string' ? v : JSON.stringify(v)]))
  return {
    m,
    async get(k, o) { const v = m.get(k) ?? null; return v !== null && o?.type === 'json' ? JSON.parse(v) : v },
    async set(k, v, o = {}) { // conditional writes like Blobs: the etag is the value itself here
      if ((o.onlyIfNew && m.has(k)) || (o.onlyIfMatch !== undefined && m.get(k) !== o.onlyIfMatch)) return { modified: false }
      m.set(k, v); return { modified: true, etag: v }
    },
    async getWithMetadata(k) { return m.has(k) ? { data: m.get(k), etag: m.get(k), metadata: {} } : null },
    async setJSON(k, v) { m.set(k, JSON.stringify(v)) },
    async delete(k) { m.delete(k) },
    async list({ prefix = '' } = {}) { return { blobs: [...m.keys()].filter(k => k.startsWith(prefix)).map(key => ({ key })) } },
  }
}
const keys = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])
const pem = `-----BEGIN PRIVATE KEY-----\n${Buffer.from(await crypto.subtle.exportKey('pkcs8', keys.privateKey)).toString('base64')}\n-----END PRIVATE KEY-----` // gitleaks:allow: a throwaway key generated above, never a real secret
const SECRET = 'correct horse battery staple, twice over'
const env = { APPLE_TEAM_ID: 'TEAM123456', APPLE_KEY_ID: 'KEY1234567', APPLE_MUSIC_PRIVATE_KEY: pem.replace(/\n/g, '\\n'), MUSIC_AUTH_SECRET: SECRET, URL: 'https://sammyibeh.dev' }
const song = (id = 's1', name = 'Song') => ({ id, type: 'songs', attributes: { name, artistName: 'Band', albumName: 'LP', url: `https://music.apple.com/song/${id}`, artwork: { url: 'https://img/{w}x{h}bb.jpg' } } })
const apple = (status, items = [song()], headers = {}) => {
  const calls = []
  const f = async (url, init) => { calls.push({ url, init }); return new Response(status === 200 ? JSON.stringify({ data: items }) : '', { status, headers }) }
  f.calls = calls
  return f
}
const spyNotifier = () => { const n = { opened: [], closed: [] }; n.expired = async link => (n.opened.push(link), { github: 42 }); n.resolved = async refs => { n.closed.push(refs) }; return n }
const T = Date.parse('2026-10-27T12:00:00Z')

// --- tests -------------------------------------------------------------------------------------
test('developer token: ES256 JWT with kid, iss, iat, exp and a valid signature', async () => {
  const jwt = await mintDevToken({ teamId: 'TEAM', keyId: 'KID', privateKey: pem }, { ttl: 600, now: T })
  const [h, p, s] = jwt.split('.')
  assert.deepEqual(JSON.parse(Buffer.from(h, 'base64url')), { alg: 'ES256', kid: 'KID' })
  assert.deepEqual(JSON.parse(Buffer.from(p, 'base64url')), { iss: 'TEAM', iat: T / 1000, exp: T / 1000 + 600 })
  const ok = await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, keys.publicKey, Buffer.from(s, 'base64url'), Buffer.from(`${h}.${p}`))
  assert.ok(ok)
})

test('secret check', () => {
  assert.ok(secretOk(SECRET, SECRET))
  assert.ok(!secretOk('wrong', SECRET))
  assert.ok(!secretOk(undefined, SECRET))
  assert.ok(!secretOk('', ''))
  assert.ok(!secretOk('short', 'short')) // a weak configured secret never matches
})

test('poll stores the track; firstSeenAt only moves when the top track changes', async () => {
  const store = memStore({ [KEYS.user]: 'user-token-abcdefghijklmnop' })
  const f = apple(200)
  assert.equal(await poll({ store, env, fetch: f, notifier: spyNotifier(), now: T }), 'ok')
  assert.match(f.calls[0].url, /types=songs,library-songs&limit=1/)
  assert.equal(f.calls[0].init.headers['Music-User-Token'], 'user-token-abcdefghijklmnop')
  await poll({ store, env, fetch: apple(200), notifier: spyNotifier(), now: T + 5 * 60e3 })
  const saved = await store.get(KEYS.now, { type: 'json' })
  assert.equal(saved.firstSeenAt, new Date(T).toISOString())
  assert.equal(saved.art, 'https://img/300x300bb.jpg')
  await poll({ store, env, fetch: apple(200, [song('s2', 'Next')]), notifier: spyNotifier(), now: T + 10 * 60e3 })
  assert.equal((await store.get(KEYS.now, { type: 'json' })).firstSeenAt, new Date(T + 10 * 60e3).toISOString())
})

test('nowPlaying / playedAt heuristic and staleness', async () => {
  const store = memStore({ [KEYS.now]: { id: 's1', track: 'Song', artist: 'Band', album: 'LP', art: null, url: 'u', firstSeenAt: new Date(T).toISOString(), lastCheckedAt: new Date(T).toISOString() } })
  assert.equal((await readNowPlaying({ store, now: T + 3 * 60e3 })).nowPlaying, true)
  const later = await readNowPlaying({ store, now: T + 20 * 60e3 })
  assert.equal(later.nowPlaying, false)
  assert.equal(later.playedAt, new Date(T).toISOString())
  assert.equal(await readNowPlaying({ store, now: T + 25 * 3600e3 }), null)
  assert.equal(await readNowPlaying({ store: memStore() }), null)
  await store.setJSON(KEYS.state, { expired: true })
  assert.equal(await readNowPlaying({ store, now: T + 60e3 }), null)
})

test('expiry: two strikes, alerted once, then no more Apple calls until re-auth', async () => {
  const store = memStore({ [KEYS.user]: 'user-token-abcdefghijklmnop' })
  const n = spyNotifier()
  const f = apple(401)
  assert.equal(await poll({ store, env, fetch: f, notifier: n, now: T }), 'auth-failed-once')
  assert.equal(n.opened.length, 0)
  assert.equal(await readNowPlaying({ store, now: T }), null) // (no track yet anyway) but not marked expired
  assert.equal((await store.get(KEYS.state, { type: 'json' })).expired, undefined)
  assert.equal(await poll({ store, env, fetch: f, notifier: n, now: T + 5 * 60e3 }), 'expired')
  assert.equal(await poll({ store, env, fetch: f, notifier: n, now: T + 10 * 60e3 }), 'expired')
  assert.deepEqual(n.opened, ['https://sammyibeh.dev/music-auth/'])
  assert.equal(f.calls.length, 2)
  // re-auth clears it and closes the issue
  const [status] = await authorize({ ip: '192.0.2.1', body: { secret: SECRET, action: 'store', token: 'new-user-token-abcdefghij' }, store, env, fetch: apple(200), notifier: n, now: T + 6e5 })
  assert.equal(status, 200)
  assert.deepEqual(n.closed, [{ github: 42 }])
  assert.deepEqual(await store.get(KEYS.state, { type: 'json' }), {})
  assert.equal(await store.get(KEYS.user), 'new-user-token-abcdefghij')
})

test('429 backs off, and the next poll inside the window skips Apple', async () => {
  const store = memStore({ [KEYS.user]: 'user-token-abcdefghijklmnop' })
  assert.equal(await poll({ store, env, fetch: apple(429, [], { 'retry-after': '120' }), notifier: spyNotifier(), now: T }), 'rate-limited')
  const f = apple(200)
  assert.equal(await poll({ store, env, fetch: f, notifier: spyNotifier(), now: T + 60e3 }), 'backoff')
  assert.equal(f.calls.length, 0)
  assert.equal(await poll({ store, env, fetch: f, notifier: spyNotifier(), now: T + 121e3 }), 'ok')
})

test('auth endpoint: secret required, inputs validated, token checked with Apple', async () => {
  const store = memStore()
  const call = (body, e = env, f = apple(200)) => authorize({ ip: '192.0.2.1', body, store, env: e, fetch: f, notifier: spyNotifier(), now: T })
  assert.equal((await call({ action: 'devtoken' }))[0], 401)
  assert.equal((await call({ secret: 'nope', action: 'devtoken' }))[0], 401)
  assert.equal((await call({ secret: SECRET, action: 'devtoken' }, { ...env, MUSIC_AUTH_SECRET: '' }))[0], 503)
  const [s, out] = await call({ secret: SECRET, action: 'devtoken' })
  assert.equal(s, 200)
  assert.equal(out.token.split('.').length, 3)
  assert.equal((await call({ secret: SECRET, action: 'store', token: 'has spaces in it, not a token' }))[0], 400)
  assert.equal((await call({ secret: SECRET, action: 'store', token: 'rejected-token-abcdefghij' }, env, apple(401)))[0], 400)
  assert.equal(await store.get(KEYS.user), null)
  assert.equal((await call({ secret: SECRET, action: 'nope' }))[0], 400)
})

test('unconfigured: everything is quiet', async () => {
  assert.equal(await poll({ store: memStore(), env: {}, fetch: apple(200), notifier: spyNotifier() }), 'unconfigured')
  assert.equal((await authorize({ ip: '192.0.2.1', body: { secret: SECRET, action: 'devtoken' }, store: memStore(), env: {}, fetch: apple(200), notifier: spyNotifier() }))[0], 503)
})

const recorder = (fail = () => false) => {
  const calls = []
  const f = async (url, init) => {
    calls.push([init.method, url, JSON.parse(init.body)])
    return fail(url) ? new Response('nope', { status: 500 }) : new Response(JSON.stringify({ number: 7, id: 'e1' }))
  }
  f.calls = calls
  return f
}
const LINK = 'https://sammyibeh.dev/music-auth/'

test('both channels fire once per expiry, close/confirm on re-auth, and carry no secrets', async () => {
  const f = recorder()
  const n = notifier([githubChannel({ token: 'gh', fetch: f }), emailChannel({ apiKey: 're', to: 'me@example.com', fetch: f })])
  const store = memStore({ [KEYS.user]: 'user-token-abcdefghijklmnop' })
  await poll({ store, env, fetch: apple(401), notifier: n, now: T }) // strike one: no alert
  await poll({ store, env, fetch: apple(401), notifier: n, now: T + 5 * 60e3 }) // strike two: alert
  await poll({ store, env, fetch: apple(401), notifier: n, now: T + 10 * 60e3 }) // deduped: already expired
  assert.equal(f.calls.length, 2)
  const [issue, mail] = [f.calls.find(c => c[1].includes('github')), f.calls.find(c => c[1].includes('resend'))]
  assert.equal(issue[1], 'https://api.github.com/repos/sammyibeh/sammyibeh.dev/issues')
  assert.match(issue[2].body, /Re-auth: https:\/\/sammyibeh.dev\/music-auth\//)
  assert.equal(mail[2].subject, 'sammyibeh.dev: Apple Music sign-in expired')
  assert.equal(mail[2].from, 'onboarding@resend.dev')
  assert.ok(mail[2].text.includes(LINK) && mail[2].html.includes(LINK))
  assert.ok(!JSON.stringify(f.calls).includes(SECRET))
  assert.deepEqual((await store.get(KEYS.state, { type: 'json' })).alerts, { github: 7, email: true })

  await authorize({ ip: '192.0.2.1', body: { secret: SECRET, action: 'store', token: 'new-user-token-abcdefghij' }, store, env, fetch: apple(200), notifier: n, now: T + 6e5 })
  assert.deepEqual(f.calls.slice(2).map(c => [c[0], c[1]]).sort(), [
    ['PATCH', 'https://api.github.com/repos/sammyibeh/sammyibeh.dev/issues/7'],
    ['POST', 'https://api.resend.com/emails'],
  ])
})

test('a channel without env vars is skipped; a failing channel does not block the other', async () => {
  assert.equal(githubChannel({}), null)
  assert.equal(emailChannel({ apiKey: 'k' }), null)
  assert.deepEqual(await notifier([null, null]).expired(LINK), {})
  const f = recorder(url => url.includes('github'))
  const n = notifier([githubChannel({ token: 'gh', fetch: f }), emailChannel({ apiKey: 're', to: 'me@example.com', fetch: f })])
  const errors = []
  const orig = console.error
  console.error = (...a) => errors.push(a.join(' '))
  try {
    assert.deepEqual(await n.expired(LINK), { email: true })
  } finally {
    console.error = orig
  }
  assert.match(errors[0], /notify github/)
})

// --- security review follow-ups ----------------------------------------------------------------
const post = body => new Request('https://x/api/music-auth', { method: 'POST', body: typeof body === 'string' ? body : JSON.stringify(body), headers: { 'x-nf-client-connection-ip': '192.0.2.1' } })
const deps = (store = memStore(), e = env) => ({ store, env: e, fetch: apple(200), notifier: spyNotifier(), now: T, ip: '192.0.2.1' })

test('auth handler: 405, 413, bad JSON, and no-store on every answer', async () => {
  const cases = [
    [new Request('https://x/api/music-auth'), 405],
    [post('x'.repeat(9000)), 413],
    [post('{not json'), 400],
    [post({ secret: SECRET, action: 'devtoken' }), 200],
  ]
  for (const [req, status] of cases) {
    const res = await authResponse(req, deps(), { failDelay: 0 })
    assert.equal(res.status, status)
    assert.equal(res.headers.get('cache-control'), 'no-store')
  }
})

test('browser developer token: one hour, locked to the site origin; the poller token has no origin', async () => {
  const [, out] = await authorize({ ...deps(), body: { secret: SECRET, action: 'devtoken' } })
  const p = JSON.parse(Buffer.from(out.token.split('.')[1], 'base64url'))
  assert.equal(p.exp - p.iat, 3600)
  assert.deepEqual(p.origin, ['https://sammyibeh.dev'])
  const f = apple(200)
  await poll({ store: memStore({ [KEYS.user]: 'user-token-abcdefghijklmnop' }), env, fetch: f, notifier: spyNotifier(), now: T })
  const server = JSON.parse(Buffer.from(f.calls[0].init.headers.Authorization.split(' ')[1].split('.')[1], 'base64url'))
  assert.equal(server.origin, undefined)
})

const fromIp = (body, ip) => new Request('https://x/api/music-auth', { method: 'POST', body: JSON.stringify(body), headers: { 'x-nf-client-connection-ip': ip } })
const tryAs = (store, ip, secret = 'wrong', now = T) => authResponse(fromIp({ secret, action: 'devtoken' }, ip), { ...deps(store), now }, { failDelay: 0 }).then(r => r.status)

test('over-limit client is refused before its secret is looked at, even a valid one; another client with the valid secret passes', async () => {
  const store = memStore()
  for (let i = 0; i < LIMITS.perClient; i++) assert.equal(await tryAs(store, '203.0.113.9'), 401)
  let read = false
  const body = { action: 'devtoken', get secret() { read = true; return SECRET } }
  assert.equal((await authorize({ ...deps(store), body, ip: '203.0.113.9' }))[0], 429)
  assert.equal(read, false, 'the secret was not evaluated')
  assert.equal(await tryAs(store, '203.0.113.9', SECRET), 429)
  assert.equal(await tryAs(store, '198.51.100.7', SECRET), 200)
  assert.equal(await tryAs(store, '198.51.100.7'), 401) // and a wrong guess from elsewhere is just a 401
  // the window passes: the guesser is back to plain 401s
  assert.equal(await tryAs(store, '203.0.113.9', 'wrong', T + LIMITS.window + 1), 401)
  assert.ok(![...store.m.keys()].some(k => k.includes('203.0.113.9')), 'client addresses are stored hashed')
})

test('the global ceiling caps failures but never blocks the valid secret', async () => {
  const many = memStore()
  for (let i = 0; i < LIMITS.global; i++) await tryAs(many, `10.0.${i >> 8}.${i & 255}`)
  assert.equal(await tryAs(many, '192.0.2.1'), 429) // a fresh address guessing: over the cost ceiling
  assert.equal(await tryAs(many, '192.0.2.2', SECRET), 200) // the owner still gets in
})

test('a configured secret under 32 characters counts as unconfigured', async () => {
  const s31 = 'a'.repeat(31)
  assert.equal((await authorize({ ...deps(memStore(), { ...env, MUSIC_AUTH_SECRET: s31 }), body: { secret: s31, action: 'devtoken' } }))[0], 503)
  assert.equal((await authorize({ ...deps(memStore(), { ...env, MUSIC_AUTH_SECRET: s31 + 'a' }), body: { secret: s31 + 'a', action: 'devtoken' } }))[0], 200)
})

test('now-playing: null when Blobs fails, and only the public fields leave the server', async () => {
  const errors = []
  const orig = console.error
  console.error = (...a) => errors.push(a.join(' '))
  try {
    const res = await nowPlayingResponse({ get store() { throw new Error('MissingBlobsEnvironmentError') } })
    assert.equal(await res.text(), 'null')
  } finally {
    console.error = orig
  }
  assert.equal(errors.length, 1)
  const store = memStore({ [KEYS.now]: { id: 'secret-id', track: 'Song', artist: 'Band', album: 'LP', art: null, url: 'u', firstSeenAt: new Date(T).toISOString(), lastCheckedAt: new Date(T).toISOString(), extra: 'x' } })
  assert.deepEqual(Object.keys(await readNowPlaying({ store, now: T })).sort(), ['album', 'art', 'artist', 'nowPlaying', 'playedAt', 'track', 'url'])
})

test('shapeTrack only keeps Apple Music links', () => {
  const s = url => shapeTrack({ id: '1', attributes: { name: 'n', url } }).url
  assert.equal(s('https://music.apple.com/gb/song/1'), 'https://music.apple.com/gb/song/1')
  assert.equal(s('javascript:alert(1)'), null)
  assert.equal(s('https://music.apple.com.evil.test/x'), null)
  assert.equal(s(undefined), null)
})

test('poll survives a throwing fetch', async () => {
  const store = memStore({ [KEYS.user]: 'user-token-abcdefghijklmnop' })
  const boom = async () => { throw new Error('ECONNRESET') }
  assert.match(await poll({ store, env, fetch: boom, notifier: spyNotifier(), now: T }), /^network-error/)
  assert.equal(await store.get(KEYS.state, { type: 'json' }), null)
})

test('a blip clears after a good poll, and a token replaced mid-poll is never marked expired', async () => {
  const store = memStore({ [KEYS.user]: 'user-token-abcdefghijklmnop' })
  const n = spyNotifier()
  await poll({ store, env, fetch: apple(401), notifier: n, now: T })
  await poll({ store, env, fetch: apple(200), notifier: n, now: T + 5 * 60e3 })
  assert.deepEqual(await store.get(KEYS.state, { type: 'json' }), {})
  await poll({ store, env, fetch: apple(401), notifier: n, now: T + 10 * 60e3 }) // strike one again, not two
  assert.equal(n.opened.length, 0)
  // the owner signs in again while the poll's Apple call is in flight
  const racing = async () => { await store.set(KEYS.user, 'fresh-user-token-abcdefghij'); return new Response('', { status: 401 }) }
  assert.equal(await poll({ store, env, fetch: racing, notifier: n, now: T + 15 * 60e3 }), 'token-replaced')
  assert.notEqual((await store.get(KEYS.state, { type: 'json' })).expired, true)
  assert.equal(n.opened.length, 0)
})

test('expiry is saved before alerting, so a crashing alert cannot alert twice', async () => {
  const store = memStore({ [KEYS.user]: 'user-token-abcdefghijklmnop', [KEYS.state]: { strikes: 1 } })
  const n = { expired: async () => { throw new Error('crash mid-alert') }, resolved: async () => {} }
  await assert.rejects(poll({ store, env, fetch: apple(401), notifier: n, now: T }))
  assert.equal((await store.get(KEYS.state, { type: 'json' })).expired, true)
  assert.equal(await poll({ store, env, fetch: apple(401), notifier: n, now: T + 5 * 60e3 }), 'expired')
})

test('concurrent reservations: a burst from one client cannot get more than the limit of secret checks', async () => {
  const store = memStore()
  let checked = 0
  const body = () => ({ action: 'devtoken', get secret() { checked++; return 'wrong' } })
  // every request reserves before any of them is counted, so they all see each other
  const statuses = await Promise.all(Array.from({ length: 25 }, () => authorize({ ...deps(store), body: body(), ip: '203.0.113.9' }).then(r => r[0])))
  assert.ok(checked <= LIMITS.perClient, `secret evaluated ${checked} times`)
  assert.equal(statuses.filter(s => s === 401).length, checked)
  assert.ok(statuses.every(s => s === 401 || s === 429))
})

test('a valid secret removes its own reservation and the client history', async () => {
  const store = memStore()
  await tryAs(store, '203.0.113.9')
  assert.equal(await tryAs(store, '203.0.113.9', SECRET), 200)
  assert.equal([...store.m.keys()].filter(k => k.startsWith('fails/')).length, 0)
})

test('no client address: 400 without evaluating the secret', async () => {
  let read = false
  const body = { action: 'devtoken', get secret() { read = true; return SECRET } }
  assert.equal((await authorize({ ...deps(), body, ip: null }))[0], 400)
  assert.equal(read, false)
  const res = await authResponse(new Request('https://x/api/music-auth', { method: 'POST', body: JSON.stringify({ secret: SECRET, action: 'devtoken' }) }), deps(), { failDelay: 0 })
  assert.equal(res.status, 400)
})

// --- on-demand refresh for /api/now-playing ------------------------------------------------------
const cached = (ago, extra = {}) => memStore({ [KEYS.user]: 'user-token-abcdefghijklmnop', [KEYS.now]: { ...shapeTrack(song('old', 'Old')), firstSeenAt: new Date(T - ago).toISOString(), lastCheckedAt: new Date(T - ago).toISOString() }, ...extra })
const rdeps = (store, f, more = {}) => ({ store, env, fetch: f, notifier: spyNotifier(), now: T, ...more })
const hang = () => { const f = (url, init) => (f.calls.push(url), new Promise((_, rej) => init.signal.addEventListener('abort', () => rej(init.signal.reason)))); f.calls = []; return f }

test('refresh: stale cache → one Apple call and the new track is served', async () => {
  const store = cached(5 * 60e3), f = apple(200, [song('s2', 'New')])
  const res = await nowPlayingResponse(rdeps(store, f))
  assert.equal(f.calls.length, 1)
  assert.equal((await res.json()).track, 'New')
  assert.match(res.headers.get('Netlify-CDN-Cache-Control'), /s-maxage=15/)
  assert.equal(res.headers.get('Netlify-Vary'), 'query=_')
})

test('refresh: fresh cache → no Apple call', async () => {
  const f = apple(200)
  assert.equal(await refresh(rdeps(cached(30e3), f)), 'fresh')
  assert.equal(f.calls.length, 0)
})

test('refresh: lease held → cached value, no Apple call; concurrent visitors make one call between them', async () => {
  const store = cached(5 * 60e3), f = apple(200)
  await store.set(KEYS.lease, String(T - 10e3))
  const res = await nowPlayingResponse(rdeps(store, f))
  assert.equal(f.calls.length, 0)
  assert.equal((await res.json()).track, 'Old')
  const store2 = cached(5 * 60e3), g = apple(200)
  const out = await Promise.all([1, 2, 3, 4].map(() => refresh(rdeps(store2, g))))
  assert.equal(g.calls.length, 1)
  assert.deepEqual(out.sort(), ['leased', 'leased', 'leased', 'ok'])
  assert.equal(await refresh(rdeps(store2, g, { now: T + 30e3 })), 'fresh') // the refresh moved lastCheckedAt on
})

test('refresh: Apple hangs → gives up at the timeout and serves the cache', async () => {
  const store = cached(5 * 60e3), f = hang(), t0 = Date.now()
  const res = await nowPlayingResponse(rdeps(store, f, { timeout: 50 }))
  assert.ok(Date.now() - t0 < 1000)
  assert.equal(f.calls.length, 1)
  assert.equal((await res.json()).track, 'Old')
})

test('refresh: expired or backing off → never calls Apple', async () => {
  const f = apple(200)
  assert.equal(await refresh(rdeps(cached(5 * 60e3, { [KEYS.state]: { expired: true } }), f)), 'expired')
  assert.equal(await refresh(rdeps(cached(5 * 60e3, { [KEYS.state]: { backoffUntil: T + 60e3 } }), f)), 'backoff')
  assert.equal(f.calls.length, 0)
})

test('alert emails use the shared template, with the re-auth link as a button and escaped', async () => {
  const sent = [], f = async (url, init) => (sent.push(JSON.parse(init.body)), new Response('{}'))
  const ch = emailChannel({ apiKey: 're', to: 'me@example.com', fetch: f })
  await ch.expired('https://sammyibeh.dev/music-auth/?a=1&b="><script>x</script>')
  await ch.resolved()
  assert.match(sent[0].html, /^<!doctype html>[\s\S]*sammy@ibeh: ~\/music[\s\S]*href="https:\/\/sammyibeh\.dev\/music-auth\/\?a=1&amp;b=&quot;&gt;&lt;script&gt;x&lt;\/script&gt;"[^>]*>Sign in to Apple Music again</)
  assert.ok(!sent[0].html.includes('<script'))
  assert.match(sent[1].html, /apple music reconnected/)
  assert.ok(sent.every(m => m.text.length > 20)) // plain-text alternative kept
})
