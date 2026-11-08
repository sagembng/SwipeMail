# SwipeMail

**Clear your unread Gmail by swiping.** SwipeMail turns your unread emails into a clean stack of cards: read the summary, hold to see the whole message, then swipe. Zero inbox fatigue.

**Live site:** https://swipemail-five.vercel.app

Created by **Xavier Imbang**.

| Gesture | What it does in Gmail |
|---|---|
| Swipe left | Mark as read |
| Swipe right | Star it and keep it unread |
| Swipe up | Archive (and mark read) |
| Swipe down | Snooze until later (kept in your browser) |
| Hold | Open the full email |

Try it without signing in: open [`/walkthrough`](https://swipemail-five.vercel.app/walkthrough) for a 60-second guided tour, or [`/demo`](https://swipemail-five.vercel.app/demo) for the full app with sample emails.

## Features

- **Google sign-in**, then your real unread inbox as swipeable cards (5 to 50 emails per batch, 25 by default)
- **Free, offline summaries**: no AI service. Simple text rules pick the key sentences, pull out deadlines and amounts, and add smart tags (Action needed, Receipt, Security, Promo, ...)
- **Safe rich preview** of HTML emails: scripts and remote images are removed, and layout tables are flattened
- **Starred tab** with unstar, mark read, a full-email reader and an "Open in Gmail" link
- **Undo, archive, snooze, refresh** and automatic new-mail checks
- **Sender pictures**: Gravatar photos or company logos, fetched through the server for privacy
- **Per-account settings**: keyboard shortcuts, emails per batch, vibration and light/dark/system theme, with Save and Discard
- **Interactive walkthrough** and a help tour for first-time users
- **Responsive**: phones, small phones, phones held sideways and tablets, with touch gestures and haptics
- **Gentle on Gmail**: request queueing, automatic retries, caching and lightweight new-mail checks keep it inside Gmail's rate limits
- **Branded loading screen** on launch, sign-in and sign-out

## Tech stack

Next.js 16 (App Router, Turbopack), React 19, TypeScript, Auth.js v5 (Google OAuth), the Gmail REST API and plain CSS modules. Hosted on Vercel.

There is **no database**. The login lives in an encrypted cookie, preferences and snoozes live in the browser, and the API routes run as serverless functions in the same project.

## Run it locally

```bash
npm install
cp .env.example .env.local   # then fill in the values below
npm run dev                  # http://localhost:3000
```

Other scripts: `npm run build`, `npm run lint`, `npm test` (unit tests for the summaries, preferences, theme, avatars, cookies and rate-limit helpers).

Without Google keys the app still runs: sign-in is disabled, but `/walkthrough` and `/demo` work.

### Environment variables

| Name | What it is |
|---|---|
| `AUTH_SECRET` | A long random string that encrypts the login cookie. Generate one with `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"` |
| `AUTH_GOOGLE_ID` | Client ID of your Google OAuth client |
| `AUTH_GOOGLE_SECRET` | Client secret of your Google OAuth client |
| `CONTACT_EMAIL` | Optional. The contact address shown on the Privacy Policy and Terms pages. It is added when the site is built, so redeploy after changing it |

The Google Cloud setup (project, Gmail API, consent screen, OAuth client) is in [docs/google-setup.md](docs/google-setup.md).

## Deploy

SwipeMail deploys to Vercel as a normal Next.js project, with no database or separate backend:

1. Push the repository to GitHub and import it in Vercel.
2. Add the environment variables above.
3. In Google Cloud, add `https://YOUR-DOMAIN/api/auth/callback/google` as an authorized redirect URI on your OAuth client.
4. Under Google Auth Platform, fill in Branding (home page, `/privacy` and `/terms` links) and publish the app so that people other than test users can sign in.

Google shows its "unverified app" warning to new users until an app is formally verified, and limits unverified apps that use Gmail permissions to 100 users. See the sign-in card's note and the Privacy Policy for how this is explained to users.

## Project layout

```
src/app/            pages and API routes: / and /login, /dashboard, /demo, /walkthrough, /privacy, /terms, /api/*
src/components/     swipe deck, settings, help, email reader, loading screen, avatars
src/lib/            Gmail client, summaries, rate-limit helpers, preferences and theme (with tests)
src/auth.ts         Auth.js configuration (Google, token refresh)
src/proxy.ts        route guard for /dashboard and /login
docs/               Google Cloud setup guide
Branding/, design/  logo, inspiration and early design prototypes
```

## Privacy and security

- SwipeMail asks Google for the `gmail.modify` permission, the smallest one that lets an app change a message's labels (read, starred, archived). Google describes it broadly (it also covers composing and sending), so the consent screen sounds stronger than what the app does. SwipeMail's code only reads emails and changes those labels. It never sends, drafts or deletes anything.
- Email text is processed in memory to build each card and is never stored in a database or in logs. Tokens stay in an encrypted, httpOnly cookie and are never sent to browser code.
- Full details are in the app's [Privacy Policy](https://swipemail-five.vercel.app/privacy) and [Terms of Service](https://swipemail-five.vercel.app/terms).

## Credits

Created by **Xavier Imbang**: concept, product design, brand direction, logo and development.

Built with AI pair-programming assistance from Claude (Anthropic).

Copyright © 2026 Xavier Imbang.
