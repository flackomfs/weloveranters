import { NextResponse } from 'next/server';
import { verifyIdToken } from '@/lib/firebase';
import { notificationStatement } from '@/lib/notifications';
import { initTursoSchema, tursoClient } from '@/lib/turso';

export async function POST(request: Request) {
  if (!tursoClient) return NextResponse.json({ error: 'Follow storage is unavailable.' }, { status: 503 });

  try {
    await initTursoSchema();
    const authorization = request.headers.get('authorization') || '';
    const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
    if (!token) return NextResponse.json({ error: 'Sign in to follow users.' }, { status: 401 });

    const user = await verifyIdToken(token);
    const body = await request.json();
    const targetId = typeof body.targetId === 'string' ? body.targetId : '';
    if (!targetId || targetId === user.uid) return NextResponse.json({ error: 'Invalid profile to follow.' }, { status: 400 });

    const target = await tursoClient.execute({ sql: 'SELECT id FROM users WHERE id = ?', args: [targetId] });
    if (!target.rows[0]) return NextResponse.json({ error: 'Profile not found.' }, { status: 404 });
    const block = await tursoClient.execute({
      sql: `SELECT 1 FROM blocked_users
        WHERE (blocker_id = ? AND blocked_id = ?) OR (blocker_id = ? AND blocked_id = ?)`,
      args: [user.uid, targetId, targetId, user.uid]
    });
    if (block.rows[0]) return NextResponse.json({ error: 'You cannot follow a user while either account has blocked the other.' }, { status: 403 });

    const existing = await tursoClient.execute({
      sql: 'SELECT 1 FROM follows WHERE follower_id = ? AND following_id = ?',
      args: [user.uid, targetId]
    });
    const isFollowing = Boolean(existing.rows[0]);

    const countDelta = isFollowing ? -1 : 1;
    const updateFollowerCount = {
      sql: `UPDATE users SET followers_override = CASE
          WHEN followers_override IS NULL THEN NULL
          ELSE MAX(0, followers_override + ?)
        END WHERE id = ?`,
      args: [countDelta, targetId]
    };
    const updateFollowingCount = {
      sql: `UPDATE users SET following_override = CASE
          WHEN following_override IS NULL THEN NULL
          ELSE MAX(0, following_override + ?)
        END WHERE id = ?`,
      args: [countDelta, user.uid]
    };

    if (isFollowing) {
      await tursoClient.batch([
        { sql: 'DELETE FROM follows WHERE follower_id = ? AND following_id = ?', args: [user.uid, targetId] },
        updateFollowerCount,
        updateFollowingCount,
        notificationStatement({
          id: `unfollow_${crypto.randomUUID()}`, recipientId: targetId, actorId: user.uid,
          type: 'unfollow', entityId: null, createdAt: new Date().toISOString()
        })
      ], 'write');
    } else {
      await tursoClient.batch([
        {
          sql: 'INSERT INTO follows (follower_id, following_id, created_at) VALUES (?, ?, ?)',
          args: [user.uid, targetId, new Date().toISOString()]
        },
        updateFollowerCount,
        updateFollowingCount,
        notificationStatement({
          id: `follow_${crypto.randomUUID()}`, recipientId: targetId, actorId: user.uid,
          type: 'follow', entityId: null, createdAt: new Date().toISOString()
        })
      ], 'write');
    }

    return NextResponse.json({ following: !isFollowing });
  } catch (error) {
    console.error('Unable to update follow:', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json({ error: 'Unable to update follow.' }, { status: 500 });
  }
}