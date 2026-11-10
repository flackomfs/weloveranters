import { NextResponse } from 'next/server';
import { verifyIdToken } from '@/lib/firebase';

const demoPosts: Array<{
  id: string;
  content: string;
  createdAt: string;
  userId?: string;
}> = [];

export async function GET() {
  return NextResponse.json({
    message: 'Posts endpoint ready.',
    status: 'ok',
    posts: demoPosts
  });
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
