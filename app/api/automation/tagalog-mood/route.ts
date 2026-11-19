import { NextResponse } from 'next/server';
import { createTagalogSupportPost, findDominantFeedMood, type FeedMood } from '@/lib/tagalog-mood-bot';
import { initTursoSchema, tursoClient } from '@/lib/turso';

const botUserId = 'system:tagalog-mood-bot';
const fallbackMoods: FeedMood[] = ['happy', 'sad', 'stressed', 'angry'];

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: 'Scheduled bot is not configured.' }, { status: 503 });
  }
  if (request.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }
  if (!tursoClient) {
    return NextResponse.json({ error: 'Post storage is unavailable.' }, { status: 503 });
  }

  try {
    await initTursoSchema();
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const recentPosts = await tursoClient.execute({
      sql: `SELECT p.content, p.user_id AS userId
        FROM posts p
        LEFT JOIN users u ON u.id = p.user_id
        WHERE datetime(p.created_at) >= datetime(?)
          AND COALESCE(u.is_bot, 0) = 0
        ORDER BY p.created_at DESC
        LIMIT 200`,
      args: [since]
    });
    const detectedMood = findDominantFeedMood(recentPosts.rows.map((row) => ({
      content: String(row.content || ''),
      userId: String(row.userId)
    })));

    await tursoClient.execute({
      sql: `INSERT INTO users (id, email, display_name, username, avatar_url, is_bot)
        VALUES (?, NULL, 'Kumusta Bot', 'kumusta_bot_weloveranters', '', 1)
        ON CONFLICT(id) DO UPDATE SET
          display_name = 'Kumusta Bot',
          username = 'kumusta_bot_weloveranters',
          is_bot = 1`,
      args: [botUserId]
    });

    const now = new Date();
    const runDate = now.toISOString().slice(0, 10);
    const dailyTarget = Math.floor(Math.random() * 6) + 5;
    await tursoClient.execute({
      sql: `INSERT OR IGNORE INTO tagalog_mood_bot_daily (run_date, target_count, posted_count, attempt_count)
        SELECT ?, ?, COUNT(*), 0
        FROM posts
        WHERE user_id = ? AND substr(created_at, 1, 10) = ?`,
      args: [runDate, dailyTarget, botUserId, runDate]
    });

    const dailyRunResult = await tursoClient.execute({
      sql: `SELECT target_count, posted_count
        FROM tagalog_mood_bot_daily
        WHERE run_date = ?`,
      args: [runDate]
    });
    const dailyRun = dailyRunResult.rows[0];
    if (!dailyRun) {
      throw new Error('Unable to initialize the daily bot run.');
    }

    const targetCount = Number(dailyRun.target_count);
    const postedCount = Number(dailyRun.posted_count);
    if (postedCount >= targetCount) {
      return NextResponse.json({ posted: false, reason: 'The bot reached its daily target.', targetCount });
    }

    const postsToPublish = Array.from({ length: targetCount - postedCount }, (_, index) => {
      const postNumber = postedCount + index + 1;
      const mood = detectedMood || fallbackMoods[(postNumber - 1) % fallbackMoods.length];
      const content = createTagalogSupportPost(mood, runDate, postNumber);
      const hashtags = Array.from(new Set(
        (content.match(/#[a-zA-Z0-9_]+/g) || []).map((tag) => tag.slice(1).toLowerCase())
      ));
      const createdAt = new Date(now.getTime() + index).toISOString();
      return {
        id: `rant_${crypto.randomUUID()}`,
        content,
        hashtags,
        createdAt
      };
    });

    const statements = [
      {
        sql: `UPDATE tagalog_mood_bot_daily
          SET posted_count = posted_count + ?
          WHERE run_date = ? AND posted_count = ? AND posted_count + ? <= target_count`,
        args: [postsToPublish.length, runDate, postedCount, postsToPublish.length]
      }
    ];
    for (const post of postsToPublish) {
      statements.push({
        sql: `INSERT INTO tagalog_mood_bot_posts (post_id, run_date, content, created_at)
          SELECT ?, ?, ?, ? WHERE changes() = 1`,
        args: [post.id, runDate, post.content, post.createdAt]
      });
      statements.push({
        sql: `INSERT INTO posts (id, user_id, content, created_at, updated_at)
          SELECT ?, ?, ?, ?, ?
          WHERE changes() = 1
            AND EXISTS (SELECT 1 FROM tagalog_mood_bot_posts WHERE post_id = ?)`,
        args: [post.id, botUserId, post.content, post.createdAt, post.createdAt, post.id]
      });
      statements.push(...post.hashtags.map((hashtag) => ({
        sql: `INSERT INTO post_hashtags (hashtag, post_id, created_at)
          SELECT ?, ?, ?
          WHERE changes() = 1
            AND EXISTS (SELECT 1 FROM tagalog_mood_bot_posts WHERE post_id = ?)`,
        args: [hashtag, post.id, post.createdAt, post.id]
      })));
    }

    const publish = await tursoClient.batch(statements, 'write');
    if (Number(publish[0]?.rowsAffected) === 0) {
      return NextResponse.json({ posted: false, reason: 'The bot reached its daily target.', targetCount });
    }

    return NextResponse.json({ posted: true, postsCreated: postsToPublish.length, targetCount });
  } catch (error) {
    console.error('Unable to publish Tagalog mood post:', error instanceof Error ? error.message : 'Unknown database error');
    return NextResponse.json({ error: 'Unable to publish the automated post.' }, { status: 500 });
  }
}
