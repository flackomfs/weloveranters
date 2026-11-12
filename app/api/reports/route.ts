import { NextResponse } from 'next/server';
import { isAdminUid } from '@/lib/admin';
import { verifyIdToken } from '@/lib/firebase';
import { initTursoSchema, tursoClient } from '@/lib/turso';

async function getUser(request: Request) {
  const authorization = request.headers.get('authorization') || '';
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
  if (!token) return null;
  return verifyIdToken(token);
}

export async function GET(request: Request) {
  if (!tursoClient) return NextResponse.json({ error: 'Reports are unavailable.' }, { status: 503 });
  try {
    await initTursoSchema();
    const user = await getUser(request);
    if (!user || !isAdminUid(user.uid)) return NextResponse.json({ error: 'Admin access required.' }, { status: user ? 403 : 401 });
    const result = await tursoClient.execute({
      sql: `SELECT r.id, r.post_id AS postId, r.reporter_id AS reporterId, r.reason, r.details,
          r.status, r.created_at AS createdAt, u.display_name AS reporterName, u.username AS reporterUsername,
          p.content AS postContent, a.display_name AS authorName
        FROM post_reports r
        LEFT JOIN users u ON u.id = r.reporter_id
        LEFT JOIN posts p ON p.id = r.post_id
        LEFT JOIN users a ON a.id = p.user_id
        WHERE r.status = 'pending'
        ORDER BY r.created_at ASC`,
      args: []
    });
    return NextResponse.json({ reports: result.rows }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('Unable to load reports:', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json({ error: 'Unable to load reports.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!tursoClient) return NextResponse.json({ error: 'Reports are unavailable.' }, { status: 503 });
  try {
    await initTursoSchema();
    const user = await getUser(request);
    if (!user) return NextResponse.json({ error: 'Sign in to report posts.' }, { status: 401 });
    const body = await request.json();
    const postId = typeof body?.postId === 'string' ? body.postId : '';
    const reason = typeof body?.reason === 'string' ? body.reason : '';
    const details = typeof body?.details === 'string' ? body.details.trim() : '';
    if (!postId || !['harassment', 'hate', 'spam', 'explicit', 'other'].includes(reason) || details.length > 500) {
      return NextResponse.json({ error: 'Choose a report reason and provide no more than 500 detail characters.' }, { status: 400 });
    }

    const post = await tursoClient.execute({ sql: 'SELECT user_id FROM posts WHERE id = ?', args: [postId] });
    if (!post.rows[0]) return NextResponse.json({ error: 'Post not found.' }, { status: 404 });
    if (String(post.rows[0].user_id) === user.uid) return NextResponse.json({ error: 'You cannot report your own post.' }, { status: 400 });

    await tursoClient.execute({
      sql: `INSERT INTO post_reports (id, post_id, reporter_id, reason, details, status, created_at)
        VALUES (?, ?, ?, ?, ?, 'pending', ?)
        ON CONFLICT(post_id, reporter_id) DO NOTHING`,
      args: [`report_${crypto.randomUUID()}`, postId, user.uid, reason, details, new Date().toISOString()]
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Unable to submit report:', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json({ error: 'Unable to submit report.' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  if (!tursoClient) return NextResponse.json({ error: 'Reports are unavailable.' }, { status: 503 });
  try {
    await initTursoSchema();
    const user = await getUser(request);
    if (!user || !isAdminUid(user.uid)) return NextResponse.json({ error: 'Admin access required.' }, { status: user ? 403 : 401 });
    const body = await request.json();
    const id = typeof body?.id === 'string' ? body.id : '';
    const status = body?.status;
    if (!id || (status !== 'reviewed' && status !== 'dismissed')) {
      return NextResponse.json({ error: 'Choose a pending report and a valid decision.' }, { status: 400 });
    }
    const result = await tursoClient.execute({
      sql: `UPDATE post_reports SET status = ?, reviewed_at = ?, reviewed_by = ?
        WHERE id = ? AND status = 'pending'`,
      args: [status, new Date().toISOString(), user.uid, id]
    });
    if (!result.rowsAffected) return NextResponse.json({ error: 'That report is no longer pending.' }, { status: 409 });
    return NextResponse.json({ status });
  } catch (error) {
    console.error('Unable to review report:', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json({ error: 'Unable to review report.' }, { status: 500 });
  }
}
