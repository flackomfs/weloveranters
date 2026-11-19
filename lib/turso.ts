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
          is_bot INTEGER NOT NULL DEFAULT 0,
          banner_url TEXT,
          bio TEXT,
          social_links TEXT,
          followers_override INTEGER,
          following_override INTEGER,
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
        CREATE TABLE IF NOT EXISTS tagalog_mood_bot_runs (
          run_date TEXT PRIMARY KEY,
          post_id TEXT NOT NULL,
          content TEXT
        );
      `);

      await tursoClient.execute(`
        CREATE TABLE IF NOT EXISTS tagalog_mood_bot_daily (
          run_date TEXT PRIMARY KEY,
          target_count INTEGER NOT NULL CHECK (target_count BETWEEN 5 AND 10),
          posted_count INTEGER NOT NULL DEFAULT 0,
          attempt_count INTEGER NOT NULL DEFAULT 0
        );
      `);

      await tursoClient.execute(`
        CREATE TABLE IF NOT EXISTS tagalog_mood_bot_posts (
          post_id TEXT PRIMARY KEY,
          run_date TEXT NOT NULL,
          content TEXT NOT NULL UNIQUE,
          created_at TEXT NOT NULL
        );
      `);

      await tursoClient.execute('CREATE INDEX IF NOT EXISTS tagalog_mood_bot_posts_run_date_idx ON tagalog_mood_bot_posts (run_date);');

      await tursoClient.execute(`
        CREATE TABLE IF NOT EXISTS post_comments (
          id TEXT PRIMARY KEY,
          post_id TEXT NOT NULL,
          user_id TEXT NOT NULL,
          author_name TEXT NOT NULL,
          author_username TEXT NOT NULL,
          content TEXT NOT NULL,
          created_at TEXT NOT NULL,
          parent_comment_id TEXT
        );
      `);

      await tursoClient.execute(`
        CREATE TABLE IF NOT EXISTS post_bot_responses (
          source_post_id TEXT PRIMARY KEY,
          reply_post_id TEXT NOT NULL UNIQUE,
          created_at TEXT NOT NULL
        );
      `);

      await tursoClient.execute(`
        CREATE TABLE IF NOT EXISTS post_reposts (
          user_id TEXT NOT NULL,
          post_id TEXT NOT NULL,
          author_name TEXT NOT NULL,
          author_username TEXT NOT NULL,
          created_at TEXT NOT NULL,
          PRIMARY KEY (user_id, post_id)
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

      await tursoClient.execute(`
        CREATE TABLE IF NOT EXISTS user_settings (
          user_id TEXT PRIMARY KEY,
          theme_id TEXT NOT NULL DEFAULT 'violet-night',
          updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        );
      `);

      await tursoClient.execute(`
        CREATE TABLE IF NOT EXISTS notifications (
          id TEXT PRIMARY KEY,
          recipient_id TEXT NOT NULL,
          actor_id TEXT NOT NULL,
          type TEXT NOT NULL,
          entity_id TEXT,
          created_at TEXT NOT NULL,
          read_at TEXT
        );
      `);

      await tursoClient.execute(`
        CREATE TABLE IF NOT EXISTS user_verification_requests (
          user_id TEXT PRIMARY KEY,
          requested_badge TEXT NOT NULL CHECK (requested_badge IN ('man', 'woman')),
          status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected')),
          created_at TEXT NOT NULL,
          reviewed_at TEXT,
          reviewed_by TEXT
        );
      `);

      const verificationSchema = await tursoClient.execute(
        "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'user_verification_requests'"
      );
      const verificationSql = String(verificationSchema.rows[0]?.sql || '');
      if (verificationSql.includes("'boy'") || verificationSql.includes("'girl'")) {
        await tursoClient.batch([
          { sql: 'ALTER TABLE user_verification_requests RENAME TO user_verification_requests_old', args: [] },
          { sql: `CREATE TABLE user_verification_requests (
            user_id TEXT PRIMARY KEY,
            requested_badge TEXT NOT NULL CHECK (requested_badge IN ('man', 'woman')),
            status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected')),
            created_at TEXT NOT NULL,
            reviewed_at TEXT,
            reviewed_by TEXT
          )`, args: [] },
          { sql: `INSERT INTO user_verification_requests
            (user_id, requested_badge, status, created_at, reviewed_at, reviewed_by)
            SELECT user_id,
              CASE requested_badge WHEN 'boy' THEN 'man' ELSE 'woman' END,
              status, created_at, reviewed_at, reviewed_by
            FROM user_verification_requests_old`, args: [] },
          { sql: 'DROP TABLE user_verification_requests_old', args: [] }
        ], 'write');
      }

      await tursoClient.execute(`
        CREATE TABLE IF NOT EXISTS blocked_users (
          blocker_id TEXT NOT NULL,
          blocked_id TEXT NOT NULL,
          created_at TEXT NOT NULL,
          PRIMARY KEY (blocker_id, blocked_id),
          CHECK (blocker_id <> blocked_id)
        );
      `);

      await tursoClient.execute(`
        CREATE TABLE IF NOT EXISTS post_reports (
          id TEXT PRIMARY KEY,
          post_id TEXT NOT NULL,
          reporter_id TEXT NOT NULL,
          reason TEXT NOT NULL,
          details TEXT NOT NULL DEFAULT '',
          status TEXT NOT NULL CHECK (status IN ('pending', 'reviewed', 'dismissed')),
          created_at TEXT NOT NULL,
          reviewed_at TEXT,
          reviewed_by TEXT,
          UNIQUE (post_id, reporter_id)
        );
      `);

      await tursoClient.execute(`
        CREATE TABLE IF NOT EXISTS post_drafts (
          user_id TEXT PRIMARY KEY,
          content TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
      `);

      await tursoClient.execute(`
        CREATE TABLE IF NOT EXISTS notification_preferences (
          user_id TEXT NOT NULL,
          type TEXT NOT NULL,
          enabled INTEGER NOT NULL DEFAULT 1,
          PRIMARY KEY (user_id, type)
        );
      `);

      await tursoClient.execute(`
        CREATE TABLE IF NOT EXISTS web_push_subscriptions (
          endpoint TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          p256dh TEXT NOT NULL,
          auth TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
      `);

      await tursoClient.execute('CREATE INDEX IF NOT EXISTS notifications_recipient_created_idx ON notifications (recipient_id, created_at);');
      await tursoClient.execute('CREATE INDEX IF NOT EXISTS web_push_subscriptions_user_id_idx ON web_push_subscriptions (user_id);');
      await tursoClient.execute('CREATE INDEX IF NOT EXISTS user_verification_requests_status_created_idx ON user_verification_requests (status, created_at);');
      await tursoClient.execute('CREATE INDEX IF NOT EXISTS blocked_users_blocked_idx ON blocked_users (blocked_id, blocker_id);');
      await tursoClient.execute('CREATE INDEX IF NOT EXISTS post_reports_status_created_idx ON post_reports (status, created_at);');
      await tursoClient.execute('CREATE INDEX IF NOT EXISTS post_hashtags_created_at_idx ON post_hashtags (created_at);');
      await tursoClient.execute('CREATE INDEX IF NOT EXISTS post_comments_post_created_idx ON post_comments (post_id, created_at);');
      await tursoClient.execute('CREATE INDEX IF NOT EXISTS post_reposts_post_created_idx ON post_reposts (post_id, created_at);');

      const userColumns = await tursoClient.execute('PRAGMA table_info(users)');
      const existingColumns = new Set(userColumns.rows.map((row) => String(row.name)));
      if (!existingColumns.has('banner_url')) {
        await tursoClient.execute('ALTER TABLE users ADD COLUMN banner_url TEXT');
      }
      if (!existingColumns.has('social_links')) {
        await tursoClient.execute('ALTER TABLE users ADD COLUMN social_links TEXT');
      }
      if (!existingColumns.has('followers_override')) {
        await tursoClient.execute('ALTER TABLE users ADD COLUMN followers_override INTEGER');
      }
      if (!existingColumns.has('following_override')) {
        await tursoClient.execute('ALTER TABLE users ADD COLUMN following_override INTEGER');
      }
      if (!existingColumns.has('is_bot')) {
        await tursoClient.execute('ALTER TABLE users ADD COLUMN is_bot INTEGER NOT NULL DEFAULT 0');
      }

      await tursoClient.execute(`
        UPDATE users
        SET display_name = substr(trim(display_name), 1, max(1, 80 - length(id) - 3)) || ' (' || id || ')'
        WHERE id IN (
          SELECT id FROM (
            SELECT id, ROW_NUMBER() OVER (PARTITION BY lower(trim(display_name)) ORDER BY id) AS duplicate_rank
            FROM users
            WHERE display_name IS NOT NULL AND trim(display_name) <> ''
          )
          WHERE duplicate_rank > 1
        )
      `);
      await tursoClient.execute(`
        UPDATE users
        SET username = substr(trim(username), 1, max(1, 31 - length(id))) || '_' || lower(id)
        WHERE id IN (
          SELECT id FROM (
            SELECT id, ROW_NUMBER() OVER (PARTITION BY lower(trim(username)) ORDER BY id) AS duplicate_rank
            FROM users
            WHERE username IS NOT NULL AND trim(username) <> ''
          )
          WHERE duplicate_rank > 1
        )
      `);
      await tursoClient.execute('UPDATE users SET username = lower(trim(username)) WHERE username IS NOT NULL;');
      await tursoClient.execute(`
        CREATE UNIQUE INDEX IF NOT EXISTS users_display_name_ci_unique
        ON users (lower(trim(display_name)))
        WHERE display_name IS NOT NULL AND trim(display_name) <> ''
      `);
      await tursoClient.execute(`
        CREATE UNIQUE INDEX IF NOT EXISTS users_username_ci_unique
        ON users (lower(trim(username)))
        WHERE username IS NOT NULL AND trim(username) <> ''
      `);

      const postColumns = await tursoClient.execute('PRAGMA table_info(posts)');
      if (!postColumns.rows.some((row) => String(row.name) === 'updated_at')) {
        await tursoClient.execute('ALTER TABLE posts ADD COLUMN updated_at TEXT');
      }

      const tagalogMoodBotRunColumns = await tursoClient.execute('PRAGMA table_info(tagalog_mood_bot_runs)');
      if (!tagalogMoodBotRunColumns.rows.some((row) => String(row.name) === 'content')) {
        await tursoClient.execute('ALTER TABLE tagalog_mood_bot_runs ADD COLUMN content TEXT');
      }
      await tursoClient.execute('CREATE UNIQUE INDEX IF NOT EXISTS tagalog_mood_bot_runs_content_unique ON tagalog_mood_bot_runs (content);');

      const commentColumns = await tursoClient.execute('PRAGMA table_info(post_comments)');
      if (!commentColumns.rows.some((row) => String(row.name) === 'parent_comment_id')) {
        await tursoClient.execute('ALTER TABLE post_comments ADD COLUMN parent_comment_id TEXT');
      }
    })().catch((error) => {
      schemaPromise = null;
      throw error;
    });
  }

  await schemaPromise;

  return tursoClient;
}
