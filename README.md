# SwipeMail

Clear your unread Gmail by swiping. SwipeMail turns your unread emails into a stack of cards: read the summary, hold to see the whole message, then swipe.

| Gesture | What it does in Gmail |
|---|---|
| Swipe left | Mark as read |
| Swipe right | Star it and keep it unread |
| Swipe up | Archive (and mark read) |
| Swipe down | Snooze until later (kept in your browser) |
| Hold | Open the full email |

Try it without signing in: open `/walkthrough` for a 60-second guided tour, or `/demo` for the full app with sample emails.

## Features

- Google sign-in, then your real unread inbox as swipeable cards
- Free, offline summaries, key-detail chips (deadlines, amounts) and smart tags (Action needed, Receipt, Security, ...)
- Safe rich preview of HTML emails (scripts and remote images are removed)
- Starred list with unstar, a full-email reader and an "Open in Gmail" link
- Undo, archive, snooze, refresh and batch loading (5 to 50 emails per batch, default 25)
- Custom keyboard shortcuts, light/dark theme and a vibration option, all saved per account
- Interactive onboarding, installable-feeling mobile layout, tablet and phone landscape support
- Built to respect Gmail's rate limits (queueing, retries, caching)

## Tech stack

Next.js 16 (App Router, Turbopack), React 19, TypeScript, Auth.js v5 (Google OAuth), the Gmail REST API, plain CSS modules. No database: the login lives in an encrypted cookie and preferences live in the browser.

## Run it locally

```bash
npm install
cp .env.example .env.local   # then fill in the three values (see docs/google-setup.md)
npm run dev                  # http://localhost:3000
```

Other scripts: `npm run build`, `npm run lint`, `npm test`.

Without Google keys the app still runs: sign-in is disabled, but `/walkthrough` and `/demo` work.

## Deploy

SwipeMail deploys to Vercel as a normal Next.js project, with no database or separate backend. Add three environment variables (`AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`), then register `https://YOUR-DOMAIN/api/auth/callback/google` as an authorized redirect URI on your Google OAuth client. The Google Cloud setup is in [docs/google-setup.md](docs/google-setup.md).

## Project layout

```
src/app/            pages and API routes (login, dashboard, demo, walkthrough, api/*)
src/components/     swipe deck, settings, help, loader, avatars
src/lib/            Gmail client, summaries, rate-limit helpers, preferences (with tests)
src/auth.ts         Auth.js configuration (Google, token refresh)
src/proxy.ts        route guard for /dashboard and /login
docs/               setup and deployment guides
Branding/, design/  logo, inspiration and early design prototypes
```

## Privacy and security

- SwipeMail asks Google for the `gmail.modify` permission, the smallest one that lets an app change a message's labels (read, starred, archived). Google describes it broadly (it also covers composing and sending), so the consent screen sounds stronger than what the app does. SwipeMail's code only reads emails and changes those labels. It never sends, drafts or deletes anything.
- Email text is processed in memory to build each card and is never stored. Tokens stay in an encrypted, httpOnly cookie and are never sent to browser code.
- While the app is in Google's "Testing" mode only people added as test users can sign in. Once it is published, anyone can sign in (after Google's "unverified app" warning), up to Google's limit of 100 users for unverified apps. The demo and walkthrough are always open to everyone.

## Credits

Design and development by the project owner, built with Claude.
