import { NextResponse } from 'next/server';
import { isAdminUid } from '@/lib/admin';
import { verifyIdToken } from '@/lib/firebase';
import { initTursoSchema, tursoClient } from '@/lib/turso';

type Badge = 'boy' | 'girl';
type RequestStatus = 'pending' | 'approved' | 'rejected';

async function authenticate(request: Request) {
  const authorization = request.headers.get('authorization') || '';
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
  if (!token) return null;
  return verifyIdToken(token);
}

export async function GET(request: Request) {
  if (!tursoClient) return NextResponse.json({ error: 'Verification storage is unavailable.' }, { status: 503 });

  try {
    await initTursoSchema();
    const user = await authenticate(request);
    if (!user) return NextResponse.json({ error: 'Sign in to manage verification requests.' }, { status: 401 });

    const [requestResult, pendingResult] = await Promise.all([
      tursoClient.execute({
        sql: `SELECT requested_badge AS requestedBadge, status, created_at AS createdAt
          FROM user_verification_requests WHERE user_id = ?`,
        args: [user.uid]
      }),
      isAdminUid(user.uid)
        ? tursoClient.execute({
            sql: `SELECT r.user_id AS userId, r.requested_badge AS requestedBadge,
                r.created_at AS createdAt, u.display_name AS name, u.username
              FROM user_verification_requests r
              INNER JOIN users u ON u.id = r.user_id
              WHERE r.status = 'pending'
              ORDER BY r.created_at ASC`,
            args: []
          })
        : Promise.resolve(null)
    ]);

    return NextResponse.json({
      request: requestResult.rows[0] || null,
      isAdmin: isAdminUid(user.uid),
      pendingRequests: pendingResult?.rows || []
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('Unable to load verification requests:', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json({ error: 'Unable to load verification requests.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!tursoClient) return NextResponse.json({ error: 'Verification storage is unavailable.' }, { status: 503 });

  try {
    await initTursoSchema();
    const user = await authenticate(request);
    if (!user) return NextResponse.json({ error: 'Sign in to request verification.' }, { status: 401 });

    const body = await request.json();
    const badge = body?.badge;
    if (badge !== 'boy' && badge !== 'girl') {
      return NextResponse.json({ error: 'Choose a boy or girl badge request.' }, { status: 400 });
    }

    const existing = await tursoClient.execute({
      sql: 'SELECT status FROM user_verification_requests WHERE user_id = ?',
      args: [user.uid]
    });
    const status = existing.rows[0]?.status;
    if (status === 'pending') {
      return NextResponse.json({ error: 'Your verification request is already pending.' }, { status: 409 });
    }
    if (status === 'approved') {
      return NextResponse.json({ error: 'Your profile badge is already approved.' }, { status: 409 });
    }

    await tursoClient.execute({
      sql: `INSERT INTO user_verification_requests
          (user_id, requested_badge, status, created_at, reviewed_at, reviewed_by)
        VALUES (?, ?, 'pending', ?, NULL, NULL)
        ON CONFLICT(user_id) DO UPDATE SET
          requested_badge = excluded.requested_badge,
          status = 'pending',
          created_at = excluded.created_at,
          reviewed_at = NULL,
          reviewed_by = NULL`,
      args: [user.uid, badge as Badge, new Date().toISOString()]
    });

    return NextResponse.json({ status: 'pending' satisfies RequestStatus });
  } catch (error) {
    console.error('Unable to submit verification request:', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json({ error: 'Unable to submit verification request.' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  if (!tursoClient) return NextResponse.json({ error: 'Verification storage is unavailable.' }, { status: 503 });

  try {
    await initTursoSchema();
    const user = await authenticate(request);
    if (!user) return NextResponse.json({ error: 'Admin access required.' }, { status: 401 });
    if (!isAdminUid(user.uid)) return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });

    const body = await request.json();
    const userId = typeof body?.userId === 'string' ? body.userId : '';
    const status = body?.status;
    if (!userId || (status !== 'approved' && status !== 'rejected')) {
      return NextResponse.json({ error: 'Choose a pending request and a valid decision.' }, { status: 400 });
    }

    const result = await tursoClient.execute({
      sql: `UPDATE user_verification_requests
        SET status = ?, reviewed_at = ?, reviewed_by = ?
        WHERE user_id = ? AND status = 'pending'`,
      args: [status as RequestStatus, new Date().toISOString(), user.uid, userId]
    });
    if (!result.rowsAffected) {
      return NextResponse.json({ error: 'That request is no longer pending.' }, { status: 409 });
    }

    return NextResponse.json({ status });
  } catch (error) {
    console.error('Unable to review verification request:', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json({ error: 'Unable to review verification request.' }, { status: 500 });
  }
}
