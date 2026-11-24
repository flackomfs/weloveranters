import { NextResponse } from 'next/server';
import { isAdminUid } from '@/lib/admin';
import { getAuthenticatedUser } from '@/lib/auth';
import { mentionNotificationStatements, notificationIdsFromStatements, notificationStatement } from '@/lib/notifications';
import { canViewUserContent } from '@/lib/profile-privacy';
import { findPostShard, findUserShard, getConfiguredTursoShards, initTursoSchema, tursoClient } from '@/lib/turso';
import { sendPushNotifications } from '@/lib/web-push';

type RouteContext = { params: Promise<{ id: string }> };

async function getActorProfile(uid: string, email?: string, displayName?: string) {
  const shard = await findUserShard(uid);
  const result = await shard?.client.execute({
    sql: 'SELECT display_name, username FROM users WHERE id = ?',
    args: [uid]
  });
  const emailName = email?.split('@')[0] || 'user';
  const usernameBase = emailName.toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 20) || 'user';
  return {
    name: String(result?.rows[0]?.display_name || displayName || emailName),
    username: String(result?.rows[0]?.username || `${usernameBase}_${uid.slice(0, 6).toLowerCase()}`)
  };
}

export async function GET(_request: Request, { params }: RouteContext) {
  const { id } = await params;
  if (!tursoClient) return NextResponse.json({ error: 'Post storage is unavailable.' }, { status: 503 });

  try {
    await initTursoSchema();
    const postShard = await findPostShard(id);
    if (!postShard) return NextResponse.json({ error: 'Post not found.' }, { status: 404 });
    const post = await postShard.client.execute({ sql: 'SELECT id, user_id FROM posts WHERE id = ?', args: [id] });
    if (!post.rows[0]) return NextResponse.json({ error: 'Post not found.' }, { status: 404 });
    const viewerId = (await getAuthenticatedUser())?.uid || '';
    if (!await canViewUserContent(tursoClient, String(post.rows[0].user_id), viewerId)) {
      return NextResponse.json({ error: 'Post not found.' }, { status: 404 });
    }

    const result = await postShard.client.execute({
      sql: `SELECT c.id, c.content, c.parent_comment_id AS parentCommentId,
          c.created_at AS createdAt, c.user_id AS userId,
          COALESCE(u.display_name, c.author_name) AS authorName,
          COALESCE(u.username, c.author_username) AS authorUsername,
          u.avatar_url AS avatarUrl
        FROM post_comments c
        LEFT JOIN users u ON u.id = c.user_id
        WHERE c.post_id = ?
        ORDER BY c.created_at ASC
        LIMIT 100`,
      args: [id]
    });

    const comments = result.rows.map((row) => ({
      ...row,
      avatarUrl: String(row.avatarUrl || '').startsWith('data:image/')
        ? `/api/profile/photo?uid=${encodeURIComponent(String(row.userId))}`
        : row.avatarUrl
    }));
    return NextResponse.json({ comments }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('Unable to load post comments:', error instanceof Error ? error.message : 'Unknown database error');
    return NextResponse.json({ error: 'Unable to load comments.' }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: RouteContext) {
  const { id } = await params;
  if (!tursoClient) return NextResponse.json({ error: 'Post storage is unavailable.' }, { status: 503 });

  try {
    await initTursoSchema();
    const user = await getAuthenticatedUser();
    if (!user) return NextResponse.json({ error: 'Sign in to interact with posts.' }, { status: 401 });

    const postShard = await findPostShard(id);
    if (!postShard) return NextResponse.json({ error: 'Post not found.' }, { status: 404 });
    const postClient = postShard.client;
    const post = await postClient.execute({ sql: 'SELECT id, user_id FROM posts WHERE id = ?', args: [id] });
    if (!post.rows[0]) return NextResponse.json({ error: 'Post not found.' }, { status: 404 });
    const postAuthorId = String(post.rows[0].user_id);
    if (!await canViewUserContent(tursoClient, postAuthorId, user.uid)) {
      return NextResponse.json({ error: 'Post not found.' }, { status: 404 });
    }
    const authorShard = await findUserShard(postAuthorId);
    const viewerShard = await findUserShard(user.uid);
    const [viewerBlocked, authorBlocked] = await Promise.all([
      viewerShard?.client.execute({
        sql: 'SELECT 1 FROM blocked_users WHERE blocker_id = ? AND blocked_id = ?',
        args: [user.uid, postAuthorId]
      }),
      authorShard?.client.execute({
        sql: 'SELECT 1 FROM blocked_users WHERE blocker_id = ? AND blocked_id = ?',
        args: [postAuthorId, user.uid]
      })
    ]);
    if (viewerBlocked?.rows[0] || authorBlocked?.rows[0]) {
      return NextResponse.json({ error: 'You cannot interact with this post because one account has blocked the other.' }, { status: 403 });
    }

    const rawBody = await request.json();
    if (!rawBody || typeof rawBody !== 'object' || Array.isArray(rawBody)) {
      return NextResponse.json({ error: 'Choose a valid post action.' }, { status: 400 });
    }
    const body = rawBody as Record<string, unknown>;
    const action = typeof body.action === 'string' ? body.action : '';

    if (action === 'like') {
      const statements: Array<{ sql: string; args: (string | number | null)[] }> = [
        { sql: 'UPDATE posts SET likes = COALESCE(likes, 0) + 1 WHERE id = ?', args: [id] }
      ];
      const notificationIds: string[] = [];
      if (postAuthorId !== user.uid) {
        const notificationId = `like_${crypto.randomUUID()}`;
        notificationIds.push(notificationId);
        statements.push(notificationStatement({
          id: notificationId, recipientId: postAuthorId, actorId: user.uid,
          type: 'like', entityId: id, createdAt: new Date().toISOString()
        }));
      }
      statements.push({ sql: 'SELECT likes FROM posts WHERE id = ?', args: [id] });
      const results = await postClient.batch(statements, 'write');
      await sendPushNotifications(postClient, notificationIds);
      return NextResponse.json({ likes: Number(results[results.length - 1].rows[0]?.likes || 0) });
    }

    const actor = await getActorProfile(user.uid, user.email, user.name);
    if (action === 'comment') {
      const content = typeof body.content === 'string' ? body.content.trim() : '';
      if (!content || content.length > 500) {
        return NextResponse.json({ error: 'Comments must be between 1 and 500 characters.' }, { status: 400 });
      }
      const parentCommentId = typeof body.parentCommentId === 'string' ? body.parentCommentId : null;
      let parentAuthorId = '';
      if (parentCommentId) {
        const parent = await postClient.execute({
          sql: 'SELECT user_id, parent_comment_id FROM post_comments WHERE id = ? AND post_id = ?',
          args: [parentCommentId, id]
        });
        if (!parent.rows[0] || parent.rows[0].parent_comment_id) {
          return NextResponse.json({ error: 'Replies must be attached to a top-level comment.' }, { status: 400 });
        }
        parentAuthorId = String(parent.rows[0].user_id);
      }

      const comment = {
        id: `comment_${crypto.randomUUID()}`,
        postId: id,
        userId: user.uid,
        authorName: actor.name,
        authorUsername: actor.username,
        content,
        createdAt: new Date().toISOString(),
        parentCommentId
      };
      const statements: Array<{ sql: string; args: (string | number | null)[] }> = [
        {
          sql: `INSERT INTO post_comments
            (id, post_id, user_id, author_name, author_username, content, created_at, parent_comment_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          args: [comment.id, comment.postId, comment.userId, comment.authorName, comment.authorUsername, comment.content, comment.createdAt, parentCommentId]
        }
      ];
      const notificationStatements: Array<ReturnType<typeof notificationStatement>> = [];
      if (postAuthorId !== user.uid) {
        notificationStatements.push(notificationStatement({
          id: `comment_${crypto.randomUUID()}`, recipientId: postAuthorId, actorId: user.uid,
          type: 'comment', entityId: id, createdAt: comment.createdAt
        }));
      }
      if (parentAuthorId && parentAuthorId !== user.uid && parentAuthorId !== postAuthorId) {
        notificationStatements.push(notificationStatement({
          id: `comment_reply_${crypto.randomUUID()}`, recipientId: parentAuthorId, actorId: user.uid,
          type: 'comment', entityId: id, createdAt: comment.createdAt
        }));
      }
      notificationStatements.push(...await mentionNotificationStatements(postClient, content, user.uid, id, comment.createdAt));
      const results = await postClient.batch([
        ...statements,
        ...notificationStatements,
        { sql: 'SELECT COUNT(*) AS count FROM post_comments WHERE post_id = ?', args: [id] }
      ], 'write');
      await sendPushNotifications(postClient, notificationIdsFromStatements(notificationStatements));
      return NextResponse.json({ comment, comments: Number(results[results.length - 1].rows[0]?.count || 0) });
    }

    if (action === 'repost') {
      const statements: Array<{ sql: string; args: (string | number | null)[] }> = [
        {
          sql: `INSERT INTO post_reposts (user_id, post_id, author_name, author_username, created_at)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(user_id, post_id) DO NOTHING`,
          args: [user.uid, id, actor.name, actor.username, new Date().toISOString()]
        }
      ];
      const notificationStatements: Array<ReturnType<typeof notificationStatement>> = [];
      if (postAuthorId !== user.uid) {
        const notification = notificationStatement({
          id: `repost_${crypto.randomUUID()}`, recipientId: postAuthorId, actorId: user.uid,
          type: 'repost', entityId: id, createdAt: new Date().toISOString()
        });
        notificationStatements.push({
          ...notification,
          sql: `INSERT INTO notifications (id, recipient_id, actor_id, type, entity_id, created_at)
            SELECT ?, ?, ?, ?, ?, ? WHERE changes() > 0`
        });
      }
      const results = await postClient.batch([
        ...statements,
        ...notificationStatements,
        { sql: 'SELECT COUNT(*) AS count FROM post_reposts WHERE post_id = ?', args: [id] }
      ], 'write');
      await sendPushNotifications(postClient, notificationIdsFromStatements(notificationStatements));
      return NextResponse.json({ reposted: true, reposts: Number(results[results.length - 1].rows[0]?.count || 0) });
    }

    return NextResponse.json({ error: 'Choose a valid post action.' }, { status: 400 });
  } catch (error) {
    console.error('Unable to update post:', error instanceof Error ? error.message : 'Unknown database error');
    return NextResponse.json({ error: 'Unable to update post.' }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: RouteContext) {
  const { id } = await params;
  if (!tursoClient) return NextResponse.json({ error: 'Post storage is unavailable.' }, { status: 503 });
  try {
    await initTursoSchema();
    const user = await getAuthenticatedUser();
    if (!user) return NextResponse.json({ error: 'Sign in to edit posts.' }, { status: 401 });
    const postShard = await findPostShard(id);
    if (!postShard) return NextResponse.json({ error: 'Post not found.' }, { status: 404 });

    const body = await request.json();
    const content = typeof body?.content === 'string' ? body.content.trim() : '';
    const hasContentWarning = Boolean(body && typeof body === 'object' && Object.prototype.hasOwnProperty.call(body, 'contentWarning'));
    const contentWarning = typeof body?.contentWarning === 'string' ? body.contentWarning.normalize('NFKC').trim() : '';
    if (!content || content.length > 2000) {
      return NextResponse.json({ error: 'Posts must be between 1 and 2000 characters.' }, { status: 400 });
    }
    if (hasContentWarning && typeof body.contentWarning !== 'string') {
      return NextResponse.json({ error: 'Content warning must be text.' }, { status: 400 });
    }
    if (contentWarning.length > 80) {
      return NextResponse.json({ error: 'Content warnings must be 80 characters or fewer.' }, { status: 400 });
    }

    const post = await postShard.client.execute({
      sql: 'SELECT user_id, created_at FROM posts WHERE id = ?',
      args: [id]
    });
    if (!post.rows[0]) return NextResponse.json({ error: 'Post not found.' }, { status: 404 });
    if (String(post.rows[0].user_id) !== user.uid) return NextResponse.json({ error: 'You can only edit your own posts.' }, { status: 403 });
    const createdAt = Date.parse(String(post.rows[0].created_at));
    if (!Number.isFinite(createdAt) || Date.now() - createdAt > 15 * 60 * 1000) {
      return NextResponse.json({ error: 'Posts can only be edited within 15 minutes of posting.' }, { status: 409 });
    }

    const updatedAt = new Date().toISOString();
    const matches = content.match(/#[a-zA-Z0-9_]+/g) || [];
    const hashtags = Array.from(new Set(matches.map((tag: string) => tag.slice(1).toLowerCase())));
    const statements = [
      {
        sql: `UPDATE posts SET content = ?, updated_at = ?,
          content_warning = CASE WHEN ? = 1 THEN ? ELSE content_warning END
          WHERE id = ?`,
        args: [content, updatedAt, hasContentWarning ? 1 : 0, contentWarning || null, id]
      },
      { sql: 'DELETE FROM post_hashtags WHERE post_id = ?', args: [id] },
      ...hashtags.map((hashtag) => ({
        sql: 'INSERT INTO post_hashtags (hashtag, post_id, created_at) VALUES (?, ?, ?)',
        args: [hashtag, id, updatedAt]
      }))
    ];
    await postShard.client.batch(statements, 'write');
    return NextResponse.json({ content, updatedAt });
  } catch (error) {
    console.error('Unable to edit post:', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json({ error: 'Unable to edit post.' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: RouteContext) {
  const { id } = await params;
  if (!tursoClient) return NextResponse.json({ error: 'Post storage is unavailable.' }, { status: 503 });

  try {
    await initTursoSchema();
    const user = await getAuthenticatedUser();
    if (!user) return NextResponse.json({ error: 'Sign in to delete posts.' }, { status: 401 });

    const postShard = await findPostShard(id);
    if (!postShard) return NextResponse.json({ error: 'Post not found.' }, { status: 404 });
    const post = await postShard.client.execute({ sql: 'SELECT id, user_id FROM posts WHERE id = ?', args: [id] });
    if (!post.rows[0]) return NextResponse.json({ error: 'Post not found.' }, { status: 404 });
    if (!isAdminUid(user.uid) && String(post.rows[0].user_id) !== user.uid) {
      return NextResponse.json({ error: 'You can only delete your own posts.' }, { status: 403 });
    }

    const linkedReplies = await postShard.client.execute({
      sql: 'SELECT reply_post_id FROM post_bot_responses WHERE source_post_id = ?',
      args: [id]
    });
    const postIds = [id, ...linkedReplies.rows.map((row) => String(row.reply_post_id))];
    const placeholders = postIds.map(() => '?').join(', ');

    const shards = getConfiguredTursoShards();
    await Promise.all(shards.map((shard) => shard.client.batch([
      {
        sql: `DELETE FROM notifications
          WHERE entity_id IN (${placeholders})
            OR entity_id IN (SELECT id FROM post_comments WHERE post_id IN (${placeholders}))`,
        args: [...postIds, ...postIds]
      },
      { sql: `DELETE FROM post_comments WHERE post_id IN (${placeholders})`, args: postIds },
      { sql: `DELETE FROM post_reposts WHERE post_id IN (${placeholders})`, args: postIds },
      { sql: `DELETE FROM bookmarks WHERE post_id IN (${placeholders})`, args: postIds },
      { sql: `DELETE FROM pinned_posts WHERE post_id IN (${placeholders})`, args: postIds },
      { sql: `DELETE FROM post_hashtags WHERE post_id IN (${placeholders})`, args: postIds },
      { sql: `DELETE FROM post_reports WHERE post_id IN (${placeholders})`, args: postIds },
      {
        sql: `DELETE FROM post_bot_responses
          WHERE source_post_id IN (${placeholders}) OR reply_post_id IN (${placeholders})`,
        args: [...postIds, ...postIds]
      },
      ...(shard.id === postShard.id ? [{ sql: `DELETE FROM posts WHERE id IN (${placeholders})`, args: postIds }] : [])
    ], 'write')));

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Unable to delete post:', error instanceof Error ? error.message : 'Unknown database error');
    return NextResponse.json({ error: 'Unable to delete post.' }, { status: 500 });
  }
}
