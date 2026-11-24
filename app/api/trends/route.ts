import { NextResponse } from 'next/server';
import { getConfiguredTursoShards, initTursoSchema, tursoClient } from '@/lib/turso';

export const dynamic = 'force-dynamic';

export async function GET() {
  if (!tursoClient) {
    return NextResponse.json({ trends: [], available: false }, {
      headers: { 'Cache-Control': 'no-store' }
    });
  }

  try {
    const shards = getConfiguredTursoShards();
    await Promise.all(shards.map((shard) => initTursoSchema(shard.client)));
    const results = await Promise.all(shards.map((shard) => shard.client.execute(`
      SELECT h.hashtag AS topic, COUNT(*) AS posts
      FROM post_hashtags h
      INNER JOIN posts p ON p.id = h.post_id
      INNER JOIN users u ON u.id = p.user_id
      WHERE COALESCE(u.private_profile, 0) = 0
      GROUP BY h.hashtag
    `)));
    const totals = new Map<string, number>();
    for (const result of results) {
      for (const row of result.rows) {
        const topic = String(row.topic);
        totals.set(topic, (totals.get(topic) || 0) + Number(row.posts));
      }
    }

    const trends = Array.from(totals, ([topic, posts]) => ({ topic, posts }))
      .sort((left, right) => right.posts - left.posts || left.topic.localeCompare(right.topic))
      .slice(0, 10);

    return NextResponse.json({ trends, available: true }, {
      headers: { 'Cache-Control': 'no-store' }
    });
  } catch (error) {
    console.error(
      'Unable to load trending hashtags:',
      error instanceof Error ? `${error.name}: ${error.message}` : 'Unknown database error'
    );
    return NextResponse.json({ error: 'Unable to load trending hashtags.' }, {
      status: 500,
      headers: { 'Cache-Control': 'no-store' }
    });
  }
}