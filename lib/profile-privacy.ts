import type { Client } from '@libsql/client';

export async function canViewUserContent(client: Client, userId: string, viewerId: string) {
  const result = await client.execute({
    sql: `SELECT CASE
        WHEN COALESCE(u.private_profile, 0) = 0 OR u.id = ?
          OR EXISTS (
            SELECT 1 FROM follows f WHERE f.follower_id = ? AND f.following_id = u.id
          )
        THEN 1 ELSE 0
      END AS canView
      FROM users u
      WHERE u.id = ?`,
    args: [viewerId, viewerId, userId]
  });
  return Number(result.rows[0]?.canView || 0) > 0;
}
