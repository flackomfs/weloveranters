import { NextResponse } from 'next/server';
import { getAppUserClient, getAuthenticatedUser } from '@/lib/auth';
import { INTERESTS } from '@/lib/interests';
import { getConfiguredTursoShards, initTursoSchema, tursoClient } from '@/lib/turso';

type Recommendation = {
  id: string;
  username: string;
  name: string;
  avatarUrl: string;
  createdAt: string;
  matchingInterests: number;
};

export async function GET() {
  if (!tursoClient) return NextResponse.json({ error: 'Interest recommendations are unavailable.' }, { status: 503 });
  try {
    await initTursoSchema();
    const user = await getAuthenticatedUser();
    if (!user) return NextResponse.json({ error: 'Sign in to choose interests.' }, { status: 401 });
    const userClient = getAppUserClient(user);
    const shards = getConfiguredTursoShards();
    const [interestResult, followResult, blockResults] = await Promise.all([
      userClient.execute({
        sql: 'SELECT interest FROM user_interests WHERE user_id = ? ORDER BY interest',
        args: [user.uid]
      }),
      userClient.execute({
        sql: 'SELECT following_id FROM follows WHERE follower_id = ?',
        args: [user.uid]
      }),
      Promise.all(shards.map((shard) => shard.client.execute({
        sql: `SELECT blocked_id AS userId FROM blocked_users WHERE blocker_id = ?
          UNION SELECT blocker_id AS userId FROM blocked_users WHERE blocked_id = ?`,
        args: [user.uid, user.uid]
      })))
    ]);
    const interests = interestResult.rows.map((row) => String(row.interest));
    const followedIds = new Set(followResult.rows.map((row) => String(row.following_id)));
    const blockedIds = new Set(blockResults.flatMap((result) => result.rows.map((row) => String(row.userId))));
    const candidates = await Promise.all(shards.map(async (shard) => {
      const users = await shard.client.execute({
        sql: `SELECT u.id, u.username, COALESCE(u.display_name, u.username, 'Member') AS name,
            u.avatar_url AS avatarUrl, u.created_at AS createdAt,
            COUNT(DISTINCT h.hashtag) AS matchingInterests
          FROM users u
          LEFT JOIN posts p ON p.user_id = u.id
          LEFT JOIN post_hashtags h ON h.post_id = p.id
            AND h.hashtag IN (${interests.length ? interests.map(() => '?').join(', ') : "''"})
          WHERE u.id <> ? AND u.private_profile = 0 AND u.is_bot = 0 AND u.username IS NOT NULL AND u.username <> ''
          GROUP BY u.id
          ORDER BY matchingInterests DESC, u.created_at DESC LIMIT 100`,
        args: [...interests, user.uid]
      });
      return users.rows.map((row): Recommendation => ({
          id: String(row.id),
          username: String(row.username),
          name: String(row.name),
          avatarUrl: String(row.avatarUrl || ''),
          createdAt: String(row.createdAt),
          matchingInterests: Number(row.matchingInterests || 0)
        }));
    }));
    const recommendations = candidates.flat().filter((candidate) =>
      !followedIds.has(String(candidate.id)) && !blockedIds.has(String(candidate.id))
    ).sort((left, right) =>
      Number(right.matchingInterests) - Number(left.matchingInterests)
      || String(right.createdAt).localeCompare(String(left.createdAt))
    ).slice(0, 8);

    return NextResponse.json({
      interests,
      options: INTERESTS,
      recommendations: recommendations.map((row) => ({
        ...row,
        avatarUrl: String(row.avatarUrl || '').startsWith('data:image/')
          ? `/api/profile/photo?uid=${encodeURIComponent(String(row.id))}`
          : row.avatarUrl
      }))
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('Unable to load interests:', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json({ error: 'Unable to load interests.' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  if (!tursoClient) return NextResponse.json({ error: 'Interest preferences are unavailable.' }, { status: 503 });
  try {
    await initTursoSchema();
    const user = await getAuthenticatedUser();
    if (!user) return NextResponse.json({ error: 'Sign in to save interests.' }, { status: 401 });
    const userClient = getAppUserClient(user);
    const body = await request.json();
    const requested = Array.isArray(body?.interests) ? body.interests : null;
    if (!requested || requested.some((interest: unknown) => typeof interest !== 'string' || !INTERESTS.includes(interest as typeof INTERESTS[number]))) {
      return NextResponse.json({ error: 'Choose from the available interests.' }, { status: 400 });
    }
    const interests = Array.from(new Set(requested)) as string[];
    if (interests.length < 1 || interests.length > 6) {
      return NextResponse.json({ error: 'Choose between 1 and 6 interests.' }, { status: 400 });
    }
    const createdAt = new Date().toISOString();
    await userClient.batch([
      { sql: 'DELETE FROM user_interests WHERE user_id = ?', args: [user.uid] },
      ...interests.map((interest) => ({
        sql: 'INSERT INTO user_interests (user_id, interest, created_at) VALUES (?, ?, ?)',
        args: [user.uid, interest, createdAt]
      }))
    ], 'write');
    return NextResponse.json({ interests });
  } catch (error) {
    console.error('Unable to save interests:', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json({ error: 'Unable to save interests.' }, { status: 500 });
  }
}
