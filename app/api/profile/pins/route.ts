import { NextResponse } from 'next/server';
import { getAppUserClient, getAuthenticatedUser } from '@/lib/auth';
import { initTursoSchema, tursoClient } from '@/lib/turso';

export async function POST(request: Request) {
  if (!tursoClient) return NextResponse.json({ error: 'Profile storage is unavailable.' }, { status: 503 });
  try {
    await initTursoSchema();
    const user = await getAuthenticatedUser();
    if (!user) return NextResponse.json({ error: 'Sign in to pin posts.' }, { status: 401 });
    const client = getAppUserClient(user);
    const body = await request.json();
    const postId = typeof body?.postId === 'string' ? body.postId : '';
    if (!postId) return NextResponse.json({ error: 'Choose a post to pin.' }, { status: 400 });
    const post = await client.execute({
      sql: 'SELECT id FROM posts WHERE id = ? AND user_id = ?',
      args: [postId, user.uid]
    });
    if (!post.rows[0]) return NextResponse.json({ error: 'You can only pin your own posts.' }, { status: 403 });
    const existing = await client.execute({
      sql: 'SELECT 1 FROM pinned_posts WHERE user_id = ? AND post_id = ?',
      args: [user.uid, postId]
    });
    if (existing.rows[0]) return NextResponse.json({ pinned: true });
    const result = await client.execute({
      sql: `INSERT INTO pinned_posts (user_id, post_id, created_at)
        SELECT ?, ?, ? WHERE (SELECT COUNT(*) FROM pinned_posts WHERE user_id = ?) < 3
        ON CONFLICT(user_id, post_id) DO NOTHING`,
      args: [user.uid, postId, new Date().toISOString(), user.uid]
    });
    if (!result.rowsAffected) {
      return NextResponse.json({ error: 'You can pin up to 3 posts. Unpin one before adding another.' }, { status: 409 });
    }
    return NextResponse.json({ pinned: true });
  } catch (error) {
    console.error('Unable to pin post:', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json({ error: 'Unable to pin post.' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  if (!tursoClient) return NextResponse.json({ error: 'Profile storage is unavailable.' }, { status: 503 });
  try {
    await initTursoSchema();
    const user = await getAuthenticatedUser();
    if (!user) return NextResponse.json({ error: 'Sign in to unpin posts.' }, { status: 401 });
    const client = getAppUserClient(user);
    const body = await request.json();
    const postId = typeof body?.postId === 'string' ? body.postId : '';
    if (!postId) return NextResponse.json({ error: 'Choose a post to unpin.' }, { status: 400 });
    await client.execute({
      sql: 'DELETE FROM pinned_posts WHERE user_id = ? AND post_id = ?',
      args: [user.uid, postId]
    });
    return NextResponse.json({ pinned: false });
  } catch (error) {
    console.error('Unable to unpin post:', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json({ error: 'Unable to unpin post.' }, { status: 500 });
  }
}
