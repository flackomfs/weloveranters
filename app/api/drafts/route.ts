import { NextResponse } from 'next/server';
import { getAppUserClient, getAuthenticatedUser } from '@/lib/auth';
import { initTursoSchema, tursoClient } from '@/lib/turso';

export async function GET(request: Request) {
  if (!tursoClient) return NextResponse.json({ error: 'Draft storage is unavailable.' }, { status: 503 });
  try {
    await initTursoSchema();
    const user = await getAuthenticatedUser();
    if (!user) return NextResponse.json({ error: 'Sign in to load your draft.' }, { status: 401 });
    const client = getAppUserClient(user);
    const result = await client.execute({
      sql: 'SELECT content, content_warning AS contentWarning, updated_at AS updatedAt FROM post_drafts WHERE user_id = ?',
      args: [user.uid]
    });
    return NextResponse.json({ draft: result.rows[0] || null }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('Unable to load post draft:', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json({ error: 'Unable to load post draft.' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  if (!tursoClient) return NextResponse.json({ error: 'Draft storage is unavailable.' }, { status: 503 });
  try {
    await initTursoSchema();
    const user = await getAuthenticatedUser();
    if (!user) return NextResponse.json({ error: 'Sign in to save your draft.' }, { status: 401 });
    const client = getAppUserClient(user);
    const body = await request.json();
    const content = typeof body?.content === 'string' ? body.content : '';
    const contentWarning = typeof body?.contentWarning === 'string' ? body.contentWarning.normalize('NFKC').trim() : '';
    if (body?.contentWarning !== undefined && typeof body.contentWarning !== 'string') {
      return NextResponse.json({ error: 'Content warning must be text.' }, { status: 400 });
    }
    if (content.length > 2000) return NextResponse.json({ error: 'Drafts must be 2000 characters or fewer.' }, { status: 400 });
    if (contentWarning.length > 80) return NextResponse.json({ error: 'Content warnings must be 80 characters or fewer.' }, { status: 400 });
    if (!content.trim()) {
      await client.execute({ sql: 'DELETE FROM post_drafts WHERE user_id = ?', args: [user.uid] });
    } else {
      await client.execute({
        sql: `INSERT INTO post_drafts (user_id, content, content_warning, updated_at) VALUES (?, ?, ?, ?)
          ON CONFLICT(user_id) DO UPDATE SET
            content = excluded.content,
            content_warning = excluded.content_warning,
            updated_at = excluded.updated_at`,
        args: [user.uid, content, contentWarning || null, new Date().toISOString()]
      });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Unable to save post draft:', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json({ error: 'Unable to save post draft.' }, { status: 500 });
  }
}
