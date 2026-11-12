import { NextResponse } from 'next/server';
import { verifyIdToken } from '@/lib/firebase';
import { initTursoSchema, tursoClient } from '@/lib/turso';

export async function POST(request: Request) {
  if (!tursoClient) return NextResponse.json({ error: 'Block storage is unavailable.' }, { status: 503 });
  try {
    await initTursoSchema();
    const authorization = request.headers.get('authorization') || '';
    const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
    if (!token) return NextResponse.json({ error: 'Sign in to block users.' }, { status: 401 });
    const user = await verifyIdToken(token);
    const body = await request.json();
    const targetId = typeof body?.targetId === 'string' ? body.targetId : '';
    if (!targetId || targetId === user.uid) return NextResponse.json({ error: 'Invalid user to block.' }, { status: 400 });
    const target = await tursoClient.execute({ sql: 'SELECT id FROM users WHERE id = ?', args: [targetId] });
    if (!target.rows[0]) return NextResponse.json({ error: 'User not found.' }, { status: 404 });

    const existing = await tursoClient.execute({
      sql: 'SELECT 1 FROM blocked_users WHERE blocker_id = ? AND blocked_id = ?',
      args: [user.uid, targetId]
    });
    const blocked = Boolean(existing.rows[0]);
    if (blocked) {
      await tursoClient.execute({
        sql: 'DELETE FROM blocked_users WHERE blocker_id = ? AND blocked_id = ?',
        args: [user.uid, targetId]
      });
    } else {
      const relationships = await tursoClient.execute({
        sql: `SELECT
          EXISTS (SELECT 1 FROM follows WHERE follower_id = ? AND following_id = ?) AS actorFollows,
          EXISTS (SELECT 1 FROM follows WHERE follower_id = ? AND following_id = ?) AS targetFollows`,
        args: [user.uid, targetId, targetId, user.uid]
      });
      const actorFollows = Number(relationships.rows[0]?.actorFollows) > 0;
      const targetFollows = Number(relationships.rows[0]?.targetFollows) > 0;
      const statements = [
        { sql: 'INSERT INTO blocked_users (blocker_id, blocked_id, created_at) VALUES (?, ?, ?)', args: [user.uid, targetId, new Date().toISOString()] },
        { sql: 'DELETE FROM follows WHERE (follower_id = ? AND following_id = ?) OR (follower_id = ? AND following_id = ?)', args: [user.uid, targetId, targetId, user.uid] }
      ];
      if (actorFollows) {
        statements.push(
          { sql: 'UPDATE users SET followers_override = MAX(0, followers_override - 1) WHERE id = ? AND followers_override IS NOT NULL', args: [targetId] },
          { sql: 'UPDATE users SET following_override = MAX(0, following_override - 1) WHERE id = ? AND following_override IS NOT NULL', args: [user.uid] }
        );
      }
      if (targetFollows) {
        statements.push(
          { sql: 'UPDATE users SET followers_override = MAX(0, followers_override - 1) WHERE id = ? AND followers_override IS NOT NULL', args: [user.uid] },
          { sql: 'UPDATE users SET following_override = MAX(0, following_override - 1) WHERE id = ? AND following_override IS NOT NULL', args: [targetId] }
        );
      }
      await tursoClient.batch(statements, 'write');
    }
    return NextResponse.json({ blocked: !blocked });
  } catch (error) {
    console.error('Unable to update block:', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json({ error: 'Unable to update block.' }, { status: 500 });
  }
}
