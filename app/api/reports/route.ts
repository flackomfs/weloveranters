import { NextResponse } from 'next/server';
import { isAdminUid } from '@/lib/admin';
import { getAuthenticatedUser } from '@/lib/auth';
import { canViewUserContent } from '@/lib/profile-privacy';
import { findPostShard, findUserShards, getConfiguredTursoShards, initTursoSchema, tursoClient } from '@/lib/turso';

export async function GET(request: Request) {
  if (!tursoClient) return NextResponse.json({ error: 'Reports are unavailable.' }, { status: 503 });
  try {
    await initTursoSchema();
    const user = await getAuthenticatedUser();
    if (!user || !isAdminUid(user.uid)) return NextResponse.json({ error: 'Admin access required.' }, { status: user ? 403 : 401 });
    const shards = getConfiguredTursoShards();
    const results = await Promise.all(shards.map((shard) => shard.client.execute({
      sql: `SELECT r.id, r.post_id AS postId, r.reporter_id AS reporterId, r.reason, r.details,
          r.status, r.created_at AS createdAt, p.content AS postContent,
          a.display_name AS authorName
        FROM post_reports r
        LEFT JOIN posts p ON p.id = r.post_id
        LEFT JOIN users a ON a.id = p.user_id
        WHERE r.status = 'pending'
        ORDER BY r.created_at ASC`,
      args: []
    })));
    const reportRows = results.flatMap((result) => result.rows.map((row) => ({
      id: String(row.id),
      postId: String(row.postId),
      reporterId: String(row.reporterId),
      reason: String(row.reason),
      details: String(row.details || ''),
      status: String(row.status),
      createdAt: String(row.createdAt),
      postContent: String(row.postContent || ''),
      authorName: String(row.authorName || 'Member')
    })));
    const reporterShards = await findUserShards(reportRows.map((row) => row.reporterId));
    const reporterIdsByShard = new Map<number, { client: (typeof shards)[number]['client']; ids: string[] }>();
    reporterShards.forEach((shard, reporterId) => {
      const group = reporterIdsByShard.get(shard.id) || { client: shard.client, ids: [] };
      group.ids.push(reporterId);
      reporterIdsByShard.set(shard.id, group);
    });
    const reporterResults = await Promise.all(Array.from(reporterIdsByShard.values()).map(({ client, ids }) =>
      client.execute({
        sql: `SELECT id, display_name AS reporterName, username AS reporterUsername
          FROM users WHERE id IN (${ids.map(() => '?').join(', ')})`,
        args: ids
      })
    ));
    const reporterProfiles = new Map(reporterResults.flatMap((result) => result.rows.map((row) => [
      String(row.id),
      { name: String(row.reporterName || 'Member'), username: String(row.reporterUsername || '') }
    ] as const)));
    const reports = reportRows.map((row) => ({
      ...row,
      reporterName: reporterProfiles.get(row.reporterId)?.name || 'Member',
      reporterUsername: reporterProfiles.get(row.reporterId)?.username || ''
    }));
    return NextResponse.json({ reports: reports.sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt))) }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('Unable to load reports:', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json({ error: 'Unable to load reports.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!tursoClient) return NextResponse.json({ error: 'Reports are unavailable.' }, { status: 503 });
  try {
    await initTursoSchema();
    const user = await getAuthenticatedUser();
    if (!user) return NextResponse.json({ error: 'Sign in to report posts.' }, { status: 401 });
    const body = await request.json();
    const postId = typeof body?.postId === 'string' ? body.postId : '';
    const reason = typeof body?.reason === 'string' ? body.reason : '';
    const details = typeof body?.details === 'string' ? body.details.trim() : '';
    if (!postId || !['harassment', 'hate', 'spam', 'explicit', 'other'].includes(reason) || details.length > 500) {
      return NextResponse.json({ error: 'Choose a report reason and provide no more than 500 detail characters.' }, { status: 400 });
    }

    const postShard = await findPostShard(postId);
    if (!postShard) return NextResponse.json({ error: 'Post not found.' }, { status: 404 });
    const post = await postShard.client.execute({ sql: 'SELECT user_id FROM posts WHERE id = ?', args: [postId] });
    if (!post.rows[0]) return NextResponse.json({ error: 'Post not found.' }, { status: 404 });
    if (String(post.rows[0].user_id) === user.uid) return NextResponse.json({ error: 'You cannot report your own post.' }, { status: 400 });
    if (!await canViewUserContent(postShard.client, String(post.rows[0].user_id), user.uid)) {
      return NextResponse.json({ error: 'Post not found.' }, { status: 404 });
    }

    await postShard.client.execute({
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
    const user = await getAuthenticatedUser();
    if (!user || !isAdminUid(user.uid)) return NextResponse.json({ error: 'Admin access required.' }, { status: user ? 403 : 401 });
    const body = await request.json();
    const id = typeof body?.id === 'string' ? body.id : '';
    const status = body?.status;
    if (!id || (status !== 'reviewed' && status !== 'dismissed')) {
      return NextResponse.json({ error: 'Choose a pending report and a valid decision.' }, { status: 400 });
    }
    const shards = getConfiguredTursoShards();
    const results = await Promise.all(shards.map((shard) => shard.client.execute({
      sql: `UPDATE post_reports SET status = ?, reviewed_at = ?, reviewed_by = ?
        WHERE id = ? AND status = 'pending'`,
      args: [status, new Date().toISOString(), user.uid, id]
    })));
    if (!results.some((result) => result.rowsAffected)) return NextResponse.json({ error: 'That report is no longer pending.' }, { status: 409 });
    return NextResponse.json({ status });
  } catch (error) {
    console.error('Unable to review report:', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json({ error: 'Unable to review report.' }, { status: 500 });
  }
}
