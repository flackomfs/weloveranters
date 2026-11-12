'use client';

import Image from 'next/image';
import Link from 'next/link';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { ArrowLeft, Ban, ExternalLink, Pencil, Save, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { getFirebaseAuth } from '@/lib/firebase-client';
import { Sidebar } from '@/components/Sidebar';
import { PostCard, type FeedPost } from '@/components/PostCard';

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
  bannerUrl: string;
  bio: string;
  socialLinks: SocialLinks;
  createdAt: string;
  followers: number;
  following: number;
  isFollowing: boolean;
  followersOverride: number | null;
  followingOverride: number | null;
  canManageStats: boolean;
  verificationBadge: 'boy' | 'girl' | 'moderator' | null;
  viewerBlocked: boolean;
  blockedViewer: boolean;
};

const socialFields: Array<{ key: keyof SocialLinks; label: string }> = [
  { key: 'website', label: 'Website' },
  { key: 'instagram', label: 'Instagram' },
  { key: 'tiktok', label: 'TikTok' },
  { key: 'youtube', label: 'YouTube' },
  { key: 'linkedin', label: 'LinkedIn' },
  { key: 'x', label: 'X' }
];

async function compressPhoto(file: File, field: 'avatarUrl' | 'bannerUrl') {
  if (!file.type.startsWith('image/')) throw new Error('Choose an image file.');
  const image = await createImageBitmap(file);
  try {
    const maxDimension = field === 'bannerUrl' ? 1920 : 1024;
    const initialScale = Math.min(1, maxDimension / Math.max(image.width, image.height));
    const qualities = [0.92, 0.88, 0.84, 0.8];

    for (let scale = initialScale; scale >= initialScale * 0.5; scale *= 0.9) {
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(image.width * scale));
      canvas.height = Math.max(1, Math.round(image.height * scale));
      const context = canvas.getContext('2d');
      if (!context) throw new Error('This browser cannot process the image.');
      context.drawImage(image, 0, 0, canvas.width, canvas.height);

      for (const quality of qualities) {
        const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', quality));
        if (!blob) throw new Error('Unable to prepare the image.');
        if (blob.size <= 800_000) {
          return await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('Unable to read the image.'));
            reader.onerror = () => reject(new Error('Unable to read the image.'));
            reader.readAsDataURL(blob);
          });
        }
      }
    }

    throw new Error('This image is too large to optimize. Choose another image.');
  } finally {
    image.close();
  }
}

export function ProfileScreen({ username }: { username?: string }) {
  const isOwnProfile = !username;
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [form, setForm] = useState({ name: '', username: '', avatarUrl: '', bannerUrl: '', bio: '', socialLinks: {} as SocialLinks });
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isFollowingSaving, setIsFollowingSaving] = useState(false);
  const [isBlockingSaving, setIsBlockingSaving] = useState(false);
  const [isEditingStats, setIsEditingStats] = useState(false);
  const [isSavingStats, setIsSavingStats] = useState(false);
  const [statsForm, setStatsForm] = useState({ followers: '', following: '' });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [profileFieldErrors, setProfileFieldErrors] = useState({ name: '', username: '' });
  const [needsSignIn, setNeedsSignIn] = useState(false);
  const isEditingRef = useRef(false);

  const loadProfile = useCallback(async (user?: User) => {
    try {
      const activeUser = user || getFirebaseAuth()?.currentUser || undefined;
      const token = activeUser ? await activeUser.getIdToken() : '';
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
      if (!isEditingRef.current) {
        setForm({
          name: loadedProfile.name,
          username: loadedProfile.username,
          avatarUrl: loadedProfile.avatarUrl,
          bannerUrl: loadedProfile.bannerUrl || '',
          bio: loadedProfile.bio,
          socialLinks: loadedProfile.socialLinks || {}
        });
      }

      const postsResponse = await fetch(`/api/posts?username=${encodeURIComponent(loadedProfile.username)}`, {
        cache: 'no-store',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined
      });
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
    const auth = getFirebaseAuth();
    if (!auth) {
      if (isOwnProfile) setNeedsSignIn(true);
      setIsLoading(false);
      if (!isOwnProfile) void loadProfile();
      return;
    }

    return onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user);
      if (!user && isOwnProfile) {
        setNeedsSignIn(true);
        setIsLoading(false);
        return;
      }
      setNeedsSignIn(false);
      setIsLoading(true);
      void loadProfile(user || undefined);
    });
  }, [isOwnProfile, loadProfile]);

  useEffect(() => {
    isEditingRef.current = isEditing;
  }, [isEditing]);

  const hasProfile = Boolean(profile);

  useEffect(() => {
    if (!hasProfile) return;
    const intervalId = window.setInterval(() => {
      if (!isEditingRef.current) void loadProfile(isOwnProfile ? firebaseUser || undefined : undefined);
    }, 3000);
    return () => window.clearInterval(intervalId);
  }, [firebaseUser, hasProfile, isOwnProfile, loadProfile]);

  function updateSocialLink(key: keyof SocialLinks, value: string) {
    setForm((current) => ({
      ...current,
      socialLinks: { ...current.socialLinks, [key]: value }
    }));
  }

  async function handlePhotoChange(event: ChangeEvent<HTMLInputElement>, field: 'avatarUrl' | 'bannerUrl') {
    const file = event.target.files?.[0];
    if (!file) return;
    setError('');
    try {
      const nextUrl = await compressPhoto(file, field);
      setForm((current) => ({ ...current, [field]: nextUrl }));
    } catch (photoError) {
      setError(photoError instanceof Error ? photoError.message : 'Unable to prepare the photo.');
    }
    event.target.value = '';
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!firebaseUser) return;

    setIsSaving(true);
    setMessage('');
    setError('');
    setProfileFieldErrors({ name: '', username: '' });
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
        bannerUrl: data.profile.bannerUrl || '',
        bio: data.profile.bio,
        socialLinks: data.profile.socialLinks || {}
      });
      setIsEditing(false);
      setMessage('Profile saved.');
    } catch (saveError) {
      const errorMessage = saveError instanceof Error ? saveError.message : 'Unable to save profile.';
      if (/username.*already taken/i.test(errorMessage)) {
        setProfileFieldErrors((current) => ({ ...current, username: 'Username already taken.' }));
      } else if (/display name.*already taken/i.test(errorMessage)) {
        setProfileFieldErrors((current) => ({ ...current, name: 'Display name already taken.' }));
      } else {
        setError(errorMessage);
      }
    } finally {
      setIsSaving(false);
    }
  }

  async function handleFollow() {
    if (!firebaseUser || !profile) return;
    setIsFollowingSaving(true);
    setError('');
    try {
      const token = await firebaseUser.getIdToken();
      const response = await fetch('/api/follow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ targetId: profile.id })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to update follow.');
      setProfile((current) => current ? {
        ...current,
        isFollowing: data.following,
        followers: current.followers + (data.following ? 1 : -1)
      } : current);
    } catch (followError) {
      setError(followError instanceof Error ? followError.message : 'Unable to update follow.');
    } finally {
      setIsFollowingSaving(false);
    }
  }

  async function handleBlock() {
    if (!firebaseUser || !profile || profile.blockedViewer) return;
    const shouldUnblock = profile.viewerBlocked;
    if (!shouldUnblock && !window.confirm(`Block @${profile.username}? You will no longer see each other's posts or be able to follow/interact.`)) return;
    setIsBlockingSaving(true);
    setError('');
    try {
      const token = await firebaseUser.getIdToken();
      const response = await fetch('/api/blocks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ targetId: profile.id })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || `Unable to ${shouldUnblock ? 'unblock' : 'block'} user.`);
      await loadProfile(firebaseUser);
    } catch (blockError) {
      setError(blockError instanceof Error ? blockError.message : `Unable to ${shouldUnblock ? 'unblock' : 'block'} user.`);
    } finally {
      setIsBlockingSaving(false);
    }
  }

  async function handleSaveStats(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!firebaseUser || !profile?.canManageStats) return;

    setIsSavingStats(true);
    setError('');
    setMessage('');
    try {
      const token = await firebaseUser.getIdToken();
      const response = await fetch('/api/admin/profile-stats', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          targetId: profile.id,
          followers: statsForm.followers === '' ? null : Number(statsForm.followers),
          following: statsForm.following === '' ? null : Number(statsForm.following)
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to save profile counts.');
      setIsEditingStats(false);
      setMessage('Profile counts saved.');
      await loadProfile(firebaseUser);
    } catch (statsError) {
      setError(statsError instanceof Error ? statsError.message : 'Unable to save profile counts.');
    } finally {
      setIsSavingStats(false);
    }
  }

  if (isLoading) {
    return <main className="min-h-screen bg-transparent px-4 py-8 text-slate-100"><p className="mx-auto max-w-3xl text-sm text-slate-300">Loading profile...</p></main>;
  }

  if (needsSignIn && isOwnProfile) {
    return (
      <main className="min-h-screen bg-transparent px-4 py-8 text-slate-900">
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
      <main className="min-h-screen bg-transparent px-4 py-8 text-slate-900">
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
  const isProfileOwner = Boolean(firebaseUser && profile.id === firebaseUser.uid);

  return (
    <div className="min-h-screen bg-transparent pb-24 text-slate-900 xl:pb-0">
      <div className="mx-auto flex max-w-7xl gap-6 px-3 py-3 sm:px-6 sm:py-6 lg:px-8">
        <Sidebar />
        <main className="min-w-0 flex-1 px-1 sm:px-0">
          <div className="mx-auto max-w-4xl">
            <Link href="/feed" className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-slate-300 hover:text-white">
              <ArrowLeft className="h-4 w-4" /> Back to feed
            </Link>

            <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-soft">
              <div className="relative z-0 h-32 overflow-hidden bg-gradient-to-r from-pink-500 via-violet-500 to-indigo-500">
                {(isEditing ? form.bannerUrl : profile.bannerUrl) ? (
                  <Image
                    src={isEditing ? form.bannerUrl : profile.bannerUrl}
                    alt="Profile banner"
                    fill
                    unoptimized
                    className="object-cover"
                  />
                ) : null}
                <div className="absolute inset-0 bg-gradient-to-t from-black/10 to-transparent" />
              </div>

              <div className="relative z-10 px-6 pb-6">
                <div className="-mt-12 flex items-end justify-between gap-4">
                  {(isEditing ? form.avatarUrl : profile.avatarUrl) ? (
                    <Image src={isEditing ? form.avatarUrl : profile.avatarUrl} alt={`${profile.name}'s profile photo`} width={96} height={96} unoptimized className="h-24 w-24 rounded-full border-4 border-white object-cover shadow-lg" />
                  ) : (
                    <div className="flex h-24 w-24 items-center justify-center rounded-full border-4 border-white bg-gradient-to-br from-pink-500 to-violet-500 text-2xl font-bold text-white shadow-lg">
                      {profile.name.slice(0, 1).toUpperCase()}
                    </div>
                  )}
                  {isOwnProfile ? (
                    <button type="button" onClick={() => { setIsEditing((current) => !current); setMessage(''); setError(''); setProfileFieldErrors({ name: '', username: '' }); }} className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800">
                      {isEditing ? <X className="h-4 w-4" /> : <Pencil className="h-4 w-4" />}
                      {isEditing ? 'Cancel' : 'Edit profile'}
                    </button>
                  ) : isProfileOwner ? null : firebaseUser && !profile.viewerBlocked && !profile.blockedViewer ? (
                    <button type="button" onClick={handleFollow} disabled={isFollowingSaving} className="rounded-full bg-slate-900 px-5 py-2 text-sm font-semibold text-white disabled:opacity-60">
                      {isFollowingSaving ? 'Updating...' : profile.isFollowing ? 'Following' : 'Follow'}
                    </button>
                  ) : firebaseUser ? (
                    <span className="text-xs text-slate-500">{profile.blockedViewer ? 'This user has blocked you.' : 'You blocked this user.'}</span>
                  ) : (
                    <Link href="/auth" className="rounded-full bg-slate-900 px-5 py-2 text-sm font-semibold text-white">Log in to follow</Link>
                  )}
                  {!isOwnProfile && firebaseUser && !isProfileOwner && !profile.blockedViewer ? (
                    <button
                      type="button"
                      onClick={() => void handleBlock()}
                      disabled={isBlockingSaving}
                      aria-label={profile.viewerBlocked ? `Unblock ${profile.name}` : `Block ${profile.name}`}
                      className="inline-flex items-center gap-1.5 rounded-full border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-700 disabled:opacity-50"
                    >
                      <Ban className="h-4 w-4" />
                      {isBlockingSaving ? 'Updating...' : profile.viewerBlocked ? 'Unblock' : 'Block'}
                    </button>
                  ) : null}
                </div>

                {!isEditing ? (
                  <>
                    <div className="mt-4">
                      <div className="flex items-center gap-2">
                        <h1 className="text-3xl font-bold">{profile.name}</h1>
                        {profile.verificationBadge ? (
                          <Image
                            src={profile.verificationBadge === 'moderator'
                              ? '/badges/moderator.gif'
                              : profile.verificationBadge === 'boy' ? '/badges/boys-verified.gif' : '/badges/girls-verified.gif'}
                            alt={`${profile.verificationBadge} verified badge`}
                            width={28}
                            height={28}
                            unoptimized
                            className="h-7 w-7 object-contain"
                          />
                        ) : null}
                      </div>
                      <p className="mt-1 text-slate-500">@{profile.username}</p>
                    </div>
                    <p className="mt-4 max-w-2xl whitespace-pre-wrap text-slate-700">{profile.bio || 'No bio added yet.'}</p>
                    {joined ? <p className="mt-4 text-sm text-slate-500">Joined {joined}</p> : null}
                    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-slate-600">
                      <span><strong>{profile.following.toLocaleString()}</strong> Following</span>
                      <span><strong>{profile.followers.toLocaleString()}</strong> Followers</span>
                      {profile.canManageStats ? (
                        <button type="button" onClick={() => {
                          setStatsForm({
                            followers: profile.followersOverride === null ? '' : String(profile.followersOverride),
                            following: profile.followingOverride === null ? '' : String(profile.followingOverride)
                          });
                          setIsEditingStats((current) => !current);
                          setError('');
                        }} className="rounded-full border border-violet-200 px-3 py-1 text-xs font-semibold text-violet-700 hover:bg-violet-50">
                          {isEditingStats ? 'Cancel count edit' : 'Admin: edit counts'}
                        </button>
                      ) : null}
                    </div>
                    {profile.canManageStats && isEditingStats ? (
                      <form onSubmit={handleSaveStats} className="mt-4 grid gap-3 rounded-xl border border-violet-200 bg-violet-50/60 p-4 sm:grid-cols-2">
                        <label className="text-xs font-semibold text-slate-600">Followers
                          <input type="number" min="0" max="1000000000" step="1" value={statsForm.followers} onChange={(event) => setStatsForm((current) => ({ ...current, followers: event.target.value }))} className="mt-1 w-full rounded-lg border border-violet-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-0" />
                        </label>
                        <label className="text-xs font-semibold text-slate-600">Following
                          <input type="number" min="0" max="1000000000" step="1" value={statsForm.following} onChange={(event) => setStatsForm((current) => ({ ...current, following: event.target.value }))} className="mt-1 w-full rounded-lg border border-violet-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-0" />
                        </label>
                        <p className="text-xs text-slate-500 sm:col-span-2">Leave blank to use the real follow totals.</p>
                        <div className="flex justify-end sm:col-span-2">
                          <button type="submit" disabled={isSavingStats} className="rounded-full bg-violet-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">{isSavingStats ? 'Saving...' : 'Save count'}</button>
                        </div>
                      </form>
                    ) : null}
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
                        <input required maxLength={80} value={form.name} aria-invalid={Boolean(profileFieldErrors.name)} aria-describedby={profileFieldErrors.name ? 'display-name-error' : undefined} onChange={(event) => { setForm({ ...form, name: event.target.value.normalize('NFKC') }); setProfileFieldErrors((current) => ({ ...current, name: '' })); }} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-violet-300" />
                        {profileFieldErrors.name ? <span id="display-name-error" role="alert" className="mt-1 block text-xs font-normal text-rose-600">{profileFieldErrors.name}</span> : null}
                      </label>
                      <label className="text-sm font-medium text-slate-700">@Username
                        <input required minLength={3} maxLength={32} pattern="[a-zA-Z0-9._-]+" value={form.username} aria-invalid={Boolean(profileFieldErrors.username)} aria-describedby={profileFieldErrors.username ? 'username-error' : undefined} onChange={(event) => { setForm({ ...form, username: event.target.value.normalize('NFKC').toLowerCase() }); setProfileFieldErrors((current) => ({ ...current, username: '' })); }} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-violet-300" />
                        {profileFieldErrors.username ? <span id="username-error" role="alert" className="mt-1 block text-xs font-normal text-rose-600">{profileFieldErrors.username}</span> : null}
                      </label>
                    </div>

                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center gap-3">
                        <label className="cursor-pointer rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                          Change photo
                          <input type="file" accept="image/*" onChange={(event) => handlePhotoChange(event, 'avatarUrl')} className="sr-only" />
                        </label>
                        {form.avatarUrl ? <button type="button" onClick={() => setForm({ ...form, avatarUrl: '' })} className="px-3 py-2 text-sm font-semibold text-slate-500 hover:text-rose-600">Remove photo</button> : null}
                      </div>

                      <div className="flex flex-wrap items-center gap-3">
                        <label className="cursor-pointer rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                          Change banner
                          <input type="file" accept="image/*" onChange={(event) => handlePhotoChange(event, 'bannerUrl')} className="sr-only" />
                        </label>
                        {form.bannerUrl ? <button type="button" onClick={() => setForm({ ...form, bannerUrl: '' })} className="px-3 py-2 text-sm font-semibold text-slate-500 hover:text-rose-600">Remove banner</button> : null}
                      </div>

                      <span className="block text-xs text-slate-400">Optimized for sharp display (up to 1920px and 800 KB).</span>
                    </div>

                    <label className="block text-sm font-medium text-slate-700">Bio
                      <textarea maxLength={280} rows={3} value={form.bio} onChange={(event) => setForm({ ...form, bio: event.target.value })} placeholder="A little about you" className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-violet-300" />
                      <span className="mt-1 block text-right text-xs font-normal text-slate-400">{form.bio.length}/280</span>
                    </label>

                    <div>
                      <p className="mb-2 text-sm font-semibold text-slate-700">Social links</p>
                      <div className="grid gap-3 sm:grid-cols-2">
                        {socialFields.map(({ key, label }) => (
                          <label key={key} className="text-xs font-medium text-slate-500">{label}
                            <input type="url" value={form.socialLinks[key] || ''} onChange={(event) => updateSocialLink(key, event.target.value)} placeholder="https://..." className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none focus:border-violet-300" />
                          </label>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-3">
                      <button type="button" onClick={() => { setIsEditing(false); setProfileFieldErrors({ name: '', username: '' }); }} className="rounded-full px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100">Cancel</button>
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
              {profile.viewerBlocked || profile.blockedViewer ? (
                <p className="text-sm text-slate-500">Posts are hidden because one account has blocked the other.</p>
              ) : posts.length ? (
                <div className="space-y-4">
                  {posts.map((post) => (
                    <PostCard
                      key={post.entryId}
                      post={post}
                      onChanged={() => void loadProfile(firebaseUser || undefined)}
                    />
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-500">No rants posted yet.</p>
              )}
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}
