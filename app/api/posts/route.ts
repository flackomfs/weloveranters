import { NextResponse } from 'next/server';
import { verifyIdToken } from '@/lib/firebase';
import { initTursoSchema, tursoClient } from '@/lib/turso';

function getBearerToken(request: Request) {
  const authorization = request.headers.get('authorization') || '';
  return authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
}

export async function GET(request: Request) {
  if (!tursoClient) {
    return NextResponse.json({ posts: [], available: false }, { headers: { 'Cache-Control': 'no-store' } });
  }

  try {
    await initTursoSchema();
    const username = new URL(request.url).searchParams.get('username');
    const result = username
      ? await tursoClient.execute({
          sql: `SELECT p.id, p.content, p.created_at AS createdAt, p.user_id AS userId,
              p.likes, p.comments, p.reposts, u.display_name AS authorName,
              u.username AS authorUsername, u.avatar_url AS avatarUrl
            FROM posts p LEFT JOIN users u ON u.id = p.user_id
            WHERE u.username = ? ORDER BY p.created_at DESC LIMIT 100`,
          args: [username.toLowerCase()]
        })
      : await tursoClient.execute(`
          SELECT p.id, p.content, p.created_at AS createdAt, p.user_id AS userId,
            p.likes, p.comments, p.reposts, u.display_name AS authorName,
            u.username AS authorUsername, u.avatar_url AS avatarUrl
          FROM posts p LEFT JOIN users u ON u.id = p.user_id
          ORDER BY p.created_at DESC LIMIT 100
        `);

    const posts = result.rows.map((row) => ({
      ...row,
      tags: (String(row.content).match(/#[a-zA-Z0-9_]+/g) || []).map((tag) => tag.slice(1).toLowerCase())
    }));

    return NextResponse.json({ posts, available: true }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('Unable to load posts:', error instanceof Error ? error.message : 'Unknown database error');
    return NextResponse.json({ error: 'Unable to load posts.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const content = typeof body?.content === 'string' ? body.content.trim() : '';

    if (!content) {
      return NextResponse.json({ error: 'Content is required.' }, { status: 400 });
    }

    if (!tursoClient) {
      return NextResponse.json({ error: 'Post storage is unavailable.' }, { status: 503 });
    }

    const token = getBearerToken(request);
    if (!token) return NextResponse.json({ error: 'Sign in before posting.' }, { status: 401 });

    let user;
    try {
      user = await verifyIdToken(token);
    } catch {
      return NextResponse.json({ error: 'Your session expired. Sign in again.' }, { status: 401 });
    }

    await initTursoSchema();
    const emailName = user.email?.split('@')[0] || 'user';
    const usernameBase = emailName.toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 20) || 'user';
    const defaultUsername = `${usernameBase}_${user.uid.slice(0, 6).toLowerCase()}`;
    await tursoClient.execute({
      sql: `INSERT INTO users (id, email, display_name, username, avatar_url)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          email = COALESCE(users.email, excluded.email),
          display_name = COALESCE(users.display_name, excluded.display_name),
          username = COALESCE(users.username, excluded.username),
          avatar_url = COALESCE(users.avatar_url, excluded.avatar_url)`,
      args: [user.uid, user.email || '', user.name || emailName, defaultUsername, user.picture || '']
    });

    const createdAt = new Date().toISOString();
    const id = `rant_${crypto.randomUUID()}`;
    await tursoClient.execute({
      sql: 'INSERT INTO posts (id, user_id, content, created_at) VALUES (?, ?, ?, ?)',
      args: [id, user.uid, content, createdAt]
    });

    const hashtags: string[] = [];
    for (const match of content.match(/#[a-zA-Z0-9_]+/g) || []) {
      const hashtag = match.slice(1).toLowerCase();
      if (!hashtags.includes(hashtag)) hashtags.push(hashtag);
    }
    for (const hashtag of hashtags) {
      await tursoClient.execute({
        sql: 'INSERT INTO post_hashtags (hashtag, post_id, created_at) VALUES (?, ?, ?)',
        args: [hashtag, id, createdAt]
      });
    }

    return NextResponse.json({ ok: true, message: 'Rant created successfully.', post: { id, content, createdAt, userId: user.uid } });
  } catch (error) {
    console.error('Unable to create post:', error instanceof Error ? error.message : 'Unknown database error');
    return NextResponse.json({
      error: 'Unable to create rant at this time.'
    }, { status: 500 });
  }
}
