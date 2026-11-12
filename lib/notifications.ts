import type { Client } from '@libsql/client';

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

export function notificationStatement(notification: NotificationInput) {
  return {
    sql: `INSERT INTO notifications (id, recipient_id, actor_id, type, entity_id, created_at)
      SELECT ?, ?, ?, ?, ?, ?
      WHERE COALESCE((
        SELECT enabled FROM notification_preferences
        WHERE user_id = ? AND type = ?
      ), 1) = 1`,
    args: [
      notification.id,
      notification.recipientId,
      notification.actorId,
      notification.type,
      notification.entityId,
      notification.createdAt,
      notification.recipientId,
      categoryByType[notification.type]
    ]
  };
}

export async function mentionNotificationStatements(
  client: Client,
  content: string,
  actorId: string,
  entityId: string,
  createdAt: string
) {
  const usernames = Array.from(new Set(
    Array.from(content.matchAll(/(?:^|[^a-zA-Z0-9_])@([a-zA-Z0-9_]{3,24})\b/g), (match) => match[1].toLowerCase())
  ));
  if (!usernames.length) return [];

  const users = await client.execute({
    sql: `SELECT id FROM users
      WHERE lower(username) IN (${usernames.map(() => '?').join(', ')})
        AND id <> ?
        AND NOT EXISTS (
          SELECT 1 FROM blocked_users
          WHERE (blocker_id = id AND blocked_id = ?)
            OR (blocker_id = ? AND blocked_id = id)
        )`,
    args: [...usernames, actorId, actorId, actorId]
  });

  return users.rows.map((row) => notificationStatement({
    id: `mention_${crypto.randomUUID()}`,
    recipientId: String(row.id),
    actorId,
    type: 'mention',
    entityId,
    createdAt
  }));
}
