import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { initTursoSchema, tursoClient } from '@/lib/turso';

export async function GET(request: Request) {
  if (!tursoClient) return NextResponse.json({ error: 'Notifications are unavailable.' }, { status: 503 });

  try {
    await initTursoSchema();
    const user = await getAuthenticatedUser();
    if (!user) return NextResponse.json({ error: 'Sign in to view notifications.' }, { status: 401 });

    const result = await tursoClient.execute({
      sql: `SELECT n.id, n.type, n.entity_id AS entityId, n.created_at AS createdAt,
          n.read_at AS readAt, a.display_name AS actorName, a.username AS actorUsername,
          p.content AS postContent
        FROM notifications n
        LEFT JOIN users a ON a.id = n.actor_id
        LEFT JOIN posts p ON p.id = n.entity_id
        LEFT JOIN users post_author ON post_author.id = p.user_id
        LEFT JOIN notification_preferences np
          ON np.user_id = n.recipient_id
          AND np.type = CASE
            WHEN n.type IN ('follow', 'unfollow') THEN 'follows'
            WHEN n.type = 'post' THEN 'posts'
            WHEN n.type = 'like' THEN 'reactions'
            WHEN n.type = 'comment' THEN 'comments'
            WHEN n.type = 'repost' THEN 'reposts'
            WHEN n.type = 'mention' THEN 'mentions'
          END
        WHERE n.recipient_id = ?
          AND COALESCE(np.enabled, 1) = 1
          AND (n.type IN ('follow', 'unfollow') OR p.id IS NOT NULL)
          AND (p.id IS NULL OR COALESCE(post_author.private_profile, 0) = 0
            OR post_author.id = ? OR EXISTS (
              SELECT 1 FROM follows f WHERE f.follower_id = ? AND f.following_id = post_author.id
            ))
        ORDER BY n.created_at DESC
        LIMIT 100`,
      args: [user.uid, user.uid, user.uid]
    });

    return NextResponse.json({ notifications: result.rows }, { headers: { 'Cache-Control': 'no-store' } });
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

    const body = await request.json();
    const notificationId = typeof body.id === 'string' ? body.id : '';
    if (notificationId) {
      await tursoClient.execute({
        sql: 'UPDATE notifications SET read_at = ? WHERE id = ? AND recipient_id = ?',
        args: [new Date().toISOString(), notificationId, user.uid]
      });
    } else {
      await tursoClient.execute({
        sql: 'UPDATE notifications SET read_at = ? WHERE recipient_id = ? AND read_at IS NULL',
        args: [new Date().toISOString(), user.uid]
      });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Unable to update notifications:', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json({ error: 'Unable to update notifications.' }, { status: 500 });
  }
}