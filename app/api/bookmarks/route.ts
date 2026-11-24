import { NextResponse } from 'next/server';
import { getAppUserClient, getAuthenticatedUser } from '@/lib/auth';
import { findPostShard, findUserShard, initTursoSchema, tursoClient } from '@/lib/turso';

async function ensureDefaultCollection(client: NonNullable<typeof tursoClient>, userId: string) {
  const existing = await client.execute({
    sql: "SELECT id FROM saved_collections WHERE user_id = ? AND name = 'Saved'",
    args: [userId]
  });
  if (existing.rows[0]) return String(existing.rows[0].id);

  const id = `collection_${crypto.randomUUID()}`;
  await client.execute({
    sql: 'INSERT OR IGNORE INTO saved_collections (id, user_id, name, created_at) VALUES (?, ?, ?, ?)',
    args: [id, userId, 'Saved', new Date().toISOString()]
  });
  const created = await client.execute({
    sql: "SELECT id FROM saved_collections WHERE user_id = ? AND name = 'Saved'",
    args: [userId]
  });
  if (!created.rows[0]) throw new Error('Unable to create the default saved collection.');
  return String(created.rows[0].id);
}

export async function GET() {
  if (!tursoClient) return NextResponse.json({ error: 'Bookmark storage is unavailable.' }, { status: 503 });
  try {
    await initTursoSchema();
    const user = await getAuthenticatedUser();
    if (!user) return NextResponse.json({ error: 'Sign in to view saved posts.' }, { status: 401 });
    const client = getAppUserClient(user);
    await ensureDefaultCollection(client, user.uid);
    const result = await client.execute({
      sql: `SELECT id, name, created_at AS createdAt
        FROM saved_collections WHERE user_id = ? ORDER BY CASE WHEN name = 'Saved' THEN 0 ELSE 1 END, created_at ASC`,
      args: [user.uid]
    });
    return NextResponse.json({ collections: result.rows }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('Unable to load saved collections:', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json({ error: 'Unable to load saved collections.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!tursoClient) return NextResponse.json({ error: 'Bookmark storage is unavailable.' }, { status: 503 });
  try {
    await initTursoSchema();
    const user = await getAuthenticatedUser();
    if (!user) return NextResponse.json({ error: 'Sign in to manage saved posts.' }, { status: 401 });
    const client = getAppUserClient(user);

    const body = await request.json();
    const action = typeof body?.action === 'string' ? body.action : '';

    if (action === 'create-collection') {
      const name = typeof body.name === 'string' ? body.name.normalize('NFKC').trim() : '';
      if (!name || name.length > 40) {
        return NextResponse.json({ error: 'Collection names must be between 1 and 40 characters.' }, { status: 400 });
      }
      if (name.toLocaleLowerCase() === 'saved') {
        return NextResponse.json({ error: 'Saved is reserved for your default collection.' }, { status: 400 });
      }
      const count = await client.execute({
        sql: 'SELECT COUNT(*) AS count FROM saved_collections WHERE user_id = ?',
        args: [user.uid]
      });
      if (Number(count.rows[0]?.count || 0) >= 20) {
        return NextResponse.json({ error: 'You can create up to 20 collections.' }, { status: 409 });
      }
      const id = `collection_${crypto.randomUUID()}`;
      await client.execute({
        sql: 'INSERT INTO saved_collections (id, user_id, name, created_at) VALUES (?, ?, ?, ?)',
        args: [id, user.uid, name, new Date().toISOString()]
      });
      return NextResponse.json({ collection: { id, name } });
    }

    if (action === 'delete-collection') {
      const collectionId = typeof body.collectionId === 'string' ? body.collectionId : '';
      const defaultCollectionId = await ensureDefaultCollection(client, user.uid);
      if (!collectionId || collectionId === defaultCollectionId) {
        return NextResponse.json({ error: 'The default Saved collection cannot be deleted.' }, { status: 400 });
      }
      const collection = await client.execute({
        sql: 'SELECT id FROM saved_collections WHERE id = ? AND user_id = ?',
        args: [collectionId, user.uid]
      });
      if (!collection.rows[0]) return NextResponse.json({ error: 'Collection not found.' }, { status: 404 });
      await client.batch([
        { sql: 'UPDATE bookmarks SET collection_id = ? WHERE user_id = ? AND collection_id = ?', args: [defaultCollectionId, user.uid, collectionId] },
        { sql: 'DELETE FROM saved_collections WHERE id = ? AND user_id = ?', args: [collectionId, user.uid] }
      ], 'write');
      return NextResponse.json({ ok: true });
    }

    const postId = typeof body?.postId === 'string' ? body.postId : '';
    if (!postId || !['save', 'remove', 'move'].includes(action)) {
      return NextResponse.json({ error: 'Choose a post and a valid saved-post action.' }, { status: 400 });
    }

    if (action === 'remove') {
      await client.execute({
        sql: 'DELETE FROM bookmarks WHERE user_id = ? AND post_id = ?',
        args: [user.uid, postId]
      });
      return NextResponse.json({ saved: false });
    }

    const postShard = await findPostShard(postId);
    if (!postShard) return NextResponse.json({ error: 'Post not found or unavailable.' }, { status: 404 });
    const post = await postShard.client.execute({
      sql: `SELECT p.user_id AS authorId, source_post.user_id AS sourceAuthorId
        FROM posts p
        LEFT JOIN post_bot_responses bot_response ON bot_response.reply_post_id = p.id
        LEFT JOIN posts source_post ON source_post.id = bot_response.source_post_id
        WHERE p.id = ?`,
      args: [postId]
    });
    const authorId = String(post.rows[0]?.authorId || '');
    const sourceAuthorId = String(post.rows[0]?.sourceAuthorId || '');
    const authorShard = authorId ? await findUserShard(authorId) : null;
    const sourceAuthorShard = sourceAuthorId ? await findUserShard(sourceAuthorId) : null;
    if (!authorShard) return NextResponse.json({ error: 'Post not found or unavailable.' }, { status: 404 });
    const [author, follows, sourceAuthor, sourceFollows, viewerBlocks, authorBlock, sourceBlock] = await Promise.all([
      authorShard.client.execute({
        sql: 'SELECT private_profile FROM users WHERE id = ?',
        args: [authorId]
      }),
      client.execute({
        sql: 'SELECT 1 FROM follows WHERE follower_id = ? AND following_id = ?',
        args: [user.uid, authorId]
      }),
      sourceAuthorShard
        ? sourceAuthorShard.client.execute({
          sql: 'SELECT private_profile FROM users WHERE id = ?',
          args: [sourceAuthorId]
        })
        : Promise.resolve(null),
      sourceAuthorId
        ? client.execute({
          sql: 'SELECT 1 FROM follows WHERE follower_id = ? AND following_id = ?',
          args: [user.uid, sourceAuthorId]
        })
        : Promise.resolve(null),
      client.execute({
        sql: `SELECT blocked_id FROM blocked_users
          WHERE blocker_id = ? AND blocked_id IN (${[authorId, sourceAuthorId].filter(Boolean).map(() => '?').join(', ')})`,
        args: [user.uid, ...[authorId, sourceAuthorId].filter(Boolean)]
      }),
      authorShard.client.execute({
        sql: 'SELECT 1 FROM blocked_users WHERE blocker_id = ? AND blocked_id = ?',
        args: [authorId, user.uid]
      }),
      sourceAuthorShard
        ? sourceAuthorShard.client.execute({
          sql: 'SELECT 1 FROM blocked_users WHERE blocker_id = ? AND blocked_id = ?',
          args: [sourceAuthorId, user.uid]
        })
        : Promise.resolve(null)
    ]);
    if (
      Number(author.rows[0]?.private_profile || 0) > 0
      && authorId !== user.uid
      && !follows.rows[0]
    ) return NextResponse.json({ error: 'Post not found or unavailable.' }, { status: 404 });
    if (
      Number(sourceAuthor?.rows[0]?.private_profile || 0) > 0
      && sourceAuthorId !== user.uid
      && !sourceFollows?.rows[0]
    ) return NextResponse.json({ error: 'Post not found or unavailable.' }, { status: 404 });
    if (viewerBlocks.rows[0] || authorBlock.rows[0] || sourceBlock?.rows[0]) {
      return NextResponse.json({ error: 'Post not found or unavailable.' }, { status: 404 });
    }

    const collectionId = typeof body.collectionId === 'string' && body.collectionId
      ? body.collectionId
      : await ensureDefaultCollection(client, user.uid);
    const collection = await client.execute({
      sql: 'SELECT id FROM saved_collections WHERE id = ? AND user_id = ?',
      args: [collectionId, user.uid]
    });
    if (!collection.rows[0]) return NextResponse.json({ error: 'Collection not found.' }, { status: 404 });

    await client.execute({
      sql: `INSERT INTO bookmarks (user_id, post_id, collection_id, created_at) VALUES (?, ?, ?, ?)
        ON CONFLICT(user_id, post_id) DO UPDATE SET collection_id = excluded.collection_id`,
      args: [user.uid, postId, collectionId, new Date().toISOString()]
    });
    return NextResponse.json({ saved: true, collectionId });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    if (message.includes('UNIQUE constraint failed')) {
      return NextResponse.json({ error: 'A collection with that name already exists.' }, { status: 409 });
    }
    console.error('Unable to update saved posts:', message);
    return NextResponse.json({ error: 'Unable to update saved posts.' }, { status: 500 });
  }
}
