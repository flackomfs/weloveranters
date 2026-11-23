# WeLoveRanters

A social venting platform inspired by X/Twitter but oriented around emotional honesty, support, and community.

## Tech stack
- Next.js + TypeScript + Tailwind CSS
- Clerk for auth (Google and email/password, configured in Clerk)
- Turso / LibSQL for database storage
- App Router structure for a modern social app

## Environment variables
This app expects Clerk and Turso credentials to be configured via environment variables.

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
# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL=/feed
NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL=/feed
ADMIN_UIDS=your_clerk_user_id,another_clerk_user_id

# Turso
TURSO_DATABASE_URL=
TURSO_AUTH_TOKEN=

# Optional app URL
NEXT_PUBLIC_APP_URL=https://your-domain.vercel.app
```

Notes:
- Get `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY` from the Clerk Dashboard. Enable Google and email/password sign-in methods in Clerk.
- `ADMIN_UIDS` is a comma- or whitespace-separated list of user IDs allowed to manage admin features. For existing accounts linked by verified email, the existing database ID is retained; new accounts use their Clerk user ID. Keep this server-only.
- `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` come from your Turso database setup.
- `CRON_SECRET` protects the scheduled Tagalog mood bot endpoint. Set it in Vercel; the scheduled request must send it as a bearer token.
- `WEB_PUSH_VAPID_PUBLIC_KEY` and `WEB_PUSH_VAPID_PRIVATE_KEY` enable browser push notifications. Generate them once with `npx web-push generate-vapid-keys`, keep the private key server-only, and set both in Vercel. `WEB_PUSH_SUBJECT` is the site's HTTPS URL or a contact `mailto:` address.
- `GEMINI_API_KEY` enables opt-in support replies. Keep it server-only; do not use a `NEXT_PUBLIC_` prefix. `GEMINI_MODEL` is optional and defaults to `gemini-3.1-flash-lite`.
- Existing Firebase accounts are matched to Clerk accounts only when Clerk confirms the same email address is verified. Existing profile IDs and associated content are kept. Firebase passwords cannot be transferred; users will authenticate through the sign-in methods enabled in Clerk.

## Device push notifications

Users can enable browser push notifications from Settings → Notification preferences. Push alerts are opt-in per device, follow the user's existing notification categories, and open the in-app notifications page when clicked. The browser asks for notification permission only after the user enables them. Web Push works in supported desktop and Android browsers; iPhone and iPad users need to add the site to their Home Screen and open it as a web app.

Users can set their profile to Public or Private from their profile page. Private profiles show only the username and avatar to non-followers; posts and profile details are visible only to approved followers. New follows require approval, and existing followers keep access when an account becomes private.

## Tagalog mood bot

Vercel Hobby runs `/api/automation/tagalog-mood` once daily at 02:00 UTC. Each run chooses a daily target of 5–10 posts and publishes all remaining posts together in one database batch. It checks up to 200 public posts from the previous 24 hours using a small, on-server keyword heuristic to select a mood; when no clear mood is detected, it rotates through support themes instead. Post text varies and includes a unique daily sequence number. This scheduled publisher uses broad trends and does not respond to individual posts.

Emotion labels are calculated temporarily and are not saved. This heuristic can misunderstand sarcasm, context, or mixed-language posts; it is not a mental-health assessment. Feed viewers are told that the automated trend check is active, and bot posts carry an “Automated bot” label.

Set a strong `CRON_SECRET` in Vercel environment variables so scheduled requests are authorized. Do not expose it with a `NEXT_PUBLIC_` prefix.

## Gemini support replies

Users can start a post with `#sad`, another recognized emotion hashtag, or `#rant` to request a supportive response in the rant’s language. The composer asks for confirmation because the public rant is sent to Google Gemini and the response is published as a separate public Kumusta Bot post linked to the original. `#rant` asks Gemini to infer the emotion; an emotion hashtag supplies it directly. Posts beginning with `#` render slightly larger. Set `GEMINI_API_KEY` in Vercel to enable replies.

The composer includes prompt starters and a live preview for larger `#` posts. Signed-in users see a brief falling confetti celebration after login or when reopening the site.

## Current pages
- `/` landing page
- `/feed` feed view
- `/sign-in` and `/sign-up` Clerk authentication pages (`/auth` redirects to sign-in)
- `/profile` profile page

## Current status
This repo uses Clerk for authentication and Turso for database storage. Add the required credentials in Vercel before deployment.
