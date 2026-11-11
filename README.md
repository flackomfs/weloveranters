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
FIREBASE_PRIVATE_KEY=

# Turso
TURSO_DATABASE_URL=
TURSO_AUTH_TOKEN=

# Optional app URL
NEXT_PUBLIC_APP_URL=https://your-domain.vercel.app
```

Notes:
- `NEXT_PUBLIC_*` values are used by the browser-side Firebase SDK.
- `FIREBASE_PRIVATE_KEY` is used by the server-side admin SDK and should contain the private key from your Firebase service account JSON.
- `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` come from your Turso database setup.
- `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID` is not required for this app and was removed because the project is not using Firebase Analytics.

## Current pages
- `/` landing page
- `/feed` feed view
- `/auth` auth screen
- `/profile` profile page

## Current status
This repo is set up as a working starter app with Firebase/Turso placeholders ready for real credentials. When the environment variables are added in Vercel, the app can connect to your real auth and database services.
