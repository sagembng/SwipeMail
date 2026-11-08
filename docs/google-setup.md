# Google sign-in setup

SwipeMail signs users in with Google and asks for the `gmail.modify` permission, so it can read unread mail and mark it read or starred.
You do this once. It takes about 10 minutes and is free.

## 1. Create a Google Cloud project
1. Open https://console.cloud.google.com and sign in.
2. Click the project picker at the top, then **New project**. Name it `SwipeMail` and create it.

## 2. Enable the Gmail API
1. Go to **APIs & Services → Library**.
2. Search for **Gmail API** and click **Enable**.

## 3. Set up the consent screen
1. Go to **APIs & Services → OAuth consent screen** (called **Google Auth Platform** in newer consoles).
2. User type: **External**. App name: `SwipeMail`. Add your email as support and developer contact.
3. **Data access / Scopes**: add `.../auth/gmail.modify` (plus the default `openid`, `email`, `profile`).
4. **Audience / Test users**: add the Gmail addresses of everyone who should try the app (you and your testers, up to 100).
   Leave the publishing status on **Testing**. Anyone not on this list will be blocked by Google.

> Testing mode note: Google expires refresh tokens after 7 days for apps in Testing. Testers will need to sign in again about once a week.
> Making the app public needs Google's verification for restricted scopes, which is out of scope for a portfolio project.

## 4. Create the OAuth client
1. Go to **APIs & Services → Credentials → Create credentials → OAuth client ID**.
2. Application type: **Web application**. Name: `SwipeMail web`.
3. **Authorized redirect URIs** (add each one you will use):
   - `http://localhost:3000/api/auth/callback/google`
   - `https://YOUR-DEPLOYED-DOMAIN/api/auth/callback/google` (after you deploy)
4. Create, then copy the **Client ID** and **Client secret**.

## 5. Add the keys to the project
Open `.env.local` in the project root and fill in:

```
AUTH_SECRET=...            # already generated for you
AUTH_GOOGLE_ID=xxxxxxxx.apps.googleusercontent.com
AUTH_GOOGLE_SECRET=GOCSPX-xxxxxxxx
```

Restart the dev server (`npm run dev`). The "Continue with Google" button on `/login` is then enabled.

Never commit `.env.local` or share the client secret. `.env.example` is the safe template.

## How it works in this project
- `src/auth.ts`: Auth.js config. Requests offline access, stores Google's tokens in the encrypted session cookie, and refreshes the access token when it is about to expire.
- `src/proxy.ts`: sends signed-out visitors from `/dashboard` to `/login`, and signed-in visitors from `/login` to `/dashboard`.
- `/demo` is public and uses sample emails, so people without Google access can still try the app.
