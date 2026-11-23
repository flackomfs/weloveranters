import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { notificationStatement } from '@/lib/notifications';
import { initTursoSchema, tursoClient } from '@/lib/turso';
import { sendPushNotifications } from '@/lib/web-push';

export async function GET(request: Request) {
  if (!tursoClient) return NextResponse.json({ error: 'Follow requests are unavailable.' }, { status: 503 });

  try {
    await initTursoSchema();
    const user = await getAuthenticatedUser();
    if (!user) return NextResponse.json({ error: 'Sign in to view follow requests.' }, { status: 401 });

    const result = await tursoClient.execute({
      sql: `SELECT r.requester_id AS requesterId, r.created_at AS createdAt,
          CASE WHEN COALESCE(u.private_profile, 0) = 1 AND NOT EXISTS (
            SELECT 1 FROM follows f WHERE f.follower_id = ? AND f.following_id = u.id
          ) THEN u.username ELSE u.display_name END AS name,
          u.username, u.avatar_url AS avatarUrl
        FROM follow_requests r
        INNER JOIN users u ON u.id = r.requester_id
        WHERE r.target_id = ?
        ORDER BY r.created_at ASC
        LIMIT 100`,
      args: [user.uid, user.uid]
    });
    return NextResponse.json({ requests: result.rows }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('Unable to load follow requests:', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json({ error: 'Unable to load follow requests.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!tursoClient) return NextResponse.json({ error: 'Follow requests are unavailable.' }, { status: 503 });

  try {
    await initTursoSchema();
    const user = await getAuthenticatedUser();
    if (!user) return NextResponse.json({ error: 'Sign in to manage follow requests.' }, { status: 401 });

    const body = await request.json();
    const requesterId = typeof body.requesterId === 'string' ? body.requesterId : '';
    const action = body.action === 'approve' || body.action === 'reject' ? body.action : '';
    if (!requesterId || requesterId === user.uid || !action) {
      return NextResponse.json({ error: 'Choose a valid follow request action.' }, { status: 400 });
    }

    const requestExists = await tursoClient.execute({
      sql: 'SELECT 1 FROM follow_requests WHERE requester_id = ? AND target_id = ?',
      args: [requesterId, user.uid]
    });
    if (!requestExists.rows[0]) return NextResponse.json({ error: 'Follow request not found.' }, { status: 404 });

    if (action === 'reject') {
      await tursoClient.execute({
        sql: 'DELETE FROM follow_requests WHERE requester_id = ? AND target_id = ?',
        args: [requesterId, user.uid]
      });
      return NextResponse.json({ approved: false });
    }

    const existingFollow = await tursoClient.execute({
      sql: 'SELECT 1 FROM follows WHERE follower_id = ? AND following_id = ?',
      args: [requesterId, user.uid]
    });
    if (existingFollow.rows[0]) {
      await tursoClient.execute({
        sql: 'DELETE FROM follow_requests WHERE requester_id = ? AND target_id = ?',
        args: [requesterId, user.uid]
      });
      return NextResponse.json({ approved: true });
    }

    const now = new Date().toISOString();
    const notificationId = `follow_${crypto.randomUUID()}`;
    const notification = notificationStatement({
      id: notificationId,
      recipientId: user.uid,
      actorId: requesterId,
      type: 'follow',
      entityId: null,
      createdAt: now
    });
    await tursoClient.batch([
      {
        sql: `INSERT INTO follows (follower_id, following_id, created_at)
          SELECT ?, ?, ? WHERE EXISTS (
            SELECT 1 FROM follow_requests WHERE requester_id = ? AND target_id = ?
          )
          ON CONFLICT(follower_id, following_id) DO NOTHING`,
        args: [requesterId, user.uid, now, requesterId, user.uid]
      },
      {
        sql: `UPDATE users SET followers_override = CASE
            WHEN followers_override IS NULL THEN NULL
            ELSE followers_override + 1
          END WHERE id = ? AND EXISTS (
            SELECT 1 FROM follow_requests WHERE requester_id = ? AND target_id = ?
          ) AND changes() > 0`,
        args: [user.uid, requesterId, user.uid]
      },
      {
        sql: `UPDATE users SET following_override = CASE
            WHEN following_override IS NULL THEN NULL
            ELSE following_override + 1
          END WHERE id = ? AND EXISTS (
            SELECT 1 FROM follow_requests WHERE requester_id = ? AND target_id = ?
          ) AND changes() > 0`,
        args: [requesterId, requesterId, user.uid]
      },
      { sql: 'DELETE FROM follow_requests WHERE requester_id = ? AND target_id = ?', args: [requesterId, user.uid] },
      {
        ...notification,
        sql: `${notification.sql} AND EXISTS (
          SELECT 1 FROM follows WHERE follower_id = ? AND following_id = ?
        )`,
        args: [...notification.args, requesterId, user.uid]
      }
    ], 'write');

    await sendPushNotifications(tursoClient, [notificationId]);
    return NextResponse.json({ approved: true });
  } catch (error) {
    console.error('Unable to manage follow request:', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json({ error: 'Unable to manage follow request.' }, { status: 500 });
  }
}
