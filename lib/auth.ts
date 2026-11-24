import { auth, currentUser } from '@clerk/nextjs/server';
import {
  getConfiguredTursoShards,
  getShardForNewAccount,
  initTursoSchema,
  getTursoClient,
  type TursoShardId,
  tursoClient
} from '@/lib/turso';
import type { Client } from '@libsql/client';

export type AppUser = {
  uid: string;
  clerkUserId: string;
  email: string;
  name: string;
  picture: string;
  shardId: TursoShardId;
};

export function getAppUserClient(user: Pick<AppUser, 'shardId'>): Client {
  const client = getTursoClient(user.shardId);
  if (!client) throw new Error(`Turso database ${user.shardId} is not configured.`);
  return client;
}

export async function getAuthenticatedUser(): Promise<AppUser | null> {
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) return null;

  const clerkUser = await currentUser();
  if (!clerkUser) return null;

  if (!tursoClient) throw new Error('User storage is unavailable.');
  const shards = getConfiguredTursoShards();
  await Promise.all(shards.map((shard) => initTursoSchema(shard.client)));

  const emailAddress = clerkUser.emailAddresses.find(
    (address) => address.id === clerkUser.primaryEmailAddressId
  );
  const email = emailAddress?.emailAddress || '';
  const isVerifiedEmail = emailAddress?.verification?.status === 'verified';
  const emailKey = isVerifiedEmail && email ? email.trim().toLowerCase() : null;
  const name = clerkUser.fullName || clerkUser.firstName || email.split('@')[0] || 'New user';
  const picture = clerkUser.imageUrl || '';

  const directoryByClerkId = await tursoClient.execute({
    sql: 'SELECT user_id, shard_id FROM account_shards WHERE clerk_user_id = ?',
    args: [clerkUserId]
  });
  let accountId = directoryByClerkId.rows[0]?.user_id;
  let shardId = Number(directoryByClerkId.rows[0]?.shard_id) as TursoShardId | undefined;

  if (!accountId && emailKey) {
    const directoryByEmail = await tursoClient.execute({
      sql: 'SELECT user_id, clerk_user_id, shard_id FROM account_shards WHERE email_key = ?',
      args: [emailKey]
    });
    const row = directoryByEmail.rows[0];
    if (row && row.clerk_user_id !== clerkUserId) {
      throw new Error('This verified email is already linked to another account.');
    }
    accountId = row?.user_id;
    shardId = row ? Number(row.shard_id) as TursoShardId : undefined;
  }

  if (!accountId) {
    for (const shard of shards) {
      const existing = await shard.client.execute({
        sql: `SELECT id, clerk_user_id FROM users
          WHERE clerk_user_id = ?${emailKey ? ' OR lower(email) = lower(?)' : ''}
          LIMIT 1`,
        args: emailKey ? [clerkUserId, email] : [clerkUserId]
      });
      const row = existing.rows[0];
      if (!row) continue;
      if (row.clerk_user_id && row.clerk_user_id !== clerkUserId) {
        throw new Error('This verified email is already linked to another account.');
      }
      accountId = row.id;
      shardId = shard.id;
      break;
    }
  }

  if (!accountId || !shardId) {
    if (shards.length === 1 && !process.env.TURSO_DATABASE_MAX_BYTES) {
      shardId = 1;
    } else {
      shardId = (await getShardForNewAccount()).id;
    }
    accountId = clerkUserId;
  }

  const shard = shards.find((candidate) => candidate.id === shardId);
  if (!shard) throw new Error(`Turso database ${shardId} is not configured.`);

  const uid = String(accountId);
  const existingAccount = await shard.client.execute({
    sql: 'SELECT id, clerk_user_id FROM users WHERE id = ?',
    args: [uid]
  });
  if (existingAccount.rows[0]?.clerk_user_id && existingAccount.rows[0].clerk_user_id !== clerkUserId) {
    throw new Error('This account is already linked to another Clerk user.');
  }

  await shard.client.execute({
    sql: `INSERT INTO users (id, clerk_user_id, email)
      VALUES (?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        clerk_user_id = COALESCE(users.clerk_user_id, excluded.clerk_user_id),
        email = COALESCE(users.email, excluded.email)`,
    args: [uid, clerkUserId, emailKey]
  });

  const profileIdentity = await shard.client.execute({
    sql: 'SELECT username, display_name FROM users WHERE id = ?',
    args: [uid]
  });
  const usernameKey = String(profileIdentity.rows[0]?.username || '').trim().toLowerCase() || null;
  const displayNameKey = String(profileIdentity.rows[0]?.display_name || '').normalize('NFKC').trim().toLowerCase() || null;
  await tursoClient.execute({
    sql: `INSERT INTO account_shards
        (user_id, clerk_user_id, email_key, username_key, display_name_key, shard_id)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(clerk_user_id) DO UPDATE SET
        email_key = COALESCE(account_shards.email_key, excluded.email_key),
        username_key = COALESCE(account_shards.username_key, excluded.username_key),
        display_name_key = COALESCE(account_shards.display_name_key, excluded.display_name_key),
        shard_id = excluded.shard_id
      WHERE account_shards.user_id = excluded.user_id`,
    args: [uid, clerkUserId, emailKey, usernameKey, displayNameKey, shardId]
  });

  if (emailKey) {
    await shard.client.execute({
      sql: 'UPDATE users SET email = COALESCE(email, ?) WHERE id = ?',
      args: [emailKey, uid]
    });
  }

  return { uid, clerkUserId, email: isVerifiedEmail ? email : '', name, picture, shardId };
}
