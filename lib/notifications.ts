import type { Client } from '@libsql/client';
import { findUserShards, getConfiguredTursoShards } from '@/lib/turso';

export type NotificationType = 'follow' | 'unfollow' | 'post' | 'like' | 'comment' | 'repost' | 'mention';
export type NotificationCategory = 'follows' | 'posts' | 'reactions' | 'comments' | 'reposts' | 'mentions';

type NotificationInput = {
  id: string;
  recipientId: string;
  actorId: string;
  type: NotificationType;
  entityId: string | null;
  createdAt: string;
};

const categoryByType: Record<NotificationType, NotificationCategory> = {
  follow: 'follows',
  unfollow: 'follows',
  post: 'posts',
  like: 'reactions',
  comment: 'comments',
  repost: 'reposts',
  mention: 'mentions'
};

export function getNotificationCategory(type: NotificationType) {
  return categoryByType[type];
}

export function notificationStatement(notification: NotificationInput) {
  return {
    sql: `INSERT INTO notifications (id, recipient_id, actor_id, type, entity_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?)`,
    args: [
      notification.id,
      notification.recipientId,
      notification.actorId,
      notification.type,
      notification.entityId,
      notification.createdAt
    ]
  };
}

export function notificationIdsFromStatements(statements: readonly ReturnType<typeof notificationStatement>[]) {
  return statements.flatMap((statement) => {
    const id = statement.args[0];
    return typeof id === 'string' ? [id] : [];
  });
}

export async function mentionNotificationStatements(
  _client: Client,
  content: string,
  actorId: string,
  entityId: string,
  createdAt: string
) {
  const usernames = Array.from(new Set(
    Array.from(content.matchAll(/(?:^|[^a-zA-Z0-9_])@([a-zA-Z0-9._-]{3,32})(?![a-zA-Z0-9._-])/g), (match) => match[1].toLowerCase())
  ));
  if (!usernames.length) return [];

  const shards = getConfiguredTursoShards();
  const userResults = await Promise.all(shards.map((shard) => shard.client.execute({
    sql: `SELECT id FROM users WHERE lower(username) IN (${usernames.map(() => '?').join(', ')})`,
    args: usernames
  })));
  const recipientIds = Array.from(new Set(userResults.flatMap((result) =>
    result.rows.map((row) => String(row.id)).filter((id) => id !== actorId)
  )));
  const userShards = await findUserShards([actorId, ...recipientIds]);
  const actorShard = userShards.get(actorId);
  if (!actorShard) return [];

  const visibleRecipients = await Promise.all(recipientIds.map(async (recipientId) => {
    const recipientShard = userShards.get(recipientId);
    if (!recipientShard) return null;
    const [actorBlock, recipientBlock] = await Promise.all([
      actorShard.client.execute({
        sql: 'SELECT 1 FROM blocked_users WHERE blocker_id = ? AND blocked_id = ?',
        args: [actorId, recipientId]
      }),
      recipientShard.client.execute({
        sql: 'SELECT 1 FROM blocked_users WHERE blocker_id = ? AND blocked_id = ?',
        args: [recipientId, actorId]
      })
    ]);
    return actorBlock.rows[0] || recipientBlock.rows[0] ? null : recipientId;
  }));

  return visibleRecipients.filter((id): id is string => Boolean(id)).map((recipientId) => notificationStatement({
    id: `mention_${crypto.randomUUID()}`,
    recipientId,
    actorId,
    type: 'mention',
    entityId,
    createdAt
  }));
}
