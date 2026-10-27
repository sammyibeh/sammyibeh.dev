// Netlify runs this for every verified form submission (spam-flagged ones never reach it); see lib/contact.mjs.
// No signature check here: Netlify verifies its own JWS before invoking event functions, and a direct POST gets 403 (checked on the deploy).
import { getStore } from '@netlify/blobs'
import { handleSubmission } from '../lib/contact.mjs'

export default async req => {
  const { payload } = await req.json().catch(() => ({}))
  let store = null
  try {
    store = getStore({ name: 'contact-sent', consistency: 'strong' })
  } catch (e) {
    console.error('contact dedupe unavailable:', e.message) // still send
  }
  console.log('submission-created:', await handleSubmission(payload, process.env, fetch, store))
}
