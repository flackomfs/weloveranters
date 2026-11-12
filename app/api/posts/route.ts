import { NextResponse } from 'next/server';
import { isAdminUid } from '@/lib/admin';
import { verifyIdToken } from '@/lib/firebase';
import { mentionNotificationStatements, notificationStatement } from '@/lib/notifications';
import { getAvailableDisplayName } from '@/lib/profile-identity';
import { initTursoSchema, tursoClient } from '@/lib/turso';

function getBearerToken(request: Request) {
  const authorization = request.headers.get('authorization') || '';
  return authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
}

async function getViewerId(request: Request) {
  const token = getBearerToken(request);
  if (!token) return '';
  try {
    return (await verifyIdToken(token)).uid;
  } catch {
    return '';
  }
}

export async function GET(request: Request) {
  if (!tursoClient) {
    return NextResponse.json({ posts: [], available: false }, { headers: { 'Cache-Control': 'no-store' } });
  }

  try {
    await initTursoSchema();
    const viewerId = await getViewerId(request);
    const searchParams = new URL(request.url).searchParams;
    const username = searchParams.get('username')?.toLowerCase() || '';
    const requestedSort = searchParams.get('sort');
    const sort = requestedSort === 'popular' || requestedSort === 'following' ? requestedSort : 'latest';
    const result = await tursoClient.execute({
      sql: `WITH feed_entries AS (
          SELECT p.id AS postId, p.id AS entryId, p.content, p.created_at AS createdAt,
            p.user_id AS authorId, NULL AS reposterId, NULL AS reposterName, NULL AS reposterUsername
          FROM posts p
          UNION ALL
          SELECT p.id AS postId, 'repost:' || r.user_id || ':' || p.id AS entryId,
            p.content, r.created_at AS createdAt, p.user_id AS authorId,
            r.user_id AS reposterId, r.author_name AS reposterName, r.author_username AS reposterUsername
          FROM post_reposts r
          INNER JOIN posts p ON p.id = r.post_id
        )
        SELECT e.postId AS id, e.entryId, e.content, e.createdAt, e.authorId AS userId,
          p.likes, p.updated_at AS updatedAt, u.display_name AS authorName, u.username AS authorUsername,
          u.avatar_url AS avatarUrl, vr.requested_badge AS verificationBadge,
          e.reposterId AS repostedById,
          COALESCE(ru.display_name, e.reposterName) AS repostedByName,
          COALESCE(ru.username, e.reposterUsername) AS repostedByUsername,
          EXISTS (
            SELECT 1 FROM post_reposts viewer_repost
            WHERE viewer_repost.user_id = ? AND viewer_repost.post_id = e.postId
          ) AS isReposted,
          (SELECT COUNT(*) FROM post_comments c WHERE c.post_id = e.postId) AS comments,
          (SELECT COUNT(*) FROM post_reposts all_reposts WHERE all_reposts.post_id = e.postId) AS reposts
        FROM feed_entries e
        INNER JOIN posts p ON p.id = e.postId
        LEFT JOIN users u ON u.id = e.authorId
        LEFT JOIN user_verification_requests vr
          ON vr.user_id = e.authorId AND vr.status = 'approved'
        LEFT JOIN users ru ON ru.id = e.reposterId
        WHERE (? = '' OR COALESCE(ru.username, e.reposterUsername, u.username) = ?)
          AND (? <> '' OR e.reposterId IS NULL)
          AND (? = '' OR NOT EXISTS (
            SELECT 1 FROM blocked_users b
            WHERE (b.blocker_id = ? AND b.blocked_id IN (e.authorId, e.reposterId))
              OR (b.blocked_id = ? AND b.blocker_id IN (e.authorId, e.reposterId))
          ))
          AND (? <> 'following' OR e.authorId = ? OR EXISTS (
            SELECT 1 FROM follows f WHERE f.follower_id = ? AND f.following_id = e.authorId
          ))
        ORDER BY CASE WHEN ? = 'popular' THEN p.likes END DESC, e.createdAt DESC
        LIMIT 100`,
      args: [viewerId, username, username, username, viewerId, viewerId, viewerId, sort, viewerId, viewerId, sort]
    });

    const posts = result.rows.map((row) => ({
      ...row,
      avatarUrl: String(row.avatarUrl || '').startsWith('data:image/')
        ? `/api/profile/photo?uid=${encodeURIComponent(String(row.userId))}`
        : row.avatarUrl,
      tags: (String(row.content).match(/#[a-zA-Z0-9_]+/g) || []).map((tag) => tag.slice(1).toLowerCase()),
      likes: Number(row.likes || 0),
      comments: Number(row.comments || 0),
      reposts: Number(row.reposts || 0),
      isReposted: Number(row.isReposted) > 0,
      verificationBadge: isAdminUid(String(row.userId))
        ? 'moderator'
        : row.verificationBadge === 'boy' || row.verificationBadge === 'girl' ? row.verificationBadge : null,
      canDelete: Boolean(viewerId && (isAdminUid(viewerId) || String(row.userId) === viewerId)),
      canEdit: Boolean(viewerId && String(row.userId) === viewerId && Date.now() - Date.parse(String(row.createdAt)) < 15 * 60 * 1000),
      canReport: Boolean(viewerId && String(row.userId) !== viewerId)
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

    if (!content || content.length > 2000) {
      return NextResponse.json({ error: 'Posts must be between 1 and 2000 characters.' }, { status: 400 });
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
    const usernameBase = emailName.toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 11) || 'user';
    const defaultUsername = `${usernameBase}_${user.uid.slice(-12).toLowerCase()}`;
    const defaultDisplayName = await getAvailableDisplayName(tursoClient, user.name || emailName, user.uid);
    await tursoClient.execute({
      sql: `INSERT INTO users (id, email, display_name, username, avatar_url)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          email = COALESCE(users.email, excluded.email),
          display_name = COALESCE(users.display_name, excluded.display_name),
          username = COALESCE(users.username, excluded.username),
          avatar_url = COALESCE(users.avatar_url, excluded.avatar_url)`,
      args: [user.uid, user.email || '', defaultDisplayName, defaultUsername, user.picture || '']
    });

    const createdAt = new Date().toISOString();
    const id = `rant_${crypto.randomUUID()}`;
    await tursoClient.execute({
      sql: 'INSERT INTO posts (id, user_id, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
      args: [id, user.uid, content, createdAt, createdAt]
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

    const followers = await tursoClient.execute({
      sql: `SELECT f.follower_id FROM follows f
        WHERE f.following_id = ?
          AND NOT EXISTS (
            SELECT 1 FROM blocked_users b
            WHERE (b.blocker_id = f.follower_id AND b.blocked_id = f.following_id)
              OR (b.blocker_id = f.following_id AND b.blocked_id = f.follower_id)
          )`,
      args: [user.uid]
    });
    const notificationStatements = followers.rows.map((follower) => notificationStatement({
      id: `post_${crypto.randomUUID()}`,
      recipientId: String(follower.follower_id),
      actorId: user.uid,
      type: 'post',
      entityId: id,
      createdAt
    }));
    notificationStatements.push(...await mentionNotificationStatements(tursoClient, content, user.uid, id, createdAt));
    if (notificationStatements.length) await tursoClient.batch(notificationStatements, 'write');

    return NextResponse.json({ ok: true, message: 'Rant created successfully.', post: { id, content, createdAt, userId: user.uid } });
  } catch (error) {
    console.error('Unable to create post:', error instanceof Error ? error.message : 'Unknown database error');
    return NextResponse.json({
      error: 'Unable to create rant at this time.'
    }, { status: 500 });
  }
}
