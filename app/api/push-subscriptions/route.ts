import { NextResponse } from 'next/server';
import { verifyIdToken } from '@/lib/firebase';
import { getWebPushConfig, isAllowedPushEndpoint } from '@/lib/web-push';
import { initTursoSchema, tursoClient } from '@/lib/turso';

export const runtime = 'nodejs';

async function getUserId(request: Request) {
  const authorization = request.headers.get('authorization') || '';
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
  if (!token) return null;
  return (await verifyIdToken(token)).uid;
}

export async function GET(request: Request) {
  if (!tursoClient) return NextResponse.json({ error: 'Notifications are unavailable.' }, { status: 503 });

  try {
    await initTursoSchema();
    const userId = await getUserId(request);
    if (!userId) return NextResponse.json({ error: 'Sign in to manage device notifications.' }, { status: 401 });

    const endpoint = new URL(request.url).searchParams.get('endpoint') || '';
    const registered = endpoint
      ? await tursoClient.execute({
          sql: 'SELECT 1 FROM web_push_subscriptions WHERE user_id = ? AND endpoint = ?',
          args: [userId, endpoint]
        })
      : null;
    const config = getWebPushConfig();
    return NextResponse.json({
      configured: config.configured,
      publicKey: config.configured ? config.publicKey : '',
      subscribed: Boolean(registered?.rows[0])
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('Unable to load device notification settings:', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json({ error: 'Unable to load device notification settings.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!tursoClient) return NextResponse.json({ error: 'Notifications are unavailable.' }, { status: 503 });
  const config = getWebPushConfig();
  if (!config.configured) {
    return NextResponse.json({ error: 'Device notifications are not configured on the server.' }, { status: 503 });
  }

  try {
    await initTursoSchema();
    const userId = await getUserId(request);
    if (!userId) return NextResponse.json({ error: 'Sign in to enable device notifications.' }, { status: 401 });

    const body = await request.json();
    const endpoint = typeof body?.endpoint === 'string' ? body.endpoint : '';
    const p256dh = typeof body?.keys?.p256dh === 'string' ? body.keys.p256dh : '';
    const auth = typeof body?.keys?.auth === 'string' ? body.keys.auth : '';
    if (
      !isAllowedPushEndpoint(endpoint)
      || endpoint.length > 4096
      || p256dh.length < 20
      || p256dh.length > 256
      || auth.length < 8
      || auth.length > 256
    ) {
      return NextResponse.json({ error: 'Provide a valid device push subscription.' }, { status: 400 });
    }

    const now = new Date().toISOString();
    await tursoClient.execute({
      sql: `INSERT INTO web_push_subscriptions (user_id, endpoint, p256dh, auth, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(endpoint) DO UPDATE SET
          user_id = excluded.user_id,
          p256dh = excluded.p256dh,
          auth = excluded.auth,
          updated_at = excluded.updated_at`,
      args: [userId, endpoint, p256dh, auth, now, now]
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Unable to save device push subscription:', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json({ error: 'Unable to enable device notifications.' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  if (!tursoClient) return NextResponse.json({ error: 'Notifications are unavailable.' }, { status: 503 });

  try {
    await initTursoSchema();
    const userId = await getUserId(request);
    if (!userId) return NextResponse.json({ error: 'Sign in to disable device notifications.' }, { status: 401 });

    const body = await request.json();
    const endpoint = typeof body?.endpoint === 'string' ? body.endpoint : '';
    if (endpoint.length > 4096 || !isAllowedPushEndpoint(endpoint)) {
      return NextResponse.json({ error: 'Provide a valid device push subscription.' }, { status: 400 });
    }
    await tursoClient.execute({
      sql: 'DELETE FROM web_push_subscriptions WHERE user_id = ? AND endpoint = ?',
      args: [userId, endpoint]
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Unable to remove device push subscription:', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json({ error: 'Unable to disable device notifications.' }, { status: 500 });
  }
}
