import { NextResponse } from 'next/server';
import { verifyIdToken } from '@/lib/firebase';
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

    const existing = await tursoClient.execute({
      sql: 'SELECT 1 FROM follows WHERE follower_id = ? AND following_id = ?',
      args: [user.uid, targetId]
    });
    const isFollowing = Boolean(existing.rows[0]);

    if (isFollowing) {
      await tursoClient.execute({ sql: 'DELETE FROM follows WHERE follower_id = ? AND following_id = ?', args: [user.uid, targetId] });
    } else {
      await tursoClient.execute({
        sql: 'INSERT INTO follows (follower_id, following_id, created_at) VALUES (?, ?, ?)',
        args: [user.uid, targetId, new Date().toISOString()]
      });
      await tursoClient.execute({
        sql: 'INSERT INTO notifications (id, recipient_id, actor_id, type, entity_id, created_at) VALUES (?, ?, ?, ?, ?, ?)',
        args: [`follow_${crypto.randomUUID()}`, targetId, user.uid, 'follow', null, new Date().toISOString()]
      });
    }

    return NextResponse.json({ following: !isFollowing });
  } catch (error) {
    console.error('Unable to update follow:', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json({ error: 'Unable to update follow.' }, { status: 500 });
  }
}