import { createClient } from '@libsql/client/http';
import type { Client } from '@libsql/client';

export type TursoShardId = 1 | 2 | 3;

export type TursoShard = {
  id: TursoShardId;
  client: Client;
};

const shardConfigs: Array<{
  id: TursoShardId;
  url: string | undefined;
  authToken: string | undefined;
  maxBytes: string | undefined;
}> = [
  {
    id: 1,
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
    maxBytes: process.env.TURSO_DATABASE_MAX_BYTES
  },
  {
    id: 2,
    url: process.env.TURSO_DATABASE_2_URL,
    authToken: process.env.TURSO_DATABASE_2_AUTH_TOKEN,
    maxBytes: process.env.TURSO_DATABASE_2_MAX_BYTES
  },
  {
    id: 3,
    url: process.env.TURSO_DATABASE_3_URL,
    authToken: process.env.TURSO_DATABASE_3_AUTH_TOKEN,
    maxBytes: process.env.TURSO_DATABASE_3_MAX_BYTES
  }
];

const shardClients = shardConfigs.map(({ url, authToken }) =>
  url && authToken ? createClient({ url, authToken }) : null
);

export const tursoClient = shardClients[0];
export const isTursoConfigured = Boolean(tursoClient);

const schemaPromises = new WeakMap<Client, Promise<void>>();

export function getConfiguredTursoShards(): TursoShard[] {
  for (const config of shardConfigs) {
    if (Boolean(config.url) !== Boolean(config.authToken)) {
      throw new Error(`Turso database ${config.id} requires both its URL and auth token.`);
    }
  }

  const configured: TursoShard[] = [];
  let foundMissingDatabase = false;
  shardConfigs.forEach((config, index) => {
    const client = shardClients[index];
    if (!client) {
      foundMissingDatabase = true;
      return;
    }
    if (foundMissingDatabase) {
      throw new Error(`Configure Turso databases in order; database ${config.id} cannot skip a shard.`);
    }
    configured.push({ id: config.id, client });
  });

  return configured;
}

export function getTursoClient(shardId: TursoShardId): Client | null {
  return shardClients[shardId - 1];
}

export async function findUserShards(userIds: readonly string[]): Promise<Map<string, TursoShard>> {
  const ids = Array.from(new Set(userIds.filter(Boolean)));
  if (!ids.length) return new Map();
  const shards = getConfiguredTursoShards();
  await Promise.all(shards.map((shard) => initTursoSchema(shard.client)));

  const mapped = new Map<string, TursoShard>();
  for (let offset = 0; offset < ids.length; offset += 500) {
    const batch = ids.slice(offset, offset + 500);
    const directory = await tursoClient?.execute({
      sql: `SELECT user_id, shard_id FROM account_shards
        WHERE user_id IN (${batch.map(() => '?').join(', ')})`,
      args: batch
    });
    for (const row of directory?.rows || []) {
      const shard = shards.find((candidate) => candidate.id === Number(row.shard_id));
      if (shard) mapped.set(String(row.user_id), shard);
    }
  }

  let unresolvedIds = ids.filter((id) => !mapped.has(id));
  for (const shard of shards) {
    for (let offset = 0; offset < unresolvedIds.length; offset += 500) {
      const batch = unresolvedIds.slice(offset, offset + 500);
      const result = await shard.client.execute({
        sql: `SELECT id FROM users WHERE id IN (${batch.map(() => '?').join(', ')})`,
        args: batch
      });
      for (const row of result.rows) mapped.set(String(row.id), shard);
    }
    unresolvedIds = unresolvedIds.filter((id) => !mapped.has(id));
    if (!unresolvedIds.length) break;
  }
  return mapped;
}

export async function findUserShard(userId: string): Promise<TursoShard | null> {
  const shards = await findUserShards([userId]);
  return shards.get(userId) || null;
}

export async function findPostShard(postId: string): Promise<TursoShard | null> {
  const shards = await findPostShards([postId]);
  return shards.get(postId) || null;
}

export async function findPostShards(postIds: readonly string[]): Promise<Map<string, TursoShard>> {
  const ids = Array.from(new Set(postIds.filter(Boolean)));
  if (!ids.length) return new Map();
  const shards = getConfiguredTursoShards();
  await Promise.all(shards.map((shard) => initTursoSchema(shard.client)));
  const mapped = new Map<string, TursoShard>();
  for (const shard of shards) {
    let unresolvedIds = ids.filter((id) => !mapped.has(id));
    for (let offset = 0; offset < unresolvedIds.length; offset += 500) {
      const batch = unresolvedIds.slice(offset, offset + 500);
      const result = await shard.client.execute({
        sql: `SELECT id FROM posts WHERE id IN (${batch.map(() => '?').join(', ')})`,
        args: batch
      });
      for (const row of result.rows) mapped.set(String(row.id), shard);
    }
    if (mapped.size === ids.length) break;
  }
  return mapped;
}

export async function updateAccountShardIdentity(userId: string, username: string, displayName: string) {
  if (!tursoClient) throw new Error('User storage is unavailable.');
  await initTursoSchema();
  const result = await tursoClient.execute({
    sql: `UPDATE account_shards SET username_key = ?, display_name_key = ?
      WHERE user_id = ?`,
    args: [
      username.trim().toLowerCase() || null,
      displayName.normalize('NFKC').trim().toLowerCase() || null,
      userId
    ]
  });
  if (!result.rowsAffected) throw new Error('Unable to update the account directory.');
}

export async function getShardForNewAccount(): Promise<TursoShard> {
  const shards = getConfiguredTursoShards();
  if (!shards.length) throw new Error('Turso storage is unavailable.');

  for (const shard of shards) {
    const config = shardConfigs[shard.id - 1];
    const maxBytes = Number(config.maxBytes);
    if (!Number.isSafeInteger(maxBytes) || maxBytes <= 0) {
      throw new Error(`Set TURSO_DATABASE${shard.id === 1 ? '' : `_${shard.id}`}_MAX_BYTES to a positive byte limit.`);
    }

    const [pageCountResult, pageSizeResult] = await Promise.all([
      shard.client.execute('PRAGMA page_count'),
      shard.client.execute('PRAGMA page_size')
    ]);
    const pageCount = Number(pageCountResult.rows[0]?.page_count);
    const pageSize = Number(pageSizeResult.rows[0]?.page_size);
    if (!Number.isSafeInteger(pageCount) || pageCount < 0 || !Number.isSafeInteger(pageSize) || pageSize <= 0) {
      throw new Error(`Unable to measure Turso database ${shard.id} usage.`);
    }

    const usedBytes = pageCount * pageSize;
    if (!Number.isSafeInteger(usedBytes)) {
      throw new Error(`Turso database ${shard.id} usage is outside the supported measurement range.`);
    }
    if (usedBytes < maxBytes * 0.95) return shard;
  }

  throw new Error('All configured Turso databases have reached 95% of their configured capacity.');
}

export async function initTursoSchema(client: Client | null = tursoClient) {
  if (!client) return null;

  let schemaPromise = schemaPromises.get(client);
  if (!schemaPromise) {
    const tursoClient = client;
    schemaPromise = (async () => {
      await tursoClient.execute(`
        CREATE TABLE IF NOT EXISTS account_shards (
          user_id TEXT PRIMARY KEY,
          clerk_user_id TEXT NOT NULL UNIQUE,
          email_key TEXT UNIQUE,
          username_key TEXT UNIQUE,
          display_name_key TEXT UNIQUE,
          shard_id INTEGER NOT NULL CHECK (shard_id IN (1, 2, 3)),
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
      `);
      const directoryColumns = await tursoClient.execute('PRAGMA table_info(account_shards)');
      const existingDirectoryColumns = new Set(directoryColumns.rows.map((row) => String(row.name)));
      if (!existingDirectoryColumns.has('username_key')) {
        await tursoClient.execute('ALTER TABLE account_shards ADD COLUMN username_key TEXT');
      }
      if (!existingDirectoryColumns.has('display_name_key')) {
        await tursoClient.execute('ALTER TABLE account_shards ADD COLUMN display_name_key TEXT');
      }
      await tursoClient.execute('CREATE UNIQUE INDEX IF NOT EXISTS account_shards_username_key_unique ON account_shards (username_key) WHERE username_key IS NOT NULL;');
      await tursoClient.execute('CREATE UNIQUE INDEX IF NOT EXISTS account_shards_display_name_key_unique ON account_shards (display_name_key) WHERE display_name_key IS NOT NULL;');

      await tursoClient.execute(`
        CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY,
          clerk_user_id TEXT,
          email TEXT UNIQUE,
          display_name TEXT,
          username TEXT UNIQUE,
          avatar_url TEXT,
          private_profile INTEGER NOT NULL DEFAULT 0,
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
        CREATE TABLE IF NOT EXISTS follow_requests (
          requester_id TEXT NOT NULL,
          target_id TEXT NOT NULL,
          created_at TEXT NOT NULL,
          PRIMARY KEY (requester_id, target_id),
          CHECK (requester_id <> target_id)
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
        CREATE TABLE IF NOT EXISTS saved_collections (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          name TEXT NOT NULL,
          created_at TEXT NOT NULL,
          UNIQUE(user_id, name)
        );
      `);

      await tursoClient.execute(`
        CREATE TABLE IF NOT EXISTS bookmarks (
          user_id TEXT NOT NULL,
          post_id TEXT NOT NULL,
          collection_id TEXT NOT NULL,
          created_at TEXT NOT NULL,
          PRIMARY KEY (user_id, post_id)
        );
      `);

      await tursoClient.execute(`
        CREATE TABLE IF NOT EXISTS pinned_posts (
          user_id TEXT NOT NULL,
          post_id TEXT NOT NULL,
          created_at TEXT NOT NULL,
          PRIMARY KEY (user_id, post_id)
        );
      `);

      await tursoClient.execute(`
        CREATE TABLE IF NOT EXISTS user_interests (
          user_id TEXT NOT NULL,
          interest TEXT NOT NULL,
          created_at TEXT NOT NULL,
          PRIMARY KEY (user_id, interest)
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
      await tursoClient.execute('CREATE INDEX IF NOT EXISTS follow_requests_target_id_idx ON follow_requests (target_id, created_at);');
      await tursoClient.execute('CREATE INDEX IF NOT EXISTS user_verification_requests_status_created_idx ON user_verification_requests (status, created_at);');
      await tursoClient.execute('CREATE INDEX IF NOT EXISTS blocked_users_blocked_idx ON blocked_users (blocked_id, blocker_id);');
      await tursoClient.execute('CREATE INDEX IF NOT EXISTS post_reports_status_created_idx ON post_reports (status, created_at);');
      await tursoClient.execute('CREATE INDEX IF NOT EXISTS post_hashtags_created_at_idx ON post_hashtags (created_at);');
      await tursoClient.execute('CREATE INDEX IF NOT EXISTS post_comments_post_created_idx ON post_comments (post_id, created_at);');
      await tursoClient.execute('CREATE INDEX IF NOT EXISTS post_reposts_post_created_idx ON post_reposts (post_id, created_at);');
      await tursoClient.execute('CREATE INDEX IF NOT EXISTS bookmarks_user_collection_created_idx ON bookmarks (user_id, collection_id, created_at);');
      await tursoClient.execute('CREATE INDEX IF NOT EXISTS pinned_posts_user_created_idx ON pinned_posts (user_id, created_at);');
      await tursoClient.execute('CREATE INDEX IF NOT EXISTS user_interests_interest_idx ON user_interests (interest, user_id);');
      await tursoClient.execute(`
        CREATE UNIQUE INDEX IF NOT EXISTS saved_collections_user_name_ci_unique
        ON saved_collections (user_id, lower(trim(name)))
      `);

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
      if (!existingColumns.has('private_profile')) {
        await tursoClient.execute('ALTER TABLE users ADD COLUMN private_profile INTEGER NOT NULL DEFAULT 0');
      }
      if (!existingColumns.has('clerk_user_id')) {
        await tursoClient.execute('ALTER TABLE users ADD COLUMN clerk_user_id TEXT');
      }
      await tursoClient.execute('CREATE UNIQUE INDEX IF NOT EXISTS users_clerk_user_id_unique ON users (clerk_user_id) WHERE clerk_user_id IS NOT NULL;');

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
      if (!postColumns.rows.some((row) => String(row.name) === 'content_warning')) {
        await tursoClient.execute('ALTER TABLE posts ADD COLUMN content_warning TEXT');
      }

      const commentColumns = await tursoClient.execute('PRAGMA table_info(post_comments)');
      if (!commentColumns.rows.some((row) => String(row.name) === 'parent_comment_id')) {
        await tursoClient.execute('ALTER TABLE post_comments ADD COLUMN parent_comment_id TEXT');
      }

      const draftColumns = await tursoClient.execute('PRAGMA table_info(post_drafts)');
      if (!draftColumns.rows.some((row) => String(row.name) === 'content_warning')) {
        await tursoClient.execute('ALTER TABLE post_drafts ADD COLUMN content_warning TEXT');
      }
    })().catch((error) => {
      schemaPromises.delete(client);
      throw error;
    });
    schemaPromises.set(client, schemaPromise);
  }

  await schemaPromise;

  return client;
}
