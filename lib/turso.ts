import { createClient } from '@libsql/client';

const databaseUrl = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;

export const tursoClient = databaseUrl && authToken ? createClient({ url: databaseUrl, authToken }) : null;
export const isTursoConfigured = Boolean(tursoClient);

let schemaPromise: Promise<void> | null = null;

export async function initTursoSchema() {
  if (!tursoClient) {
    return null;
  }

  if (!schemaPromise) {
    schemaPromise = (async () => {
      await tursoClient.execute(`
        CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY,
          email TEXT UNIQUE,
          display_name TEXT,
          username TEXT UNIQUE,
          avatar_url TEXT,
          bio TEXT,
          provider TEXT,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );
      `);

      await tursoClient.execute(`
        CREATE TABLE IF NOT EXISTS posts (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          content TEXT NOT NULL,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          likes INTEGER DEFAULT 0,
          comments INTEGER DEFAULT 0,
          reposts INTEGER DEFAULT 0
        );
      `);

      await tursoClient.execute(`
        CREATE TABLE IF NOT EXISTS follows (
          follower_id TEXT NOT NULL,
          following_id TEXT NOT NULL,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (follower_id, following_id)
        );
      `);

      await tursoClient.execute(`
        CREATE TABLE IF NOT EXISTS post_hashtags (
          hashtag TEXT NOT NULL,
          post_id TEXT NOT NULL,
          created_at TEXT NOT NULL,
          PRIMARY KEY (hashtag, post_id)
        );
      `);

      await tursoClient.execute('CREATE INDEX IF NOT EXISTS post_hashtags_created_at_idx ON post_hashtags (created_at);');
    })().catch((error) => {
      schemaPromise = null;
      throw error;
    });
  }

  await schemaPromise;

  return tursoClient;
}
