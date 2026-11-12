import type { Client } from '@libsql/client';

export async function getAvailableDisplayName(client: Client, preferredName: string, userId: string) {
  const baseName = preferredName.normalize('NFKC').trim().slice(0, 80) || 'New user';
  const existingName = await client.execute({
    sql: 'SELECT 1 FROM users WHERE lower(trim(display_name)) = lower(?) AND id <> ? LIMIT 1',
    args: [baseName, userId]
  });
  if (!existingName.rows.length) return baseName;

  const suffix = ` (${userId})`;
  const uniqueName = `${baseName.slice(0, Math.max(1, 80 - suffix.length))}${suffix}`;
  const existingUniqueName = await client.execute({
    sql: 'SELECT 1 FROM users WHERE lower(trim(display_name)) = lower(?) AND id <> ? LIMIT 1',
    args: [uniqueName, userId]
  });
  if (existingUniqueName.rows.length) {
    throw new Error('Unable to generate a unique display name for this account.');
  }

  return uniqueName;
}
