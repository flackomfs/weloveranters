import { NextResponse } from 'next/server';
import { isAdminUid } from '@/lib/admin';
import { getAppUserClient, getAuthenticatedUser } from '@/lib/auth';
import { mentionNotificationStatements, notificationIdsFromStatements, notificationStatement } from '@/lib/notifications';
import { getAvailableDisplayName } from '@/lib/profile-identity';
import { findUserShards, getConfiguredTursoShards, initTursoSchema, tursoClient, updateAccountShardIdentity } from '@/lib/turso';
import { sendPushNotifications } from '@/lib/web-push';

export async function GET(request: Request) {
  if (!tursoClient) {
    return NextResponse.json({ posts: [], available: false }, { headers: { 'Cache-Control': 'no-store' } });
  }

  try {
    const shards = getConfiguredTursoShards();
    await Promise.all(shards.map((shard) => initTursoSchema(shard.client)));
    const viewer = await getAuthenticatedUser();
    const viewerId = viewer?.uid || '';
    const viewerClient = viewer ? getAppUserClient(viewer) : null;
    const searchParams = new URL(request.url).searchParams;
    const username = searchParams.get('username')?.toLowerCase() || '';
    const savedOnly = searchParams.get('bookmarks') === '1' ? 1 : 0;
    const collectionId = searchParams.get('collectionId') || '';
    const requestedSort = searchParams.get('sort');
    const sort = requestedSort === 'popular' || requestedSort === 'following' ? requestedSort : 'latest';
    const [followResults, blockResults, bookmarkResult] = await Promise.all([
      viewerClient
        ? viewerClient.execute({
          sql: 'SELECT following_id FROM follows WHERE follower_id = ?',
          args: [viewerId]
        })
        : Promise.resolve({ rows: [] }),
      viewerId
        ? Promise.all(shards.map((shard) => shard.client.execute({
          sql: `SELECT blocked_id AS userId FROM blocked_users WHERE blocker_id = ?
            UNION SELECT blocker_id AS userId FROM blocked_users WHERE blocked_id = ?`,
          args: [viewerId, viewerId]
        })))
        : Promise.resolve([]),
      viewerClient && savedOnly
        ? viewerClient.execute({
          sql: `SELECT post_id AS postId, collection_id AS collectionId
            FROM bookmarks WHERE user_id = ?${collectionId ? ' AND collection_id = ?' : ''}
            ORDER BY created_at DESC`,
          args: collectionId ? [viewerId, collectionId] : [viewerId]
        })
        : Promise.resolve({ rows: [] })
    ]);
    const followedIds = new Set(followResults.rows.map((row) => String(row.following_id)));
    const blockedIds = new Set(blockResults.flatMap((result) => result.rows.map((row) => String(row.userId))));
    const bookmarks = new Map(bookmarkResult.rows.map((row) => [
      String(row.postId),
      String(row.collectionId)
    ]));
    const feedResults = await Promise.all(shards.map((shard) => shard.client.execute({
      sql: `WITH feed_entries AS (
          SELECT p.id AS postId, p.id AS entryId, p.content, p.content_warning AS contentWarning, p.created_at AS createdAt,
            p.user_id AS authorId, NULL AS reposterId, NULL AS reposterName, NULL AS reposterUsername
          FROM posts p
          UNION ALL
          SELECT p.id AS postId, 'repost:' || r.user_id || ':' || p.id AS entryId,
            p.content, p.content_warning AS contentWarning, r.created_at AS createdAt, p.user_id AS authorId,
            r.user_id AS reposterId, r.author_name AS reposterName, r.author_username AS reposterUsername
          FROM post_reposts r
          INNER JOIN posts p ON p.id = r.post_id
        )
        SELECT e.postId AS id, e.entryId, e.content, e.contentWarning, e.createdAt, e.authorId AS userId,
          p.likes, p.updated_at AS updatedAt, u.display_name AS authorName, u.username AS authorUsername,
          u.is_bot AS isBot, u.private_profile AS authorPrivate,
          u.avatar_url AS avatarUrl, vr.requested_badge AS verificationBadge,
          e.reposterId AS repostedById,
          COALESCE(ru.display_name, e.reposterName) AS repostedByName,
          COALESCE(ru.username, e.reposterUsername) AS repostedByUsername,
          COALESCE(ru.private_profile, 0) AS reposterPrivate,
          source_post.user_id AS sourceAuthorId,
          COALESCE(source_private.private_profile, 0) AS sourceAuthorPrivate,
          EXISTS (
            SELECT 1 FROM post_reposts viewer_repost
            WHERE viewer_repost.user_id = ? AND viewer_repost.post_id = e.postId
          ) AS isReposted,
          EXISTS (
            SELECT 1 FROM pinned_posts pinned_post
            WHERE pinned_post.user_id = e.authorId AND pinned_post.post_id = e.postId
          ) AS isPinned,
          (SELECT COUNT(*) FROM post_comments c WHERE c.post_id = e.postId) AS comments,
          (SELECT COUNT(*) FROM post_reposts all_reposts WHERE all_reposts.post_id = e.postId) AS reposts
        FROM feed_entries e
        INNER JOIN posts p ON p.id = e.postId
        LEFT JOIN users u ON u.id = e.authorId
        LEFT JOIN user_verification_requests vr
          ON vr.user_id = e.authorId AND vr.status = 'approved'
        LEFT JOIN users ru ON ru.id = e.reposterId
        LEFT JOIN post_bot_responses bot_response ON bot_response.reply_post_id = e.postId
        LEFT JOIN posts source_post ON source_post.id = bot_response.source_post_id
        LEFT JOIN users source_private ON source_private.id = source_post.user_id
        WHERE (? = '' OR COALESCE(ru.username, e.reposterUsername, u.username) = ?)
          AND (? <> '' OR e.reposterId IS NULL)
        ORDER BY CASE WHEN ? <> '' AND u.username = ? AND EXISTS (
            SELECT 1 FROM pinned_posts profile_pin
            WHERE profile_pin.user_id = e.authorId AND profile_pin.post_id = e.postId
          ) THEN 0 ELSE 1 END,
          CASE WHEN ? = 'popular' THEN p.likes END DESC, e.createdAt DESC
        LIMIT 100`,
      args: [viewerId, username, username, username, username, sort]
    })));

    const feedRows = feedResults.flatMap((result) => result.rows);
    const privacyUserIds = Array.from(new Set(feedRows.flatMap((row) =>
      [row.userId, row.repostedById, row.sourceAuthorId]
        .filter((userId): userId is string => typeof userId === 'string' && userId.length > 0)
    )));
    const privacyShards = await findUserShards(privacyUserIds);
    const idsByShard = new Map<number, { client: (typeof shards)[number]['client']; ids: string[] }>();
    for (const userId of privacyUserIds) {
      const shard = privacyShards.get(userId);
      if (!shard) continue;
      const group = idsByShard.get(shard.id) || { client: shard.client, ids: [] };
      group.ids.push(userId);
      idsByShard.set(shard.id, group);
    }
    const privacyResults = await Promise.all(Array.from(idsByShard.values()).map(({ client, ids }) =>
      client.execute({
        sql: `SELECT id, private_profile FROM users WHERE id IN (${ids.map(() => '?').join(', ')})`,
        args: ids
      })
    ));
    const privateByUser = new Map<string, boolean>();
    for (const result of privacyResults) {
      for (const row of result.rows) privateByUser.set(String(row.id), Number(row.private_profile) > 0);
    }

    const rows = feedRows.filter((row) => {
      const authorId = String(row.userId);
      const reposterId = typeof row.repostedById === 'string' ? row.repostedById : '';
      const sourceAuthorId = typeof row.sourceAuthorId === 'string' ? row.sourceAuthorId : '';
      if (blockedIds.has(authorId) || (reposterId && blockedIds.has(reposterId)) || (sourceAuthorId && blockedIds.has(sourceAuthorId))) return false;
      if ((privateByUser.get(authorId) ?? Number(row.authorPrivate) > 0) && authorId !== viewerId && !followedIds.has(authorId)) return false;
      if (reposterId && (privateByUser.get(reposterId) ?? Number(row.reposterPrivate) > 0) && reposterId !== viewerId && !followedIds.has(reposterId)) return false;
      if (sourceAuthorId && (privateByUser.get(sourceAuthorId) ?? Number(row.sourceAuthorPrivate) > 0) && sourceAuthorId !== viewerId && !followedIds.has(sourceAuthorId)) return false;
      if (sort === 'following' && authorId !== viewerId && !followedIds.has(authorId)) return false;
      if (savedOnly && (!bookmarks.has(String(row.id)) || (collectionId && bookmarks.get(String(row.id)) !== collectionId))) return false;
      return true;
    });
    rows.sort((left, right) => {
      if (username && String(left.authorUsername || '').toLowerCase() === username && String(right.authorUsername || '').toLowerCase() === username) {
        const pinDelta = Number(right.isPinned) - Number(left.isPinned);
        if (pinDelta) return pinDelta;
      }
      if (sort === 'popular') {
        const likeDelta = Number(right.likes || 0) - Number(left.likes || 0);
        if (likeDelta) return likeDelta;
      }
      return String(right.createdAt).localeCompare(String(left.createdAt));
    });

    const pageRows = rows.slice(0, 100);
    if (viewerClient && !savedOnly && pageRows.length) {
      const postIds = Array.from(new Set(pageRows.map((row) => String(row.id))));
      const saved = await viewerClient.execute({
        sql: `SELECT post_id AS postId, collection_id AS collectionId
          FROM bookmarks WHERE user_id = ? AND post_id IN (${postIds.map(() => '?').join(', ')})`,
        args: [viewerId, ...postIds]
      });
      for (const row of saved.rows) bookmarks.set(String(row.postId), String(row.collectionId));
    }

    const posts = pageRows.map((row) => ({
      ...row,
      avatarUrl: String(row.avatarUrl || '').startsWith('data:image/')
        ? `/api/profile/photo?uid=${encodeURIComponent(String(row.userId))}`
        : row.avatarUrl,
      tags: (String(row.content).match(/#[a-zA-Z0-9_]+/g) || []).map((tag) => tag.slice(1).toLowerCase()),
      likes: Number(row.likes || 0),
      comments: Number(row.comments || 0),
      reposts: Number(row.reposts || 0),
      isReposted: Number(row.isReposted) > 0,
      isBookmarked: bookmarks.has(String(row.id)),
      bookmarkCollectionId: bookmarks.get(String(row.id)) || null,
      isPinned: Number(row.isPinned) > 0,
      isBot: Number(row.isBot) > 0,
      verificationBadge: isAdminUid(String(row.userId))
        ? 'moderator'
        : row.verificationBadge === 'man' || row.verificationBadge === 'woman' ? row.verificationBadge : null,
      canDelete: Boolean(viewerId && (isAdminUid(viewerId) || String(row.userId) === viewerId)),
      canBookmark: Boolean(viewerId),
      canPin: Boolean(viewerId && String(row.userId) === viewerId),
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
    const contentWarning = typeof body?.contentWarning === 'string' ? body.contentWarning.normalize('NFKC').trim() : '';
    if (body?.contentWarning !== undefined && typeof body.contentWarning !== 'string') {
      return NextResponse.json({ error: 'Content warning must be text.' }, { status: 400 });
    }

    if (!content || content.length > 2000) {
      return NextResponse.json({ error: 'Posts must be between 1 and 2000 characters.' }, { status: 400 });
    }
    if (contentWarning.length > 80) {
      return NextResponse.json({ error: 'Content warnings must be 80 characters or fewer.' }, { status: 400 });
    }
    if (!tursoClient) {
      return NextResponse.json({ error: 'Post storage is unavailable.' }, { status: 503 });
    }

    const user = await getAuthenticatedUser();
    if (!user) return NextResponse.json({ error: 'Sign in before posting.' }, { status: 401 });
    const client = getAppUserClient(user);
    await initTursoSchema(client);
    const emailName = user.email?.split('@')[0] || 'user';
    const usernameBase = emailName.toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 11) || 'user';
    const defaultUsername = `${usernameBase}_${user.uid.slice(-12).toLowerCase()}`;
    const allClients = getConfiguredTursoShards().map((shard) => shard.client);
    const defaultDisplayName = await getAvailableDisplayName(allClients, user.name || emailName, user.uid);
    await client.execute({
      sql: `INSERT INTO users (id, clerk_user_id, email, display_name, username, avatar_url)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          email = COALESCE(users.email, excluded.email),
          display_name = COALESCE(users.display_name, excluded.display_name),
          username = COALESCE(users.username, excluded.username),
          avatar_url = COALESCE(users.avatar_url, excluded.avatar_url)`,
      args: [user.uid, user.clerkUserId, user.email || null, defaultDisplayName, defaultUsername, user.picture || '']
    });
    const identity = await client.execute({
      sql: 'SELECT username, display_name FROM users WHERE id = ?',
      args: [user.uid]
    });
    await updateAccountShardIdentity(
      user.uid,
      String(identity.rows[0]?.username || ''),
      String(identity.rows[0]?.display_name || '')
    );

    const createdAt = new Date().toISOString();
    const id = `rant_${crypto.randomUUID()}`;
    await client.execute({
      sql: 'INSERT INTO posts (id, user_id, content, content_warning, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
      args: [id, user.uid, content, contentWarning || null, createdAt, createdAt]
    });

    const hashtags: string[] = [];
    for (const match of content.match(/#[a-zA-Z0-9_]+/g) || []) {
      const hashtag = match.slice(1).toLowerCase();
      if (!hashtags.includes(hashtag)) hashtags.push(hashtag);
    }
    for (const hashtag of hashtags) {
      await client.execute({
        sql: 'INSERT INTO post_hashtags (hashtag, post_id, created_at) VALUES (?, ?, ?)',
        args: [hashtag, id, createdAt]
      });
    }

    const shards = getConfiguredTursoShards();
    const followerResults = await Promise.all(shards.map((shard) => shard.client.execute({
      sql: 'SELECT follower_id FROM follows WHERE following_id = ?',
      args: [user.uid]
    })));
    const followerIds = Array.from(new Set(followerResults.flatMap((result) =>
      result.rows.map((row) => String(row.follower_id))
    )));
    const followerShards = await findUserShards(followerIds);
    const followerIdsByShard = new Map<number, { client: (typeof shards)[number]['client']; ids: string[] }>();
    for (const followerId of followerIds) {
      const shard = followerShards.get(followerId);
      if (!shard) continue;
      const group = followerIdsByShard.get(shard.id) || { client: shard.client, ids: [] };
      group.ids.push(followerId);
      followerIdsByShard.set(shard.id, group);
    }
    const blockedByAuthor = await client.execute({
      sql: 'SELECT blocked_id FROM blocked_users WHERE blocker_id = ?',
      args: [user.uid]
    });
    const blockedByFollowerResults = await Promise.all(Array.from(followerIdsByShard.values()).map(({ client: followerClient }) =>
      followerClient.execute({
        sql: 'SELECT blocker_id FROM blocked_users WHERE blocked_id = ?',
        args: [user.uid]
      })
    ));
    const blockedFollowerIds = new Set(blockedByFollowerResults.flatMap((result) => result.rows.map((row) => String(row.blocker_id))));
    const blockedByAuthorIds = new Set(blockedByAuthor.rows.map((row) => String(row.blocked_id)));
    const notificationStatements = followerIds
      .filter((followerId) => !blockedByAuthorIds.has(followerId) && !blockedFollowerIds.has(followerId))
      .map((followerId) => notificationStatement({
      id: `post_${crypto.randomUUID()}`,
      recipientId: followerId,
      actorId: user.uid,
      type: 'post',
      entityId: id,
      createdAt
    }));
    notificationStatements.push(...await mentionNotificationStatements(client, content, user.uid, id, createdAt));
    if (notificationStatements.length) {
      await client.batch(notificationStatements, 'write');
      await sendPushNotifications(client, notificationIdsFromStatements(notificationStatements));
    }

    return NextResponse.json({
      ok: true,
      message: 'Rant created successfully.',
      post: { id, content, createdAt, userId: user.uid }
    });
  } catch (error) {
    console.error('Unable to create post:', error instanceof Error ? error.message : 'Unknown database error');
    return NextResponse.json({
      error: 'Unable to create rant at this time.'
    }, { status: 500 });
  }
}
