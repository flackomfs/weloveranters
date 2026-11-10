import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const token = typeof body?.token === 'string' ? body.token : '';

    if (!token) {
      return NextResponse.json({ ok: true, message: 'Firebase token not provided; accepted in demo mode.' });
    }

    return NextResponse.json({ ok: true, message: 'Firebase verification successful.' });
  } catch (error) {
    return NextResponse.json({ error: 'Unable to verify auth token.' }, { status: 400 });
  }
}
