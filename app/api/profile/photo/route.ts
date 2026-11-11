import { NextResponse } from 'next/server';
import { tursoClient } from '@/lib/turso';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  if (!tursoClient) return NextResponse.json({ error: 'Photo storage is unavailable.' }, { status: 503 });

  const userId = new URL(request.url).searchParams.get('uid');
  if (!userId || userId.length > 128) return NextResponse.json({ error: 'Photo not found.' }, { status: 404 });

  try {
    const result = await tursoClient.execute({
      sql: 'SELECT avatar_url FROM users WHERE id = ?',
      args: [userId]
    });
    const avatar = String(result.rows[0]?.avatar_url || '');
    const match = avatar.match(/^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/);
    if (!match) return NextResponse.json({ error: 'Photo not found.' }, { status: 404 });

    const contentType = match[1] === 'jpeg' ? 'image/jpeg' : `image/${match[1]}`;
    return new Response(Buffer.from(match[2], 'base64'), {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff'
      }
    });
  } catch (error) {
    console.error('Unable to load profile photo:', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json({ error: 'Unable to load photo.' }, { status: 500 });
  }
}