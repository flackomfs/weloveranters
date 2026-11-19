# WeLoveRanters

A social venting platform inspired by X/Twitter but oriented around emotional honesty, support, and community.

## Tech stack
- Next.js + TypeScript + Tailwind CSS
- Firebase for auth (Google + email/password)
- Turso / LibSQL for database storage
- App Router structure for a modern social app

## Environment variables
This app expects Firebase and Turso credentials to be configured via environment variables.

### Local development
1. Copy `.env.example` to `.env.local` and fill in your values.
2. Run the app:
   ```bash
   npm install
   npm run dev
   ```
3. Open `http://localhost:3000`

### Vercel deployment
Set the same variables in your Vercel project under Project Settings → Environment Variables.

Required values:

```bash
# Firebase client configuration
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=

# Firebase server-side verification
FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYOUR_KEY_HERE\n-----END PRIVATE KEY-----\n"
ADMIN_UIDS=your_firebase_uid,another_firebase_uid

# Turso
TURSO_DATABASE_URL=
TURSO_AUTH_TOKEN=

# Optional app URL
NEXT_PUBLIC_APP_URL=https://your-domain.vercel.app
```

Notes:
- `NEXT_PUBLIC_*` values are used by the browser-side Firebase SDK.
- `FIREBASE_PRIVATE_KEY` is used by the server-side admin SDK and should contain the private key from your Firebase service account JSON. Keep it quoted in Vercel and preserve the newline escapes.
- `ADMIN_UIDS` is a comma- or whitespace-separated list of Firebase Authentication UIDs allowed to override displayed follower and following counts on profiles. Keep this server-only; it must not use a `NEXT_PUBLIC_` prefix.
- `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` come from your Turso database setup.
- `CRON_SECRET` protects the scheduled Tagalog mood bot endpoint. Set it in Vercel; the scheduled request must send it as a bearer token.
- `GEMINI_API_KEY` enables opt-in support replies. Keep it server-only; do not use a `NEXT_PUBLIC_` prefix. `GEMINI_MODEL` is optional and defaults to `gemini-3.1-flash-lite`.
- No Firebase Analytics or messaging variables are required for this app.

## Tagalog mood bot

Vercel runs `/api/automation/tagalog-mood` every two hours. The endpoint chooses a daily target of 5–10 posts and publishes up to that target across the scheduled runs; all 12 daily executions are needed to meet the target. The Vercel plan must support a two-hour cron cadence. It checks up to 200 public posts from the previous 24 hours using a small, on-server keyword heuristic to select a mood; when no clear mood is detected, it rotates through support themes instead. Post text varies and includes a unique daily sequence number. This scheduled publisher uses broad trends and does not respond to individual posts.

Emotion labels are calculated temporarily and are not saved. This heuristic can misunderstand sarcasm, context, or mixed-language posts; it is not a mental-health assessment. Feed viewers are told that the automated trend check is active, and bot posts carry an “Automated bot” label.

Set a strong `CRON_SECRET` in Vercel environment variables so scheduled requests are authorized. Do not expose it with a `NEXT_PUBLIC_` prefix.

## Gemini support replies

Users can start a post with `#sad`, another recognized emotion hashtag, or `#rant` to request a supportive response in the rant’s language. The composer asks for confirmation because the public rant is sent to Google Gemini and the response is published as a separate public Kumusta Bot post linked to the original. `#rant` asks Gemini to infer the emotion; an emotion hashtag supplies it directly. Posts beginning with `#` render slightly larger. Set `GEMINI_API_KEY` in Vercel to enable replies.

The composer includes prompt starters, a live preview for larger `#` posts, and a reminder that posts are public. Signed-in users see a brief confetti celebration after login or when reopening the site; it respects reduced-motion preferences.

## Current pages
- `/` landing page
- `/feed` feed view
- `/auth` auth screen
- `/profile` profile page

## Current status
This repo is set up as a working starter app with Firebase/Turso placeholders ready for real credentials. When the environment variables are added in Vercel, the app can connect to your real auth and database services.
