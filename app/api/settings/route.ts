import { NextResponse } from 'next/server';
import { verifyIdToken } from '@/lib/firebase';
import { initTursoSchema, tursoClient } from '@/lib/turso';
import { DEFAULT_THEME, getThemePalette } from '@/lib/themes';

async function getUserId(request: Request) {
  const authorization = request.headers.get('authorization') || '';
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
  if (!token) return null;
  const user = await verifyIdToken(token);
  return user.uid;
}

export async function GET(request: Request) {
  if (!tursoClient) return NextResponse.json({ error: 'Settings storage is unavailable.' }, { status: 503 });

  try {
    await initTursoSchema();
    const userId = await getUserId(request);
    if (!userId) return NextResponse.json({ error: 'Sign in to load account settings.' }, { status: 401 });

    const result = await tursoClient.execute({
      sql: 'SELECT theme_id FROM user_settings WHERE user_id = ?',
      args: [userId]
    });
    return NextResponse.json({ theme: getThemePalette(result.rows[0]?.theme_id || DEFAULT_THEME.id) });
  } catch (error) {
    console.error('Unable to load account settings:', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json({ error: 'Unable to load account settings.' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  if (!tursoClient) return NextResponse.json({ error: 'Settings storage is unavailable.' }, { status: 503 });

  try {
    await initTursoSchema();
    const userId = await getUserId(request);
    if (!userId) return NextResponse.json({ error: 'Sign in to update account settings.' }, { status: 401 });

    const body = await request.json();
    const theme = getThemePalette(body?.themeId);
    if (theme.id !== body?.themeId) {
      return NextResponse.json({ error: 'Choose a valid theme palette.' }, { status: 400 });
    }

    await tursoClient.execute({
      sql: `INSERT INTO user_settings (user_id, theme_id, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(user_id) DO UPDATE SET theme_id = excluded.theme_id, updated_at = CURRENT_TIMESTAMP`,
      args: [userId, theme.id]
    });
    return NextResponse.json({ theme });
  } catch (error) {
    console.error('Unable to save account settings:', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json({ error: 'Unable to save account settings.' }, { status: 500 });
  }
}