import { NextResponse } from 'next/server';
import { getAppUserClient, getAuthenticatedUser } from '@/lib/auth';
import { findPostShards, findUserShards, getConfiguredTursoShards, initTursoSchema, tursoClient } from '@/lib/turso';
import { getNotificationCategory, type NotificationType } from '@/lib/notifications';

export async function GET(request: Request) {
  if (!tursoClient) return NextResponse.json({ error: 'Notifications are unavailable.' }, { status: 503 });

  try {
    await initTursoSchema();
    const user = await getAuthenticatedUser();
    if (!user) return NextResponse.json({ error: 'Sign in to view notifications.' }, { status: 401 });
    const userClient = getAppUserClient(user);
    const shards = getConfiguredTursoShards();

    const [notificationResults, preferenceResult, followResult] = await Promise.all([
      Promise.all(shards.map((shard) => shard.client.execute({
        sql: `SELECT id, type, entity_id AS entityId, actor_id AS actorId,
            created_at AS createdAt, read_at AS readAt
          FROM notifications WHERE recipient_id = ? ORDER BY created_at DESC LIMIT 100`,
        args: [user.uid]
      }))),
      userClient.execute({
        sql: 'SELECT type, enabled FROM notification_preferences WHERE user_id = ?',
        args: [user.uid]
      }),
      userClient.execute({
        sql: 'SELECT following_id FROM follows WHERE follower_id = ?',
        args: [user.uid]
      })
    ]);
    const preferences = new Map(preferenceResult.rows.map((row) => [String(row.type), Number(row.enabled) !== 0]));
    const entries = notificationResults.flatMap((result) => result.rows)
      .filter((row) => preferences.get(getNotificationCategory(String(row.type) as NotificationType)) !== false)
      .sort((left, right) => String(right.createdAt).localeCompare(String(left.createdAt)))
      .slice(0, 100);
    const postShards = await findPostShards(entries.map((row) => String(row.entityId || '')));
    const postIdsByShard = new Map<number, { client: (typeof shards)[number]['client']; ids: string[] }>();
    postShards.forEach((shard, postId) => {
      const group = postIdsByShard.get(shard.id) || { client: shard.client, ids: [] };
      group.ids.push(postId);
      postIdsByShard.set(shard.id, group);
    });
    const postResults = await Promise.all(Array.from(postIdsByShard.values()).map(({ client, ids }) =>
      client.execute({
        sql: `SELECT p.id, p.content, p.user_id AS authorId, COALESCE(u.private_profile, 0) AS authorPrivate
          FROM posts p LEFT JOIN users u ON u.id = p.user_id
          WHERE p.id IN (${ids.map(() => '?').join(', ')})`,
        args: ids
      })
    ));
    const posts = new Map(postResults.flatMap((result) => result.rows.map((row) => [
      String(row.id),
      {
        content: String(row.content || ''),
        authorId: String(row.authorId),
        private: Number(row.authorPrivate) > 0
      }
    ] as const)));
    const userIds = Array.from(new Set([
      ...entries.map((row) => String(row.actorId)),
      ...Array.from(posts.values(), (post) => post.authorId)
    ]));
    const userShards = await findUserShards(userIds);
    const userIdsByShard = new Map<number, { client: (typeof shards)[number]['client']; ids: string[] }>();
    for (const userId of userIds) {
      const shard = userShards.get(userId);
      if (!shard) continue;
      const group = userIdsByShard.get(shard.id) || { client: shard.client, ids: [] };
      group.ids.push(userId);
      userIdsByShard.set(shard.id, group);
    }
    const userResults = await Promise.all(Array.from(userIdsByShard.values()).map(({ client, ids }) =>
      client.execute({
        sql: `SELECT id, display_name, username FROM users
          WHERE id IN (${ids.map(() => '?').join(', ')})`,
        args: ids
      })
    ));
    const profiles = new Map(userResults.flatMap((result) => result.rows.map((row) => [
      String(row.id),
      { name: String(row.display_name || 'Someone'), username: String(row.username || '') }
    ] as const)));
    const followedIds = new Set(followResult.rows.map((row) => String(row.following_id)));
    const notifications = entries.flatMap((row) => {
      const entityId = typeof row.entityId === 'string' ? row.entityId : '';
      const post = entityId ? posts.get(entityId) : null;
      if (entityId && (!post || (post.private && post.authorId !== user.uid && !followedIds.has(post.authorId)))) {
        return [];
      }
      const actor = profiles.get(String(row.actorId));
      return [{
        ...row,
        actorName: actor?.name || 'Someone',
        actorUsername: actor?.username || '',
        postContent: post?.content || null
      }];
    });

    return NextResponse.json({ notifications: notifications.filter((notification) => notification !== null) }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('Unable to load notifications:', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json({ error: 'Unable to load notifications.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!tursoClient) return NextResponse.json({ error: 'Notifications are unavailable.' }, { status: 503 });

  try {
    await initTursoSchema();
    const user = await getAuthenticatedUser();
    if (!user) return NextResponse.json({ error: 'Sign in to update notifications.' }, { status: 401 });
    const shards = getConfiguredTursoShards();

    const body = await request.json();
    const notificationId = typeof body.id === 'string' ? body.id : '';
    if (notificationId) {
      await Promise.all(shards.map((shard) => shard.client.execute({
        sql: 'UPDATE notifications SET read_at = ? WHERE id = ? AND recipient_id = ?',
        args: [new Date().toISOString(), notificationId, user.uid]
      })));
    } else {
      await Promise.all(shards.map((shard) => shard.client.execute({
        sql: 'UPDATE notifications SET read_at = ? WHERE recipient_id = ? AND read_at IS NULL',
        args: [new Date().toISOString(), user.uid]
      })));
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Unable to update notifications:', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json({ error: 'Unable to update notifications.' }, { status: 500 });
  }
}