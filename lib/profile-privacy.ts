import type { Client } from '@libsql/client';
import { findUserShard } from '@/lib/turso';

export async function canViewUserContent(_client: Client, userId: string, viewerId: string) {
  const ownerShard = await findUserShard(userId);
  if (!ownerShard) return false;
  const profile = await ownerShard.client.execute({
    sql: 'SELECT private_profile FROM users WHERE id = ?',
    args: [userId]
  });
  if (!profile.rows[0]) return false;
  if (Number(profile.rows[0].private_profile || 0) === 0 || userId === viewerId) return true;
  if (!viewerId) return false;

  const viewerShard = await findUserShard(viewerId);
  if (!viewerShard) return false;
  const following = await viewerShard.client.execute({
    sql: 'SELECT 1 FROM follows WHERE follower_id = ? AND following_id = ?',
    args: [viewerId, userId]
  });
  return Boolean(following.rows[0]);
}
