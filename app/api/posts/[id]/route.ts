import { NextResponse } from 'next/server';
import { isAdminUid } from '@/lib/admin';
import { verifyIdToken } from '@/lib/firebase';
import { initTursoSchema, tursoClient } from '@/lib/turso';

type RouteContext = { params: { id: string } };

function getBearerToken(request: Request) {
  const authorization = request.headers.get('authorization') || '';
  return authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
}

async function getActorProfile(client: NonNullable<typeof tursoClient>, uid: string, email?: string, displayName?: string) {
  const result = await client.execute({
    sql: 'SELECT display_name, username FROM users WHERE id = ?',
    args: [uid]
  });
  const emailName = email?.split('@')[0] || 'user';
  const usernameBase = emailName.toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 20) || 'user';
  return {
    name: String(result.rows[0]?.display_name || displayName || emailName),
    username: String(result.rows[0]?.username || `${usernameBase}_${uid.slice(0, 6).toLowerCase()}`)
  };
}

export async function GET(_request: Request, { params }: RouteContext) {
  if (!tursoClient) return NextResponse.json({ error: 'Post storage is unavailable.' }, { status: 503 });

  try {
    await initTursoSchema();
    const post = await tursoClient.execute({ sql: 'SELECT id FROM posts WHERE id = ?', args: [params.id] });
    if (!post.rows[0]) return NextResponse.json({ error: 'Post not found.' }, { status: 404 });

    const result = await tursoClient.execute({
      sql: `SELECT c.id, c.content, c.created_at AS createdAt, c.user_id AS userId,
          COALESCE(u.display_name, c.author_name) AS authorName,
          COALESCE(u.username, c.author_username) AS authorUsername,
          u.avatar_url AS avatarUrl
        FROM post_comments c
        LEFT JOIN users u ON u.id = c.user_id
        WHERE c.post_id = ?
        ORDER BY c.created_at ASC
        LIMIT 100`,
      args: [params.id]
    });

    const comments = result.rows.map((row) => ({
      ...row,
      avatarUrl: String(row.avatarUrl || '').startsWith('data:image/')
        ? `/api/profile/photo?uid=${encodeURIComponent(String(row.userId))}`
        : row.avatarUrl
    }));
    return NextResponse.json({ comments }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('Unable to load post comments:', error instanceof Error ? error.message : 'Unknown database error');
    return NextResponse.json({ error: 'Unable to load comments.' }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: RouteContext) {
  if (!tursoClient) return NextResponse.json({ error: 'Post storage is unavailable.' }, { status: 503 });

  try {
    await initTursoSchema();
    const token = getBearerToken(request);
    if (!token) return NextResponse.json({ error: 'Sign in to interact with posts.' }, { status: 401 });

    let user;
    try {
      user = await verifyIdToken(token);
    } catch {
      return NextResponse.json({ error: 'Your session expired. Sign in again.' }, { status: 401 });
    }

    const post = await tursoClient.execute({ sql: 'SELECT id, user_id FROM posts WHERE id = ?', args: [params.id] });
    if (!post.rows[0]) return NextResponse.json({ error: 'Post not found.' }, { status: 404 });
    const postAuthorId = String(post.rows[0].user_id);

    const rawBody = await request.json();
    if (!rawBody || typeof rawBody !== 'object' || Array.isArray(rawBody)) {
      return NextResponse.json({ error: 'Choose a valid post action.' }, { status: 400 });
    }
    const body = rawBody as Record<string, unknown>;
    const action = typeof body.action === 'string' ? body.action : '';

    if (action === 'like') {
      const statements = [
        { sql: 'UPDATE posts SET likes = COALESCE(likes, 0) + 1 WHERE id = ?', args: [params.id] }
      ];
      if (postAuthorId !== user.uid) {
        statements.push({
          sql: 'INSERT INTO notifications (id, recipient_id, actor_id, type, entity_id, created_at) VALUES (?, ?, ?, ?, ?, ?)',
          args: [`like_${crypto.randomUUID()}`, postAuthorId, user.uid, 'like', params.id, new Date().toISOString()]
        });
      }
      statements.push({ sql: 'SELECT likes FROM posts WHERE id = ?', args: [params.id] });
      const results = await tursoClient.batch(statements, 'write');
      return NextResponse.json({ likes: Number(results[results.length - 1].rows[0]?.likes || 0) });
    }

    const actor = await getActorProfile(tursoClient, user.uid, user.email, user.name);
    if (action === 'comment') {
      const content = typeof body.content === 'string' ? body.content.trim() : '';
      if (!content || content.length > 500) {
        return NextResponse.json({ error: 'Comments must be between 1 and 500 characters.' }, { status: 400 });
      }

      const comment = {
        id: `comment_${crypto.randomUUID()}`,
        postId: params.id,
        userId: user.uid,
        authorName: actor.name,
        authorUsername: actor.username,
        content,
        createdAt: new Date().toISOString()
      };
      const statements = [
        {
          sql: `INSERT INTO post_comments
            (id, post_id, user_id, author_name, author_username, content, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
          args: [comment.id, comment.postId, comment.userId, comment.authorName, comment.authorUsername, comment.content, comment.createdAt]
        }
      ];
      if (postAuthorId !== user.uid) {
        statements.push({
          sql: 'INSERT INTO notifications (id, recipient_id, actor_id, type, entity_id, created_at) VALUES (?, ?, ?, ?, ?, ?)',
          args: [`comment_${crypto.randomUUID()}`, postAuthorId, user.uid, 'comment', params.id, comment.createdAt]
        });
      }
      statements.push({ sql: 'SELECT COUNT(*) AS count FROM post_comments WHERE post_id = ?', args: [params.id] });
      const results = await tursoClient.batch(statements, 'write');
      return NextResponse.json({ comment, comments: Number(results[results.length - 1].rows[0]?.count || 0) });
    }

    if (action === 'repost') {
      const statements = [
        {
          sql: `INSERT INTO post_reposts (user_id, post_id, author_name, author_username, created_at)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(user_id, post_id) DO NOTHING`,
          args: [user.uid, params.id, actor.name, actor.username, new Date().toISOString()]
        }
      ];
      if (postAuthorId !== user.uid) {
        statements.push({
          sql: `INSERT INTO notifications (id, recipient_id, actor_id, type, entity_id, created_at)
            SELECT ?, ?, ?, ?, ?, ? WHERE changes() > 0`,
          args: [`repost_${crypto.randomUUID()}`, postAuthorId, user.uid, 'repost', params.id, new Date().toISOString()]
        });
      }
      statements.push({ sql: 'SELECT COUNT(*) AS count FROM post_reposts WHERE post_id = ?', args: [params.id] });
      const results = await tursoClient.batch(statements, 'write');
      return NextResponse.json({ reposted: true, reposts: Number(results[results.length - 1].rows[0]?.count || 0) });
    }

    return NextResponse.json({ error: 'Choose a valid post action.' }, { status: 400 });
  } catch (error) {
    console.error('Unable to update post:', error instanceof Error ? error.message : 'Unknown database error');
    return NextResponse.json({ error: 'Unable to update post.' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: RouteContext) {
  if (!tursoClient) return NextResponse.json({ error: 'Post storage is unavailable.' }, { status: 503 });

  try {
    await initTursoSchema();
    const token = getBearerToken(request);
    if (!token) return NextResponse.json({ error: 'Sign in to delete posts.' }, { status: 401 });

    let user;
    try {
      user = await verifyIdToken(token);
    } catch {
      return NextResponse.json({ error: 'Your session expired. Sign in again.' }, { status: 401 });
    }

    const post = await tursoClient.execute({ sql: 'SELECT id, user_id FROM posts WHERE id = ?', args: [params.id] });
    if (!post.rows[0]) return NextResponse.json({ error: 'Post not found.' }, { status: 404 });
    if (!isAdminUid(user.uid) && String(post.rows[0].user_id) !== user.uid) {
      return NextResponse.json({ error: 'You can only delete your own posts.' }, { status: 403 });
    }

    await tursoClient.batch([
      { sql: 'DELETE FROM post_comments WHERE post_id = ?', args: [params.id] },
      { sql: 'DELETE FROM post_reposts WHERE post_id = ?', args: [params.id] },
      { sql: 'DELETE FROM post_hashtags WHERE post_id = ?', args: [params.id] },
      { sql: 'DELETE FROM notifications WHERE entity_id = ?', args: [params.id] },
      { sql: 'DELETE FROM posts WHERE id = ?', args: [params.id] }
    ], 'write');

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Unable to delete post:', error instanceof Error ? error.message : 'Unknown database error');
    return NextResponse.json({ error: 'Unable to delete post.' }, { status: 500 });
  }
}
