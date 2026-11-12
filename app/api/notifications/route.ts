import { NextResponse } from 'next/server';
import { verifyIdToken } from '@/lib/firebase';
import { initTursoSchema, tursoClient } from '@/lib/turso';

async function getUserId(request: Request) {
  const authorization = request.headers.get('authorization') || '';
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
  if (!token) return null;
  const user = await verifyIdToken(token);
  return user.uid;
}

export async function GET(request: Request) {
  if (!tursoClient) return NextResponse.json({ error: 'Notifications are unavailable.' }, { status: 503 });

  try {
    await initTursoSchema();
    const userId = await getUserId(request);
    if (!userId) return NextResponse.json({ error: 'Sign in to view notifications.' }, { status: 401 });

    const result = await tursoClient.execute({
      sql: `SELECT n.id, n.type, n.entity_id AS entityId, n.created_at AS createdAt,
          n.read_at AS readAt, a.display_name AS actorName, a.username AS actorUsername,
          p.content AS postContent
        FROM notifications n
        LEFT JOIN users a ON a.id = n.actor_id
        LEFT JOIN posts p ON p.id = n.entity_id
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
        ORDER BY n.created_at DESC
        LIMIT 100`,
      args: [userId]
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
    const userId = await getUserId(request);
    if (!userId) return NextResponse.json({ error: 'Sign in to update notifications.' }, { status: 401 });

    const body = await request.json();
    const notificationId = typeof body.id === 'string' ? body.id : '';
    if (notificationId) {
      await tursoClient.execute({
        sql: 'UPDATE notifications SET read_at = ? WHERE id = ? AND recipient_id = ?',
        args: [new Date().toISOString(), notificationId, userId]
      });
    } else {
      await tursoClient.execute({
        sql: 'UPDATE notifications SET read_at = ? WHERE recipient_id = ? AND read_at IS NULL',
        args: [new Date().toISOString(), userId]
      });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Unable to update notifications:', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json({ error: 'Unable to update notifications.' }, { status: 500 });
  }
}