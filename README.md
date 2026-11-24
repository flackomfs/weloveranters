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
TURSO_DATABASE_MAX_BYTES=
TURSO_DATABASE_2_URL=
TURSO_DATABASE_2_AUTH_TOKEN=
TURSO_DATABASE_2_MAX_BYTES=
TURSO_DATABASE_3_URL=
TURSO_DATABASE_3_AUTH_TOKEN=
TURSO_DATABASE_3_MAX_BYTES=

# Optional app URL
NEXT_PUBLIC_APP_URL=https://your-domain.vercel.app
```

Notes:
- Get `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY` from the Clerk Dashboard. Enable Google and email/password sign-in methods in Clerk.
- `ADMIN_UIDS` is a comma- or whitespace-separated list of user IDs allowed to manage admin features. For existing accounts linked by verified email, the existing database ID is retained; new accounts use their Clerk user ID. Keep this server-only.
- `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` come from your Turso database setup.
- To enable account sharding, configure databases 2 and 3 with their URL and auth token. Set each `TURSO_DATABASE*_MAX_BYTES` to that database's capacity in bytes; new accounts are assigned to the first database below 95% of that limit (DB1, then DB2, then DB3). Existing accounts remain on their assigned database, so their future activity can still grow that database; this policy does not move or rebalance existing accounts. The application measures SQLite page usage, and an account cannot be created if every configured database is at or above the threshold.
- The account/identity directory remains on DB1 so account IDs, verified emails, and names can be looked up globally. The 5% headroom after account placement moves to another shard supports these small directory writes, but it is finite; for very large growth, move the directory to a separate metadata store before DB1 runs out of space.
- Configure shard credentials as server-side environment variables/secrets in Cloudflare Workers or Vercel. Never commit real Turso tokens. The app expects the databases to be configured in order (1, then 2, then 3).
- `WEB_PUSH_VAPID_PUBLIC_KEY` and `WEB_PUSH_VAPID_PRIVATE_KEY` enable browser push notifications. Generate them once with `npx web-push generate-vapid-keys`, keep the private key server-only, and set both in Vercel. `WEB_PUSH_SUBJECT` is the site's HTTPS URL or a contact `mailto:` address.
- Existing Firebase accounts are matched to Clerk accounts only when Clerk confirms the same email address is verified. Existing profile IDs and associated content are kept. Firebase passwords cannot be transferred; users will authenticate through the sign-in methods enabled in Clerk.

### Cloudflare Workers deployment

This Next.js 15 app uses the OpenNext Cloudflare adapter pinned to a compatible release. Do not use `npx wrangler deploy` by itself: OpenNext must first produce the Cloudflare Worker bundle.

Feed, notification, trend, profile, and sidebar updates use a Cloudflare Durable Object WebSocket. The browser performs an initial fetch and refreshes affected views when the Worker broadcasts after a successful API write; it does not poll on a timer. The Durable Object binding and initial SQLite migration are declared in `wrangler.jsonc`.

Connect the repository in Cloudflare Workers Builds and use:

- Build command: `npm run cf:build`
- Deploy command: `npx opennextjs-cloudflare deploy`
- Preview command: `npm run cf:preview`

For local Cloudflare-runtime testing, copy `.dev.vars.example` to `.dev.vars`, add the needed local environment values, then run `npm run cf:preview`. The regular `npm run dev` remains available for Next.js development.

Configure the app's environment variables in the Cloudflare Worker settings. `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `NEXT_PUBLIC_APP_URL` must also be available during the Cloudflare build because Next.js embeds public variables in client bundles. Keep `CLERK_SECRET_KEY`, `TURSO_AUTH_TOKEN`, and `WEB_PUSH_VAPID_PRIVATE_KEY` secret and server-side.

## Device push notifications

Users can enable browser push notifications from Settings → Notification preferences. Push alerts are opt-in per device, follow the user's existing notification categories, and open the in-app notifications page when clicked. The browser asks for notification permission only after the user enables them. Web Push works in supported desktop and Android browsers; iPhone and iPad users need to add the site to their Home Screen and open it as a web app.

Users can set their profile to Public or Private from their profile page. Private profiles show only the username and avatar to non-followers; posts and profile details are visible only to approved followers. New follows require approval, and existing followers keep access when an account becomes private.

The composer includes prompt starters, content warnings, and a live preview for larger `#` posts. Signed-in users can save posts into private collections, pin up to three posts on their profile, and choose interests for account recommendations. Signed-in users see a brief falling confetti celebration after login or when reopening the site.

## Current pages
- `/` landing page
- `/feed` feed view
- `/bookmarks` private saved posts and collections
- `/sign-in` and `/sign-up` Clerk authentication pages (`/auth` redirects to sign-in)
- `/profile` profile page

## Current status
This repo uses Clerk for authentication and Turso for database storage. Add the required credentials to your deployment platform before deployment.
