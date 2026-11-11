import { NextResponse } from 'next/server';
import { verifyIdToken } from '@/lib/firebase';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const authorization = request.headers.get('authorization') || '';
    const token = typeof body?.token === 'string'
      ? body.token
      : authorization.startsWith('Bearer ')
        ? authorization.slice(7)
        : '';

    if (!token) {
      return NextResponse.json({ error: 'A Firebase ID token is required.' }, { status: 401 });
    }

    const user = await verifyIdToken(token);
    return NextResponse.json({ ok: true, uid: user.uid });
  } catch {
    return NextResponse.json({ error: 'Unable to verify Firebase ID token.' }, { status: 401 });
  }
}
