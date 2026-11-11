'use client';

import Image from 'next/image';
import Link from 'next/link';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { ArrowLeft, ExternalLink, Pencil, Save, X } from 'lucide-react';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { getFirebaseAuth } from '@/lib/firebase-client';

type SocialLinks = {
  website?: string;
  instagram?: string;
  tiktok?: string;
  youtube?: string;
  linkedin?: string;
  x?: string;
};

type Profile = {
  id: string;
  name: string;
  username: string;
  avatarUrl: string;
  bio: string;
  socialLinks: SocialLinks;
  createdAt: string;
};

type ProfilePost = {
  id: string;
  content: string;
  createdAt: string;
  likes: number;
  comments: number;
};

const socialFields: Array<{ key: keyof SocialLinks; label: string }> = [
  { key: 'website', label: 'Website' },
  { key: 'instagram', label: 'Instagram' },
  { key: 'tiktok', label: 'TikTok' },
  { key: 'youtube', label: 'YouTube' },
  { key: 'linkedin', label: 'LinkedIn' },
  { key: 'x', label: 'X' }
];

export function ProfileScreen({ username }: { username?: string }) {
  const isOwnProfile = !username;
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [posts, setPosts] = useState<ProfilePost[]>([]);
  const [form, setForm] = useState({ name: '', username: '', avatarUrl: '', bio: '', socialLinks: {} as SocialLinks });
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [needsSignIn, setNeedsSignIn] = useState(false);

  const loadProfile = useCallback(async (user?: User) => {
    try {
      const token = user ? await user.getIdToken() : '';
      const profileUrl = username ? `/api/profile?username=${encodeURIComponent(username)}` : '/api/profile';
      const profileResponse = await fetch(profileUrl, {
        cache: 'no-store',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined
      });
      const profileData = await profileResponse.json();
      if (!profileResponse.ok) {
        if (profileResponse.status === 401) setNeedsSignIn(true);
        throw new Error(profileData.error || 'Unable to load this profile.');
      }

      const loadedProfile = profileData.profile as Profile;
      setProfile(loadedProfile);
      setForm({
        name: loadedProfile.name,
        username: loadedProfile.username,
        avatarUrl: loadedProfile.avatarUrl,
        bio: loadedProfile.bio,
        socialLinks: loadedProfile.socialLinks || {}
      });

      const postsResponse = await fetch(`/api/posts?username=${encodeURIComponent(loadedProfile.username)}`, { cache: 'no-store' });
      if (postsResponse.ok) {
        const postsData = await postsResponse.json();
        setPosts(postsData.posts);
      }
      setError('');
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load this profile.');
    } finally {
      setIsLoading(false);
    }
  }, [username]);

  useEffect(() => {
    if (!isOwnProfile) {
      void loadProfile();
      return;
    }

    const auth = getFirebaseAuth();
    if (!auth) {
      setNeedsSignIn(true);
      setIsLoading(false);
      return;
    }

    return onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user);
      if (!user) {
        setNeedsSignIn(true);
        setIsLoading(false);
        return;
      }
      setNeedsSignIn(false);
      setIsLoading(true);
      void loadProfile(user);
    });
  }, [isOwnProfile, loadProfile]);

  function updateSocialLink(key: keyof SocialLinks, value: string) {
    setForm((current) => ({
      ...current,
      socialLinks: { ...current.socialLinks, [key]: value }
    }));
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!firebaseUser) return;

    setIsSaving(true);
    setMessage('');
    setError('');
    try {
      const token = await firebaseUser.getIdToken();
      const response = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(form)
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to save profile.');

      setProfile(data.profile);
      setForm({
        name: data.profile.name,
        username: data.profile.username,
        avatarUrl: data.profile.avatarUrl,
        bio: data.profile.bio,
        socialLinks: data.profile.socialLinks || {}
      });
      setIsEditing(false);
      setMessage('Profile saved.');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save profile.');
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900"><p className="mx-auto max-w-3xl text-sm text-slate-500">Loading profile...</p></main>;
  }

  if (needsSignIn && isOwnProfile) {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900">
        <section className="mx-auto max-w-xl rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-soft">
          <h1 className="text-xl font-bold">Sign in to view your profile</h1>
          <p className="mt-2 text-sm text-slate-500">Your Google account profile will appear here after you sign in.</p>
          <Link href="/auth" className="mt-5 inline-flex rounded-full bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white">Go to login</Link>
        </section>
      </main>
    );
  }

  if (!profile) {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900">
        <section className="mx-auto max-w-xl rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-soft">
          <h1 className="text-xl font-bold">Profile unavailable</h1>
          <p className="mt-2 text-sm text-slate-500">{error || 'This profile could not be found.'}</p>
          <Link href="/feed" className="mt-5 inline-flex rounded-full bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white">Back to feed</Link>
        </section>
      </main>
    );
  }

  const joined = profile.createdAt ? new Date(profile.createdAt).toLocaleDateString(undefined, { month: 'long', year: 'numeric' }) : '';
  const displaySocialLinks = socialFields.filter(({ key }) => profile.socialLinks?.[key]);

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl">
        <Link href="/feed" className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900">
          <ArrowLeft className="h-4 w-4" /> Back to feed
        </Link>

        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-soft">
          <div className="h-32 bg-gradient-to-r from-pink-500 via-violet-500 to-indigo-500" />
          <div className="px-6 pb-6">
            <div className="-mt-12 flex items-end justify-between gap-4">
              {profile.avatarUrl ? (
                <Image src={profile.avatarUrl} alt={`${profile.name}'s profile photo`} width={96} height={96} unoptimized className="h-24 w-24 rounded-full border-4 border-white bg-white object-cover" />
              ) : (
                <div className="flex h-24 w-24 items-center justify-center rounded-full border-4 border-white bg-gradient-to-br from-pink-500 to-violet-500 text-2xl font-bold text-white">
                  {profile.name.slice(0, 1).toUpperCase()}
                </div>
              )}
              {isOwnProfile ? (
                <button type="button" onClick={() => { setIsEditing((current) => !current); setMessage(''); setError(''); }} className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white">
                  {isEditing ? <X className="h-4 w-4" /> : <Pencil className="h-4 w-4" />}
                  {isEditing ? 'Cancel' : 'Edit profile'}
                </button>
              ) : null}
            </div>

            {!isEditing ? (
              <>
                <div className="mt-4">
                  <h1 className="text-3xl font-bold">{profile.name}</h1>
                  <p className="mt-1 text-slate-500">@{profile.username}</p>
                </div>
                <p className="mt-4 max-w-2xl whitespace-pre-wrap text-slate-700">{profile.bio || 'No bio added yet.'}</p>
                {joined ? <p className="mt-4 text-sm text-slate-500">Joined {joined}</p> : null}
                {displaySocialLinks.length > 0 ? (
                  <div className="mt-4 flex flex-wrap gap-3">
                    {displaySocialLinks.map(({ key, label }) => (
                      <a key={key} href={profile.socialLinks[key]} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-sm font-medium text-violet-700 hover:text-violet-900">
                        {label}<ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    ))}
                  </div>
                ) : null}
              </>
            ) : (
              <form onSubmit={handleSave} className="mt-5 space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="text-sm font-medium text-slate-700">Display name
                    <input required maxLength={80} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-violet-400" />
                  </label>
                  <label className="text-sm font-medium text-slate-700">@Username
                    <input required minLength={3} maxLength={24} pattern="[a-zA-Z0-9_]+" value={form.username} onChange={(event) => setForm({ ...form, username: event.target.value.toLowerCase() })} className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-violet-400" />
                  </label>
                </div>
                <label className="block text-sm font-medium text-slate-700">Profile photo URL
                  <input type="url" value={form.avatarUrl} onChange={(event) => setForm({ ...form, avatarUrl: event.target.value })} placeholder="https://..." className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-violet-400" />
                </label>
                <label className="block text-sm font-medium text-slate-700">Bio
                  <textarea maxLength={280} rows={3} value={form.bio} onChange={(event) => setForm({ ...form, bio: event.target.value })} placeholder="A little about you" className="mt-1.5 w-full resize-y rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-violet-400" />
                  <span className="mt-1 block text-right text-xs font-normal text-slate-400">{form.bio.length}/280</span>
                </label>
                <div>
                  <p className="mb-2 text-sm font-semibold text-slate-700">Social links</p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {socialFields.map(({ key, label }) => (
                      <label key={key} className="text-xs font-medium text-slate-500">{label}
                        <input type="url" value={form.socialLinks[key] || ''} onChange={(event) => updateSocialLink(key, event.target.value)} placeholder="https://..." className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-normal text-slate-800 outline-none focus:border-violet-400" />
                      </label>
                    ))}
                  </div>
                </div>
                <div className="flex items-center justify-end gap-3">
                  <button type="button" onClick={() => setIsEditing(false)} className="rounded-full px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100">Cancel</button>
                  <button type="submit" disabled={isSaving} className="inline-flex items-center gap-2 rounded-full bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-violet-500 disabled:opacity-60">
                    <Save className="h-4 w-4" />{isSaving ? 'Saving...' : 'Save profile'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </section>

        {error ? <p role="alert" className="mt-4 text-sm text-rose-600">{error}</p> : null}
        {message ? <p role="status" className="mt-4 text-sm text-emerald-700">{message}</p> : null}

        <section className="mt-8 rounded-3xl border border-slate-200 bg-white p-6 shadow-soft">
          <h2 className="mb-5 text-xl font-bold">Recent rants</h2>
          {posts.length ? (
            <div className="space-y-4">
              {posts.map((post) => (
                <article key={post.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-sm text-slate-500">{new Date(post.createdAt).toLocaleString()}</p>
                  <p className="mt-3 whitespace-pre-line text-slate-700">{post.content}</p>
                  <div className="mt-3 flex gap-6 text-sm text-slate-500"><span>❤️ {post.likes}</span><span>💬 {post.comments}</span></div>
                </article>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-500">No rants posted yet.</p>
          )}
        </section>
      </div>
    </main>
  );
}
