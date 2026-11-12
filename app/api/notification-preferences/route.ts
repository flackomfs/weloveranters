import { NextResponse } from 'next/server';
import { verifyIdToken } from '@/lib/firebase';
import { initTursoSchema, tursoClient } from '@/lib/turso';

const categories = ['follows', 'posts', 'reactions', 'comments', 'reposts', 'mentions'] as const;
type Category = typeof categories[number];

async function getUserId(request: Request) {
  const authorization = request.headers.get('authorization') || '';
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
  if (!token) return null;
  return (await verifyIdToken(token)).uid;
}

export async function GET(request: Request) {
  if (!tursoClient) return NextResponse.json({ error: 'Notification settings are unavailable.' }, { status: 503 });
  try {
    await initTursoSchema();
    const userId = await getUserId(request);
    if (!userId) return NextResponse.json({ error: 'Sign in to load notification settings.' }, { status: 401 });
    const result = await tursoClient.execute({
      sql: 'SELECT type, enabled FROM notification_preferences WHERE user_id = ?',
      args: [userId]
    });
    const stored = new Map(result.rows.map((row) => [String(row.type), Number(row.enabled) !== 0]));
    return NextResponse.json({
      preferences: Object.fromEntries(categories.map((category) => [category, stored.get(category) ?? true]))
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('Unable to load notification settings:', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json({ error: 'Unable to load notification settings.' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  if (!tursoClient) return NextResponse.json({ error: 'Notification settings are unavailable.' }, { status: 503 });
  try {
    await initTursoSchema();
    const userId = await getUserId(request);
    if (!userId) return NextResponse.json({ error: 'Sign in to update notification settings.' }, { status: 401 });
    const body = await request.json();
    if (!body?.preferences || typeof body.preferences !== 'object' || Array.isArray(body.preferences)) {
      return NextResponse.json({ error: 'Provide notification preferences.' }, { status: 400 });
    }

    const statements = categories.map((category: Category) => ({
      sql: `INSERT INTO notification_preferences (user_id, type, enabled) VALUES (?, ?, ?)
        ON CONFLICT(user_id, type) DO UPDATE SET enabled = excluded.enabled`,
      args: [userId, category, body.preferences[category] === false ? 0 : 1]
    }));
    await tursoClient.batch(statements, 'write');
    return NextResponse.json({
      preferences: Object.fromEntries(categories.map((category) => [category, body.preferences[category] !== false]))
    });
  } catch (error) {
    console.error('Unable to save notification settings:', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json({ error: 'Unable to save notification settings.' }, { status: 500 });
  }
}
