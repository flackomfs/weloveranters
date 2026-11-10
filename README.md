# WeLoveRanters

A social venting platform inspired by X/Twitter but oriented around emotional honesty, support, and community.

## Tech stack
- Next.js + TypeScript + Tailwind CSS
- Firebase for auth (email + Google)
- Turso / LibSQL for database storage
- App Router structure for a modern social app

## Local setup
1. Install dependencies:
   ```bash
   npm install
   ```
2. Copy `.env.example` to `.env.local` and fill in your own values.
3. Run the app:
   ```bash
   npm run dev
   ```
4. Open `http://localhost:3000`

## Current starter pages
- `/` landing page
- `/feed` feed view
- `/auth` auth screen
- `/profile` profile page

## Notes
This starter is intentionally frontend-focused, with Firebase and Turso placeholders ready to connect once credentials are added.
