// @ts-check
import { defineConfig } from 'astro/config'
import sitemap from '@astrojs/sitemap'

export default defineConfig({
  site: 'https://sammyibeh.dev',
  integrations: [sitemap({ filter: page => !/\/(404|success|music-auth)/.test(page) })],
})
