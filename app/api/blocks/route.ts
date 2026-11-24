import { NextResponse } from 'next/server';
import { getAppUserClient, getAuthenticatedUser } from '@/lib/auth';
import { findUserShard, initTursoSchema, tursoClient } from '@/lib/turso';

export async function POST(request: Request) {
  if (!tursoClient) return NextResponse.json({ error: 'Block storage is unavailable.' }, { status: 503 });
  try {
    await initTursoSchema();
    const user = await getAuthenticatedUser();
    if (!user) return NextResponse.json({ error: 'Sign in to block users.' }, { status: 401 });
    const actorClient = getAppUserClient(user);
    const body = await request.json();
    const targetId = typeof body?.targetId === 'string' ? body.targetId : '';
    if (!targetId || targetId === user.uid) return NextResponse.json({ error: 'Invalid user to block.' }, { status: 400 });
    const targetShard = await findUserShard(targetId);
    if (!targetShard) return NextResponse.json({ error: 'User not found.' }, { status: 404 });
    const targetClient = targetShard.client;
    const target = await targetClient.execute({ sql: 'SELECT id FROM users WHERE id = ?', args: [targetId] });
    if (!target.rows[0]) return NextResponse.json({ error: 'User not found.' }, { status: 404 });

    const existing = await actorClient.execute({
      sql: 'SELECT 1 FROM blocked_users WHERE blocker_id = ? AND blocked_id = ?',
      args: [user.uid, targetId]
    });
    const blocked = Boolean(existing.rows[0]);
    if (blocked) {
      await actorClient.execute({
        sql: 'DELETE FROM blocked_users WHERE blocker_id = ? AND blocked_id = ?',
        args: [user.uid, targetId]
      });
    } else {
      const [actorFollow, targetFollow] = await Promise.all([
        actorClient.execute({
          sql: 'SELECT 1 FROM follows WHERE follower_id = ? AND following_id = ?',
          args: [user.uid, targetId]
        }),
        targetClient.execute({
          sql: 'SELECT 1 FROM follows WHERE follower_id = ? AND following_id = ?',
          args: [targetId, user.uid]
        })
      ]);
      const actorFollows = Boolean(actorFollow.rows[0]);
      const targetFollows = Boolean(targetFollow.rows[0]);
      await actorClient.execute({
        sql: 'INSERT INTO blocked_users (blocker_id, blocked_id, created_at) VALUES (?, ?, ?)',
        args: [user.uid, targetId, new Date().toISOString()]
      });
      await Promise.all([
        actorClient.batch([
          { sql: 'DELETE FROM follows WHERE follower_id = ? AND following_id = ?', args: [user.uid, targetId] },
          { sql: 'DELETE FROM follow_requests WHERE requester_id = ? AND target_id = ?', args: [targetId, user.uid] }
        ], 'write'),
        targetClient.batch([
          { sql: 'DELETE FROM follows WHERE follower_id = ? AND following_id = ?', args: [targetId, user.uid] },
          { sql: 'DELETE FROM follow_requests WHERE requester_id = ? AND target_id = ?', args: [user.uid, targetId] }
        ], 'write')
      ]);
      const actorStatements = [];
      const targetStatements = [];
      if (actorFollows) {
        targetStatements.push(
          { sql: 'UPDATE users SET followers_override = MAX(0, followers_override - 1) WHERE id = ? AND followers_override IS NOT NULL', args: [targetId] }
        );
        actorStatements.push(
          { sql: 'UPDATE users SET following_override = MAX(0, following_override - 1) WHERE id = ? AND following_override IS NOT NULL', args: [user.uid] }
        );
      }
      if (targetFollows) {
        actorStatements.push(
          { sql: 'UPDATE users SET followers_override = MAX(0, followers_override - 1) WHERE id = ? AND followers_override IS NOT NULL', args: [user.uid] }
        );
        targetStatements.push(
          { sql: 'UPDATE users SET following_override = MAX(0, following_override - 1) WHERE id = ? AND following_override IS NOT NULL', args: [targetId] }
        );
      }
      await Promise.all([
        actorStatements.length ? actorClient.batch(actorStatements, 'write') : Promise.resolve(),
        targetStatements.length ? targetClient.batch(targetStatements, 'write') : Promise.resolve()
      ]);
    }
    return NextResponse.json({ blocked: !blocked });
  } catch (error) {
    console.error('Unable to update block:', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json({ error: 'Unable to update block.' }, { status: 500 });
  }
}
