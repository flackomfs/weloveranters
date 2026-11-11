import { NextResponse } from 'next/server';
import { verifyIdToken } from '@/lib/firebase';
import { initTursoSchema, tursoClient } from '@/lib/turso';

const demoPosts: Array<{
  id: string;
  content: string;
  createdAt: string;
  userId?: string;
}> = [];

export async function GET() {
  if (tursoClient) {
    try {
      await initTursoSchema();
      const result = await tursoClient.execute(
        'SELECT id, content, created_at AS createdAt, user_id AS userId FROM posts ORDER BY created_at DESC LIMIT 100'
      );

      return NextResponse.json({ message: 'Posts loaded.', status: 'ok', posts: result.rows });
    } catch (error) {
      return NextResponse.json({ error: 'Unable to load posts.' }, { status: 500 });
    }
  }

  return NextResponse.json({ message: 'Posts endpoint ready.', status: 'ok', posts: demoPosts });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const content = typeof body?.content === 'string' ? body.content.trim() : '';

    if (!content) {
      return NextResponse.json({ error: 'Content is required.' }, { status: 400 });
    }

    const token = typeof body?.token === 'string' ? body.token : '';

    try {
      if (token) {
        const decoded = await verifyIdToken(token);
        const post = {
          id: `rant_${Date.now()}`,
          content,
          createdAt: new Date().toISOString(),
          userId: decoded.uid
        };

        if (tursoClient) {
          await initTursoSchema();
          await tursoClient.execute({
            sql: 'INSERT INTO users (id) VALUES (?) ON CONFLICT(id) DO NOTHING',
            args: [decoded.uid]
          });
          await tursoClient.execute({
            sql: 'INSERT INTO posts (id, user_id, content, created_at) VALUES (?, ?, ?, ?)',
            args: [post.id, post.userId, post.content, post.createdAt]
          });

          const hashtagMatches: string[] = content.match(/#[a-zA-Z0-9_]+/g) || [];
          const hashtags: string[] = [];

          for (const hashtagMatch of hashtagMatches) {
            const hashtag = hashtagMatch.slice(1).toLowerCase();
            if (!hashtags.includes(hashtag)) hashtags.push(hashtag);
          }

          if (hashtags.length > 0) {
            for (const hashtag of hashtags) {
              await tursoClient.execute({
                sql: 'INSERT INTO post_hashtags (hashtag, post_id, created_at) VALUES (?, ?, ?)',
                args: [hashtag, post.id, post.createdAt]
              });
            }
          }

          return NextResponse.json({
            ok: true,
            message: 'Rant created successfully.',
            user: decoded.uid,
            post
          });
        }

        demoPosts.unshift(post);

        return NextResponse.json({
          ok: true,
          message: 'Rant created successfully.',
          user: decoded.uid,
          post
        });
      }
    } catch (authError) {
      // Fall back to demo mode when the token is absent or invalid.
    }

    const post = {
      id: `rant_${Date.now()}`,
      content,
      createdAt: new Date().toISOString()
    };

    demoPosts.unshift(post);

    return NextResponse.json({
      ok: true,
      message: 'Rant created successfully in demo mode.',
      post
    });
  } catch (error) {
    return NextResponse.json({
      error: 'Unable to create rant at this time.'
    }, { status: 500 });
  }
}
