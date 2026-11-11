import { NextResponse } from 'next/server';
import { verifyIdToken } from '@/lib/firebase';
import { isAdminUid } from '@/lib/admin';
import { initTursoSchema, tursoClient } from '@/lib/turso';

export async function PUT(request: Request) {
  if (!tursoClient) return NextResponse.json({ error: 'Profile storage is unavailable.' }, { status: 503 });

  try {
    await initTursoSchema();
    const authorization = request.headers.get('authorization') || '';
    const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
    if (!token) return NextResponse.json({ error: 'Sign in as an admin to edit profile counts.' }, { status: 401 });

    const admin = await verifyIdToken(token);
    if (!isAdminUid(admin.uid)) return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });

    const body = await request.json();
    const targetId = typeof body.targetId === 'string' ? body.targetId : '';
    const parseCount = (value: unknown) => {
      if (value === null || value === '') return null;
      if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0 || value > 1_000_000_000) {
        throw new Error('Counts must be whole numbers between 0 and 1,000,000,000.');
      }
      return value;
    };
    const hasFollowers = Object.prototype.hasOwnProperty.call(body, 'followers');
    const hasFollowing = Object.prototype.hasOwnProperty.call(body, 'following');
    const followers = hasFollowers ? parseCount(body.followers) : null;
    const following = hasFollowing ? parseCount(body.following) : null;

    if (!targetId || (!hasFollowers && !hasFollowing)) {
      return NextResponse.json({ error: 'Choose a profile and enter at least one count.' }, { status: 400 });
    }

    const target = await tursoClient.execute({ sql: 'SELECT id FROM users WHERE id = ?', args: [targetId] });
    if (!target.rows[0]) return NextResponse.json({ error: 'Profile not found.' }, { status: 404 });

    await tursoClient.execute({
      sql: `UPDATE users SET
          followers_override = CASE WHEN ? = 1 THEN ? ELSE followers_override END,
          following_override = CASE WHEN ? = 1 THEN ? ELSE following_override END
        WHERE id = ?`,
      args: [hasFollowers ? 1 : 0, followers, hasFollowing ? 1 : 0, following, targetId]
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message.startsWith('Counts must')) return NextResponse.json({ error: message }, { status: 400 });
    console.error('Unable to update admin profile counts:', message || 'Unknown error');
    return NextResponse.json({ error: 'Unable to update profile counts.' }, { status: 500 });
  }
}