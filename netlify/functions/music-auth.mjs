// POST /api/music-auth: the owner's private sign-in. Every action needs MUSIC_AUTH_SECRET.
import { getStore } from '@netlify/blobs'
import { authResponse } from '../lib/music.mjs'
import { fromEnv } from '../lib/notify.mjs'

export default req =>
  authResponse(req, {
    // strong consistency: the lockout counter and the token/expiry handover must see each other's writes at once
    store: getStore({ name: 'apple-music', consistency: 'strong' }),
    env: process.env,
    fetch,
    notifier: fromEnv(process.env),
  })

export const config = { path: '/api/music-auth' }
