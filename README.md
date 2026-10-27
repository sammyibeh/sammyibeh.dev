# [sammyibeh.dev](https://sammyibeh.dev/)

> My personal site, dressed as a terminal session. Built with Astro.

It's a portfolio for one person: a home page that types its greeting in sixteen languages, an about page with an
animated avatar (and his cat, Sully), an experience page you can read as a `git log` or explore in a little shell,
and a contact page that's a command-line form. Every page works without JavaScript; the motion respects
`prefers-reduced-motion`.

## Stack

- [Astro](https://astro.build) static build, TypeScript, plain CSS (`src/styles/site.css`) and a little vanilla JS (`src/scripts/`)
- Self-hosted Inter and JetBrains Mono (`public/fonts/`)
- Netlify for hosting, Forms (the contact page), Functions (`netlify/functions/`) and Blobs (the Apple Music token)
- Cloudflare in front, which also injects Web Analytics (cookieless)

## Run it

Requires Node 24 (see `.nvmrc`).

```sh
npm install
npm run dev       # dev server on localhost:8000
npm run check     # astro check (types)
npm run build     # check, build to dist/, then hash inline scripts into dist/_headers' CSP
npm run preview   # serve dist/ on localhost:8000
npm test          # node --test tests/*.test.mjs
```

Functions and Blobs only run under Netlify (`netlify dev`, or a deploy); without them the site still works and the music pill stays hidden.

`node scripts/assets.mjs` regenerates the favicons from `public/favicon.svg` and the 1200×630 share cards in `public/og/`. `npm run resume` renders `resume/resume.html` to `public/resume.pdf` (A4; its content is fuller than the site's, for job applications). Both use your local Chrome (`CHROME=/path/to/chrome` to override). Run them by hand and commit the output. The build never runs them.

## How it fits together

- `src/layouts/Shell.astro` is the one layout: nav, footer, CSP-friendly inline scripts. `src/scripts/site.js` adds the terminal (press `/`), page transitions and the per-page behaviour.
- `src/scripts/buddy/` is the avatar: an SVG rig with two-bone IK arms and a small scene director, all hand-written.
- `data/` holds the content the pages and the shell share (experience, site config).
- `netlify/functions/` are thin wrappers; the logic lives in `netlify/lib/` with its dependencies passed in, so `tests/` runs it offline:
  - `now-playing` serves the last Apple Music track from Blobs, refreshing from Apple at most once a minute; `music-poll` checks every 5 minutes and alerts when sign-in expires; `music-auth` is the owner's sign-in.
  - `submission-created` emails each verified contact-form message through Resend, using the shared template in `netlify/lib/email.mjs`.

## Deploy

Netlify builds every push: `main` goes to production and other branches get a branch deploy. The build settings live in `netlify.toml`, the headers in `public/_headers` and the redirects in `public/_redirects`.

## Environment variables

All are optional. Set them in the Netlify UI. Never commit them (`.env*` is ignored).

| Name | Used by | Without it |
| --- | --- | --- |
| `APPLE_TEAM_ID`, `APPLE_KEY_ID`, `APPLE_MUSIC_PRIVATE_KEY` | `/api/now-playing`, `/api/music-auth`, the poller | The home page's music pill stays hidden |
| `MUSIC_AUTH_SECRET` (32+ characters) | `/music-auth/` sign-in | Sign-in answers 503 |
| `GITHUB_ISSUES_TOKEN`, `GITHUB_ISSUES_REPO` (default `sammyibeh/sammyibeh.dev`) | Sign-in-expired alerts as a GitHub issue | No GitHub alert |
| `RESEND_API_KEY`, `ALERT_EMAIL_TO`, `ALERT_EMAIL_FROM` | Contact-form emails and sign-in-expired alerts | No emails (Netlify still stores form submissions) |
| `PUBLIC_CF_BEACON_TOKEN` | `Shell.astro` | No manual analytics beacon (Cloudflare's auto-injection still works) |

## License

The code is under the [MIT License](LICENSE): borrow the techniques, the rig, the functions, anything that's code.

## Content & artwork

Content & artwork © Sammy Ibeh, all rights reserved. That covers the copy, the avatar and Sully, the `{▮}` icon and
logo, the email design, the resume and its design, and the share images. They're not under the MIT License.

Please don't reuse the site as your own portfolio. Fork it to learn from it, but make the result yours: your words,
your look, your cat.
