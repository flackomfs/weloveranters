import { auth, currentUser } from '@clerk/nextjs/server';
import { initTursoSchema, tursoClient } from '@/lib/turso';

export type AppUser = {
  uid: string;
  clerkUserId: string;
  email: string;
  name: string;
  picture: string;
};

export async function getAuthenticatedUser(): Promise<AppUser | null> {
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) return null;

  const clerkUser = await currentUser();
  if (!clerkUser) return null;

  if (!tursoClient) throw new Error('User storage is unavailable.');
  await initTursoSchema();

  const emailAddress = clerkUser.emailAddresses.find(
    (address) => address.id === clerkUser.primaryEmailAddressId
  );
  const email = emailAddress?.emailAddress || '';
  const isVerifiedEmail = emailAddress?.verification?.status === 'verified';
  const name = clerkUser.fullName || clerkUser.firstName || email.split('@')[0] || 'New user';
  const picture = clerkUser.imageUrl || '';

  let account = await tursoClient.execute({
    sql: 'SELECT id FROM users WHERE clerk_user_id = ?',
    args: [clerkUserId]
  });

  if (!account.rows[0] && email && isVerifiedEmail) {
    const existing = await tursoClient.execute({
      sql: `SELECT id, clerk_user_id FROM users
        WHERE lower(email) = lower(?)
        LIMIT 1`,
      args: [email]
    });
    const existingId = existing.rows[0]?.id;
    const linkedClerkUserId = existing.rows[0]?.clerk_user_id;
    if (existingId && !linkedClerkUserId) {
      await tursoClient.execute({
        sql: 'UPDATE users SET clerk_user_id = ? WHERE id = ? AND clerk_user_id IS NULL',
        args: [clerkUserId, String(existingId)]
      });
      account = await tursoClient.execute({
        sql: 'SELECT id FROM users WHERE clerk_user_id = ?',
        args: [clerkUserId]
      });
    } else if (existingId && linkedClerkUserId !== clerkUserId) {
      throw new Error('This verified email is already linked to another account.');
    }
  }

  if (!account.rows[0]) {
    await tursoClient.execute({
      sql: `INSERT INTO users (id, clerk_user_id, email)
        VALUES (?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET clerk_user_id = excluded.clerk_user_id`,
      args: [clerkUserId, clerkUserId, isVerifiedEmail ? email : null]
    });
    account = await tursoClient.execute({
      sql: 'SELECT id FROM users WHERE clerk_user_id = ?',
      args: [clerkUserId]
    });
  }

  const uid = account.rows[0]?.id;
  if (typeof uid !== 'string') throw new Error('Unable to resolve your account.');

  if (isVerifiedEmail) {
    await tursoClient.execute({
      sql: 'UPDATE users SET email = COALESCE(email, ?) WHERE id = ?',
      args: [email, uid]
    });
  }

  return { uid, clerkUserId, email: isVerifiedEmail ? email : '', name, picture };
}
