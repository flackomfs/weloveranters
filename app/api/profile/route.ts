import { NextResponse } from 'next/server';
import { verifyIdToken } from '@/lib/firebase';
import { initTursoSchema, tursoClient } from '@/lib/turso';

type SocialLinks = {
  website?: string;
  instagram?: string;
  tiktok?: string;
  youtube?: string;
  linkedin?: string;
  x?: string;
};

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
    bio: String(row.bio || ''),
    socialLinks: parseSocialLinks(row.social_links),
    createdAt: String(row.created_at || '')
  };
}

function getBearerToken(request: Request) {
  const authorization = request.headers.get('authorization') || '';
  return authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
}

async function ensureProfile(uid: string, email?: string, displayName?: string, avatarUrl?: string) {
  if (!tursoClient) throw new Error('Database is not configured.');

  const existing = await tursoClient.execute({
    sql: 'SELECT id, username, display_name, avatar_url FROM users WHERE id = ?',
    args: [uid]
  });
  const current = existing.rows[0];
  const emailName = email?.split('@')[0] || 'user';
  const usernameBase = emailName.toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 20) || 'user';
  const defaultUsername = `${usernameBase}_${uid.slice(0, 6).toLowerCase()}`;

  if (current) {
    if (!current.username || !current.display_name || (!current.avatar_url && avatarUrl)) {
      await tursoClient.execute({
        sql: `UPDATE users SET
          username = COALESCE(username, ?),
          display_name = COALESCE(display_name, ?),
          avatar_url = COALESCE(avatar_url, ?),
          email = COALESCE(email, ?)
          WHERE id = ?`,
        args: [defaultUsername, displayName || emailName, avatarUrl || '', email || '', uid]
      });
    }
  } else {
    await tursoClient.execute({
      sql: `INSERT INTO users (id, email, display_name, username, avatar_url, social_links)
        VALUES (?, ?, ?, ?, ?, '{}')`,
      args: [uid, email || '', displayName || emailName, defaultUsername, avatarUrl || '']
    });
  }

  const profile = await tursoClient.execute({
    sql: `SELECT id, display_name, username, avatar_url, bio, social_links, created_at
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

async function authenticate(request: Request) {
  const token = getBearerToken(request);
  if (!token) return null;
  return verifyIdToken(token);
}

export async function GET(request: Request) {
  if (!tursoClient) {
    return NextResponse.json({ error: 'Profile storage is unavailable.' }, { status: 503 });
  }

  try {
    await initTursoSchema();
    const username = new URL(request.url).searchParams.get('username');

    if (username) {
      const result = await tursoClient.execute({
        sql: `SELECT id, display_name, username, avatar_url, bio, social_links, created_at
          FROM users WHERE username = ?`,
        args: [username.toLowerCase()]
      });
      if (!result.rows[0]) return NextResponse.json({ error: 'Profile not found.' }, { status: 404 });
      return NextResponse.json({ profile: profileFromRow(result.rows[0]) });
    }

    const user = await authenticate(request);
    if (!user) return NextResponse.json({ error: 'Sign in to view your profile.' }, { status: 401 });

    const profile = await ensureProfile(user.uid, user.email, user.name, user.picture);
    return NextResponse.json({ profile });
  } catch (error) {
    console.error('Unable to load profile:', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json({ error: 'Unable to load profile.' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  if (!tursoClient) {
    return NextResponse.json({ error: 'Profile storage is unavailable.' }, { status: 503 });
  }

  try {
    await initTursoSchema();
    const user = await authenticate(request);
    if (!user) return NextResponse.json({ error: 'Sign in to update your profile.' }, { status: 401 });

    const body = await request.json();
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const username = typeof body.username === 'string' ? body.username.trim().toLowerCase() : '';
    const bio = typeof body.bio === 'string' ? body.bio.trim() : '';
    const avatarUrl = normalizeUrl(body.avatarUrl, 'Photo');
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
      sql: `UPDATE users SET display_name = ?, username = ?, avatar_url = ?, bio = ?, social_links = ?
        WHERE id = ?`,
      args: [name, username, avatarUrl, bio, JSON.stringify(socialLinks), user.uid]
    });

    const result = await tursoClient.execute({
      sql: `SELECT id, display_name, username, avatar_url, bio, social_links, created_at
        FROM users WHERE id = ?`,
      args: [user.uid]
    });
    return NextResponse.json({ profile: profileFromRow(result.rows[0]) });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message.includes('UNIQUE constraint failed: users.username')) {
      return NextResponse.json({ error: 'That username is already taken.' }, { status: 409 });
    }
    if (message.endsWith('URL is too long.') || message.includes('must be a complete URL') || message.includes('must start with https://')) {
      return NextResponse.json({ error: message }, { status: 400 });
    }
    console.error('Unable to update profile:', message || 'Unknown error');
    return NextResponse.json({ error: 'Unable to update profile.' }, { status: 500 });
  }
}