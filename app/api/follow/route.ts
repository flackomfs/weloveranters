import { NextResponse } from 'next/server';
import { verifyIdToken } from '@/lib/firebase';
import { notificationStatement } from '@/lib/notifications';
import { initTursoSchema, tursoClient } from '@/lib/turso';
import { sendPushNotifications } from '@/lib/web-push';

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

    const target = await tursoClient.execute({
      sql: 'SELECT id, private_profile FROM users WHERE id = ?',
      args: [targetId]
    });
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

    if (!isFollowing && Number(target.rows[0].private_profile) > 0) {
      const request = await tursoClient.execute({
        sql: 'SELECT 1 FROM follow_requests WHERE requester_id = ? AND target_id = ?',
        args: [user.uid, targetId]
      });
      if (request.rows[0]) {
        await tursoClient.execute({
          sql: 'DELETE FROM follow_requests WHERE requester_id = ? AND target_id = ?',
          args: [user.uid, targetId]
        });
        return NextResponse.json({ following: false, requested: false });
      }
      await tursoClient.execute({
        sql: `INSERT INTO follow_requests (requester_id, target_id, created_at)
          VALUES (?, ?, ?) ON CONFLICT(requester_id, target_id) DO NOTHING`,
        args: [user.uid, targetId, new Date().toISOString()]
      });
      return NextResponse.json({ following: false, requested: true });
    }

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
    const notificationId = `${isFollowing ? 'unfollow' : 'follow'}_${crypto.randomUUID()}`;
    const notification = notificationStatement({
      id: notificationId,
      recipientId: targetId,
      actorId: user.uid,
      type: isFollowing ? 'unfollow' : 'follow',
      entityId: null,
      createdAt: new Date().toISOString()
    });

    if (isFollowing) {
      await tursoClient.batch([
        { sql: 'DELETE FROM follows WHERE follower_id = ? AND following_id = ?', args: [user.uid, targetId] },
        { sql: 'DELETE FROM follow_requests WHERE requester_id = ? AND target_id = ?', args: [user.uid, targetId] },
        updateFollowerCount,
        updateFollowingCount,
        notification
      ], 'write');
    } else {
      await tursoClient.batch([
        {
          sql: 'INSERT INTO follows (follower_id, following_id, created_at) VALUES (?, ?, ?)',
          args: [user.uid, targetId, new Date().toISOString()]
        },
        { sql: 'DELETE FROM follow_requests WHERE requester_id = ? AND target_id = ?', args: [user.uid, targetId] },
        updateFollowerCount,
        updateFollowingCount,
        notification
      ], 'write');
    }

    await sendPushNotifications(tursoClient, [notificationId]);
    return NextResponse.json({ following: !isFollowing });
  } catch (error) {
    console.error('Unable to update follow:', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json({ error: 'Unable to update follow.' }, { status: 500 });
  }
}