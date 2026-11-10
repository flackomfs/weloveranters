import { NextResponse } from 'next/server';
import { verifyIdToken } from '@/lib/firebase';

export async function GET() {
  return NextResponse.json({
    message: 'Posts endpoint ready.',
    status: 'ok'
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

    if (token) {
      const decoded = await verifyIdToken(token);
      return NextResponse.json({
        ok: true,
        message: 'Rant created successfully.',
        user: decoded.uid,
        post: {
          id: `rant_${Date.now()}`,
          content,
          createdAt: new Date().toISOString()
        }
      });
    }

    return NextResponse.json({
      ok: true,
      message: 'Rant created successfully in demo mode.',
      post: {
        id: `rant_${Date.now()}`,
        content,
        createdAt: new Date().toISOString()
      }
    });
  } catch (error) {
    return NextResponse.json({
      error: 'Unable to create rant at this time.'
    }, { status: 500 });
  }
}
