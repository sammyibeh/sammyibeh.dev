// GET /api/now-playing → the last Apple Music track, or null. Refreshes from Apple at most once a minute (lib/music.mjs refresh).
import { getStore } from '@netlify/blobs'
import { nowPlayingResponse } from '../lib/music.mjs'
import { fromEnv } from '../lib/notify.mjs'

// a getter so a Blobs setup error is thrown inside nowPlayingResponse's try, and the pill just hides
export default () =>
  nowPlayingResponse({
    get store() {
      return getStore({ name: 'apple-music', consistency: 'strong' }) // strong: the refresh lease must see other visitors' writes
    },
    env: process.env,
    fetch,
    notifier: fromEnv(process.env),
  })

export const config = { path: '/api/now-playing' }
