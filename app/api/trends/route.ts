import { NextResponse } from 'next/server';
import { initTursoSchema, tursoClient } from '@/lib/turso';

export const dynamic = 'force-dynamic';

export async function GET() {
  if (!tursoClient) {
    return NextResponse.json({ trends: [], available: false }, {
      headers: { 'Cache-Control': 'no-store' }
    });
  }

  try {
    await initTursoSchema();
    const result = await tursoClient.execute(`
      SELECT hashtag AS topic, COUNT(*) AS posts
      FROM post_hashtags
      GROUP BY hashtag
      ORDER BY posts DESC, hashtag ASC
      LIMIT 10
    `);

    const trends = result.rows.map((row) => ({
      topic: String(row.topic),
      posts: Number(row.posts)
    }));

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