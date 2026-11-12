import { NextResponse } from 'next/server';
import { verifyIdToken } from '@/lib/firebase';
import { isAdminUid } from '@/lib/admin';
import { initTursoSchema, tursoClient } from '@/lib/turso';

type SocialLinks = {
  website?: string;
  instagram?: string;
  tiktok?: string;
  youtube?: string;
  linkedin?: string;
  x?: string;
};

const MAX_PROFILE_IMAGE_BYTES = 800_000;

function parseSocialLinks(value: unknown): SocialLinks {
  if (typeof value !== 'string') return {};
  try {
    return JSON.parse(value) as SocialLinks;
  } catch {
    return {};
  }
}

function profileFromRow(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    name: String(row.display_name || 'New user'),
    username: String(row.username || ''),
    avatarUrl: String(row.avatar_url || ''),
    bannerUrl: String(row.banner_url || ''),
    bio: String(row.bio || ''),
    socialLinks: parseSocialLinks(row.social_links),
    createdAt: String(row.created_at || ''),
    followersOverride: row.followers_override == null ? null : Number(row.followers_override),
    followingOverride: row.following_override == null ? null : Number(row.following_override)
  };
}

function getBearerToken(request: Request) {
  const authorization = request.headers.get('authorization') || '';
  return authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
}

async function addFollowState(profile: ReturnType<typeof profileFromRow>, viewerId: string | null) {
  if (!tursoClient) return profile;

  const [counts, verification, isFollowing] = await Promise.all([
    tursoClient.execute({
      sql: `SELECT
        (SELECT COUNT(*) FROM follows WHERE following_id = ?) AS followers,
        (SELECT COUNT(*) FROM follows WHERE follower_id = ?) AS following`,
      args: [profile.id, profile.id]
    }),
    tursoClient.execute({
      sql: `SELECT requested_badge FROM user_verification_requests
        WHERE user_id = ? AND status = 'approved'`,
      args: [profile.id]
    }),
    viewerId && viewerId !== profile.id
      ? tursoClient.execute({
        sql: 'SELECT 1 FROM follows WHERE follower_id = ? AND following_id = ?',
        args: [viewerId, profile.id]
      })
      : Promise.resolve(null)
  ]);
  const isAdmin = isAdminUid(profile.id);
  const requestedBadge = verification.rows[0]?.requested_badge;

  return {
    ...profile,
    followers: profile.followersOverride ?? Number(counts.rows[0]?.followers || 0),
    following: profile.followingOverride ?? Number(counts.rows[0]?.following || 0),
    isFollowing: Boolean(isFollowing?.rows[0]),
    canManageStats: Boolean(viewerId && isAdminUid(viewerId)),
    verificationBadge: isAdmin ? 'moderator' : requestedBadge === 'boy' || requestedBadge === 'girl' ? requestedBadge : null
  };
}

function makeDefaultUsername(email: string | undefined, uid: string) {
  const emailName = email?.split('@')[0] || 'user';
  const base = emailName.toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 11) || 'user';
  const suffix = uid.toLowerCase().replace(/[^a-z0-9_]/g, '').slice(-12) || 'account';
  return `${base}_${suffix}`;
}

async function ensureProfile(uid: string, email?: string, displayName?: string, avatarUrl?: string, bannerUrl?: string) {
  if (!tursoClient) throw new Error('Profile storage is unavailable. Configure the Turso database environment variables.');

  const existing = await tursoClient.execute({
    sql: 'SELECT id, username, display_name, avatar_url, banner_url, email FROM users WHERE id = ?',
    args: [uid]
  });
  const current = existing.rows[0];
  const emailName = email?.split('@')[0] || 'user';
  const defaultUsername = makeDefaultUsername(email, uid);
  const safeEmail = email || '';

  if (current) {
    await tursoClient.execute({
      sql: `UPDATE users SET
        username = CASE WHEN username IS NULL OR username = '' THEN ? ELSE username END,
        display_name = CASE WHEN display_name IS NULL OR display_name = '' THEN ? ELSE display_name END,
        avatar_url = CASE WHEN avatar_url IS NULL OR avatar_url = '' THEN ? ELSE avatar_url END,
        banner_url = CASE WHEN banner_url IS NULL OR banner_url = '' THEN ? ELSE banner_url END,
        email = CASE WHEN email IS NULL OR email = '' THEN ? ELSE email END
        WHERE id = ?`,
      args: [defaultUsername, displayName || emailName, avatarUrl || '', bannerUrl || '', safeEmail, uid]
    });
  } else {
    const emailOwner = email
      ? await tursoClient.execute({
          sql: 'SELECT id FROM users WHERE email = ? LIMIT 1',
          args: [email]
        })
      : null;

    const insertEmail = emailOwner?.rows.length ? null : safeEmail;

    await tursoClient.execute({
      sql: `INSERT INTO users (id, email, display_name, username, avatar_url, banner_url, social_links)
        VALUES (?, ?, ?, ?, ?, ?, '{}')`,
      args: [uid, insertEmail, displayName || emailName, defaultUsername, avatarUrl || '', bannerUrl || '']
    });
  }

  const profile = await tursoClient.execute({
    sql: `SELECT id, display_name, username, avatar_url, banner_url, bio, social_links, created_at,
      followers_override, following_override
      FROM users WHERE id = ?`,
    args: [uid]
  });

  return profile.rows[0] ? profileFromRow(profile.rows[0]) : null;
}

function normalizeUrl(value: unknown, label: string) {
  if (typeof value !== 'string' || !value.trim()) return '';
  if (value.length > 2048) throw new Error(`${label} URL is too long.`);

  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    throw new Error(`${label} must be a complete URL starting with https://.`);
  }

  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new Error(`${label} must start with https://.`);
  }

  return url.toString();
}

function normalizeProfileImage(value: unknown, label: string) {
  if (typeof value !== 'string' || !value.trim()) return '';
  const avatar = value.trim();
  if (avatar.length > 1_100_000) throw new Error(`${label} must be 800 KB or smaller.`);

  if (avatar.startsWith('data:')) {
    const match = avatar.match(/^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/);
    if (!match) {
      throw new Error(`${label} must be a Base64 JPEG, PNG, or WebP image.`);
    }
    if (Buffer.from(match[2], 'base64').byteLength > MAX_PROFILE_IMAGE_BYTES) {
      throw new Error(`${label} must be 800 KB or smaller.`);
    }
    return avatar;
  }

  return normalizeUrl(avatar, 'Photo');
}

async function authenticate(request: Request) {
  const token = getBearerToken(request);
  if (!token) return null;
  return verifyIdToken(token);
}

function getServerConfigMessage(error: unknown) {
  const message = error instanceof Error ? error.message : '';
  if (!message) return 'Profile service is unavailable.';
  if (message.includes('not configured') || message.includes('Configure the')) {
    return 'Profile service is unavailable. Configure the Firebase and Turso environment variables.';
  }
  return message;
}

export async function GET(request: Request) {
  if (!tursoClient) {
    return NextResponse.json({ error: 'Profile storage is unavailable. Configure the Turso database environment variables.' }, { status: 503 });
  }

  try {
    await initTursoSchema();
    const username = new URL(request.url).searchParams.get('username');

    if (username) {
      const result = await tursoClient.execute({
        sql: `SELECT id, display_name, username, avatar_url, banner_url, bio, social_links, created_at,
            followers_override, following_override
          FROM users WHERE username = ?`,
        args: [username.toLowerCase()]
      });

      if (!result.rows[0]) return NextResponse.json({ error: 'Profile not found.' }, { status: 404 });

      const viewer = await authenticate(request).catch(() => null);
      return NextResponse.json({ profile: await addFollowState(profileFromRow(result.rows[0]), viewer?.uid || null) });
    }

    const user = await authenticate(request);
    if (!user) return NextResponse.json({ error: 'Sign in to view your profile.' }, { status: 401 });

    const profile = await ensureProfile(user.uid, user.email, user.name, user.picture);
    return NextResponse.json({ profile: profile ? await addFollowState(profile, user.uid) : null });
  } catch (error) {
    console.error('Unable to load profile:', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json(
      { error: getServerConfigMessage(error) || 'Unable to load profile.' },
      { status: error instanceof Error && /not configured|Configure the/.test(error.message) ? 503 : 500 }
    );
  }
}

export async function PUT(request: Request) {
  if (!tursoClient) {
    return NextResponse.json({ error: 'Profile storage is unavailable. Configure the Turso database environment variables.' }, { status: 503 });
  }

  try {
    await initTursoSchema();
    const user = await authenticate(request);
    if (!user) return NextResponse.json({ error: 'Sign in to update your profile.' }, { status: 401 });

    const body = await request.json();
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const username = typeof body.username === 'string' ? body.username.trim().toLowerCase() : '';
    const bio = typeof body.bio === 'string' ? body.bio.trim() : '';
    const avatarUrl = normalizeProfileImage(body.avatarUrl, 'Photo');
    const bannerUrl = normalizeProfileImage(body.bannerUrl, 'Banner');
    const socialInput = body.socialLinks && typeof body.socialLinks === 'object' ? body.socialLinks : {};
    const socialLinks: SocialLinks = {
      website: normalizeUrl(socialInput.website, 'Website'),
      instagram: normalizeUrl(socialInput.instagram, 'Instagram'),
      tiktok: normalizeUrl(socialInput.tiktok, 'TikTok'),
      youtube: normalizeUrl(socialInput.youtube, 'YouTube'),
      linkedin: normalizeUrl(socialInput.linkedin, 'LinkedIn'),
      x: normalizeUrl(socialInput.x, 'X')
    };

    if (!name || name.length > 80) {
      return NextResponse.json({ error: 'Name must be between 1 and 80 characters.' }, { status: 400 });
    }
    if (!/^[a-z0-9_]{3,24}$/.test(username)) {
      return NextResponse.json({ error: 'Username must be 3-24 characters using letters, numbers, or underscores.' }, { status: 400 });
    }
    if (bio.length > 280) {
      return NextResponse.json({ error: 'Bio must be 280 characters or fewer.' }, { status: 400 });
    }

    await ensureProfile(user.uid, user.email, user.name, user.picture);

    await tursoClient.execute({
      sql: `UPDATE users SET display_name = ?, username = ?, avatar_url = ?, banner_url = ?, bio = ?, social_links = ?
        WHERE id = ?`,
      args: [name, username, avatarUrl, bannerUrl, bio, JSON.stringify(socialLinks), user.uid]
    });

    const result = await tursoClient.execute({
      sql: `SELECT id, display_name, username, avatar_url, banner_url, bio, social_links, created_at,
          followers_override, following_override
        FROM users WHERE id = ?`,
      args: [user.uid]
    });

    return NextResponse.json({ profile: await addFollowState(profileFromRow(result.rows[0]), user.uid) });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';

    if (message.includes('UNIQUE constraint failed: users.username')) {
      return NextResponse.json({ error: 'That username is already taken.' }, { status: 409 });
    }

    if (message.startsWith('UNIQUE constraint failed: users.email') || message.includes('users.email')) {
      return NextResponse.json({ error: 'This account is already registered.' }, { status: 409 });
    }

    if (message.endsWith('URL is too long.') || message.includes('must be a complete URL') || message.includes('must start with https://') || message.includes('must be a Base64') || message.includes('must be 800 KB or smaller')) {
      return NextResponse.json({ error: message }, { status: 400 });
    }

    if (message.includes('not configured') || message.includes('Configure the')) {
      return NextResponse.json({ error: getServerConfigMessage(error) }, { status: 503 });
    }

    console.error('Unable to update profile:', message || 'Unknown error');
    return NextResponse.json({ error: 'Unable to update profile.' }, { status: 500 });
  }
}
