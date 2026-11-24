import { NextResponse } from 'next/server';
import type { Client } from '@libsql/client';
import { getAppUserClient, getAuthenticatedUser } from '@/lib/auth';
import { notificationStatement } from '@/lib/notifications';
import { findUserShard, findUserShards, initTursoSchema, tursoClient } from '@/lib/turso';
import { sendPushNotifications } from '@/lib/web-push';

export async function GET(request: Request) {
  if (!tursoClient) return NextResponse.json({ error: 'Follow requests are unavailable.' }, { status: 503 });

  try {
    await initTursoSchema();
    const user = await getAuthenticatedUser();
    if (!user) return NextResponse.json({ error: 'Sign in to view follow requests.' }, { status: 401 });
    const userClient = getAppUserClient(user);

    const result = await userClient.execute({
      sql: `SELECT r.requester_id AS requesterId, r.created_at AS createdAt,
          r.requester_id AS userId
        FROM follow_requests r
        WHERE r.target_id = ?
        ORDER BY r.created_at ASC
        LIMIT 100`,
      args: [user.uid]
    });
    const requesterIds = Array.from(new Set(result.rows.map((row) => String(row.requesterId))));
    const requesterShards = await findUserShards(requesterIds);
    const idsByShard = new Map<number, { client: Client; ids: string[] }>();
    requesterShards.forEach((shard, requesterId) => {
      const group = idsByShard.get(shard.id) || { client: shard.client, ids: [] };
      group.ids.push(requesterId);
      idsByShard.set(shard.id, group);
    });
    const requesterResults = await Promise.all(Array.from(idsByShard.values()).map(({ client, ids }) =>
      client.execute({
        sql: `SELECT id, display_name, username, avatar_url, private_profile FROM users
          WHERE id IN (${ids.map(() => '?').join(', ')})`,
        args: ids
      })
    ));
    const requesterProfiles = new Map(requesterResults.flatMap((entry) => entry.rows.map((row) => [
      String(row.id),
      {
        displayName: String(row.display_name || ''),
        username: String(row.username || ''),
        avatarUrl: String(row.avatar_url || ''),
        isPrivate: Number(row.private_profile) > 0
      }
    ] as const)));
    const followedIds = requesterIds.length
      ? new Set((await userClient.execute({
        sql: `SELECT following_id FROM follows
          WHERE follower_id = ? AND following_id IN (${requesterIds.map(() => '?').join(', ')})`,
        args: [user.uid, ...requesterIds]
      })).rows.map((row) => String(row.following_id)))
      : new Set<string>();
    const requests = result.rows.flatMap((row) => {
      const requesterId = String(row.requesterId);
      const requester = requesterProfiles.get(requesterId);
      if (!requester) return [];
      return [{
        requesterId,
        createdAt: row.createdAt,
        name: requester.isPrivate && !followedIds.has(requesterId) ? requester.username : requester.displayName,
        username: requester.username,
        avatarUrl: requester.avatarUrl
      }];
    });
    return NextResponse.json({ requests }, { headers: { 'Cache-Control': 'no-store' } });
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
    const targetClient = getAppUserClient(user);

    const body = await request.json();
    const requesterId = typeof body.requesterId === 'string' ? body.requesterId : '';
    const action = body.action === 'approve' || body.action === 'reject' ? body.action : '';
    if (!requesterId || requesterId === user.uid || !action) {
      return NextResponse.json({ error: 'Choose a valid follow request action.' }, { status: 400 });
    }

    const requestExists = await targetClient.execute({
      sql: 'SELECT 1 FROM follow_requests WHERE requester_id = ? AND target_id = ?',
      args: [requesterId, user.uid]
    });
    if (!requestExists.rows[0]) return NextResponse.json({ error: 'Follow request not found.' }, { status: 404 });

    if (action === 'reject') {
      await targetClient.execute({
        sql: 'DELETE FROM follow_requests WHERE requester_id = ? AND target_id = ?',
        args: [requesterId, user.uid]
      });
      return NextResponse.json({ approved: false });
    }

    const requesterShard = await findUserShard(requesterId);
    if (!requesterShard) return NextResponse.json({ error: 'Follow request not found.' }, { status: 404 });
    const requesterClient = requesterShard.client;
    const existingFollow = await requesterClient.execute({
      sql: 'SELECT 1 FROM follows WHERE follower_id = ? AND following_id = ?',
      args: [requesterId, user.uid]
    });
    if (existingFollow.rows[0]) {
      await targetClient.execute({
        sql: 'DELETE FROM follow_requests WHERE requester_id = ? AND target_id = ?',
        args: [requesterId, user.uid]
      });
      return NextResponse.json({ approved: true });
    }

    const now = new Date().toISOString();
    const notificationId = `follow_${crypto.randomUUID()}`;
    const followResult = await requesterClient.execute({
      sql: `INSERT INTO follows (follower_id, following_id, created_at)
        VALUES (?, ?, ?) ON CONFLICT(follower_id, following_id) DO NOTHING`,
      args: [requesterId, user.uid, now]
    });
    await targetClient.execute({
      sql: 'DELETE FROM follow_requests WHERE requester_id = ? AND target_id = ?',
      args: [requesterId, user.uid]
    });
    if (followResult.rowsAffected) {
      await targetClient.execute({
        sql: `UPDATE users SET followers_override = CASE
            WHEN followers_override IS NULL THEN NULL
            ELSE followers_override + 1
          END WHERE id = ?`,
        args: [user.uid]
      });
      await requesterClient.execute({
        sql: `UPDATE users SET following_override = CASE
            WHEN following_override IS NULL THEN NULL
            ELSE following_override + 1
          END WHERE id = ?`,
        args: [requesterId]
      });
    }

    const notification = notificationStatement({
      id: notificationId,
      recipientId: user.uid,
      actorId: requesterId,
      type: 'follow',
      entityId: null,
      createdAt: now
    });
    if (followResult.rowsAffected) {
      await targetClient.execute(notification);
      await sendPushNotifications(targetClient, [notificationId]);
    }
    return NextResponse.json({ approved: true });
  } catch (error) {
    console.error('Unable to manage follow request:', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json({ error: 'Unable to manage follow request.' }, { status: 500 });
  }
}
