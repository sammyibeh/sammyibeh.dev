// Every 5 minutes: ask Apple Music for the most recently played track and keep it in Blobs.
// Scheduled functions only run on the published (production) deploy.
import { getStore } from '@netlify/blobs'
import { poll } from '../lib/music.mjs'
import { fromEnv } from '../lib/notify.mjs'

export default async () => {
  const status = await poll({
    store: getStore({ name: 'apple-music', consistency: 'strong' }), // sees a fresh sign-in straight away
    env: process.env,
    fetch,
    notifier: fromEnv(process.env),
  })
  console.log('music-poll:', status)
}

export const config = { schedule: '*/5 * * * *' }
