import { NextResponse } from 'next/server';
import { getAppUserClient, getAuthenticatedUser } from '@/lib/auth';
import { initTursoSchema, tursoClient } from '@/lib/turso';
import { DEFAULT_THEME, getThemePalette } from '@/lib/themes';

export async function GET(request: Request) {
  if (!tursoClient) return NextResponse.json({ error: 'Settings storage is unavailable.' }, { status: 503 });

  try {
    await initTursoSchema();
    const user = await getAuthenticatedUser();
    if (!user) return NextResponse.json({ error: 'Sign in to load account settings.' }, { status: 401 });
    const client = getAppUserClient(user);

    const result = await client.execute({
      sql: 'SELECT theme_id FROM user_settings WHERE user_id = ?',
      args: [user.uid]
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
    const user = await getAuthenticatedUser();
    if (!user) return NextResponse.json({ error: 'Sign in to update account settings.' }, { status: 401 });
    const client = getAppUserClient(user);

    const body = await request.json();
    const theme = getThemePalette(body?.themeId);
    if (theme.id !== body?.themeId) {
      return NextResponse.json({ error: 'Choose a valid theme palette.' }, { status: 400 });
    }

    await client.execute({
      sql: `INSERT INTO user_settings (user_id, theme_id, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(user_id) DO UPDATE SET theme_id = excluded.theme_id, updated_at = CURRENT_TIMESTAMP`,
      args: [user.uid, theme.id]
    });
    return NextResponse.json({ theme });
  } catch (error) {
    console.error('Unable to save account settings:', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json({ error: 'Unable to save account settings.' }, { status: 500 });
  }
}