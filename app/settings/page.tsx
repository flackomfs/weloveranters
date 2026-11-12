'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { signOut } from 'firebase/auth';
import { Check, LogOut, Palette, Sparkles, UserRound } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Sidebar } from '@/components/Sidebar';
import { useTheme } from '@/components/ThemeProvider';
import { getFirebaseAuth } from '@/lib/firebase-client';
import { THEME_PALETTES } from '@/lib/themes';

type AccountProfile = {
  name: string;
  username: string;
  avatarUrl: string;
};

export default function SettingsPage() {
  const router = useRouter();
  const { theme, chooseTheme } = useTheme();
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<AccountProfile | null>(null);
  const [isThemeSaving, setIsThemeSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const auth = getFirebaseAuth();
    if (!auth) return;

    return onAuthStateChanged(auth, async (nextUser) => {
      setUser(nextUser);
      if (!nextUser) {
        setProfile(null);
        return;
      }

      try {
        const token = await nextUser.getIdToken();
        const response = await fetch('/api/profile', { cache: 'no-store', headers: { Authorization: `Bearer ${token}` } });
        if (!response.ok) return;
        const data = await response.json();
        setProfile(data.profile);
      } catch {
        setProfile(null);
      }
    });
  }, []);

  async function handleRandomTheme() {
    const nextTheme = THEME_PALETTES[Math.floor(Math.random() * THEME_PALETTES.length)];
    setIsThemeSaving(true);
    setMessage('');
    const saved = await chooseTheme(nextTheme);
    setMessage(saved
      ? user ? `Theme updated to ${nextTheme.name}.` : 'Random theme applied on this device. Sign in to sync it with your account.'
      : 'Theme applied locally, but account sync failed. Try again later.');
    setIsThemeSaving(false);
  }

  async function handleLogout() {
    const auth = getFirebaseAuth();
    if (auth) await signOut(auth);
    router.replace('/auth');
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-transparent pb-24 text-slate-100 xl:pb-0">
      <div className="mx-auto flex max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <Sidebar />
        <main className="min-w-0 flex-1">
          <div className="mx-auto max-w-3xl space-y-6">
            <header>
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-violet-300">Account</p>
              <h1 className="mt-2 text-3xl font-black text-white">Settings</h1>
            </header>

            <section className="rounded-2xl border border-violet-400/20 bg-slate-900/80 p-5 shadow-[0_0_30px_rgba(168,85,247,0.08)] sm:p-6">
              <div className="mb-5 flex items-center gap-3">
                <UserRound className="h-5 w-5 text-violet-300" />
                <h2 className="text-lg font-bold text-white">Account details</h2>
              </div>
              {user ? (
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex min-w-0 items-center gap-3">
                    {profile?.avatarUrl || user.photoURL ? (
                      <Image src={profile?.avatarUrl || user.photoURL || ''} alt="" width={48} height={48} unoptimized className="h-12 w-12 rounded-full object-cover" />
                    ) : (
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-violet-500/20 font-bold text-violet-100">{(user.displayName || user.email || 'U').slice(0, 1).toUpperCase()}</div>
                    )}
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-white">{profile?.name || user.displayName || 'Your account'}</p>
                      <p className="truncate text-sm text-slate-400">{user.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Link href="/profile" className="rounded-full border border-white/10 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-violet-400/40 hover:bg-violet-500/10">View profile</Link>
                    <button type="button" onClick={handleLogout} className="inline-flex items-center gap-2 rounded-full border border-rose-400/25 px-4 py-2 text-sm font-semibold text-rose-200 transition hover:bg-rose-500/10">
                      <LogOut className="h-4 w-4" /> Logout
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm text-slate-400">Sign in to manage your account profile and sync settings.</p>
                  <Link href="/auth" className="rounded-full bg-violet-600 px-4 py-2 text-sm font-semibold text-white">Log in</Link>
                </div>
              )}
            </section>

            <section className="rounded-2xl border border-violet-400/20 bg-slate-900/80 p-5 shadow-[0_0_30px_rgba(168,85,247,0.08)] sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <Palette className="h-5 w-5 text-violet-300" />
                  <div>
                    <h2 className="text-lg font-bold text-white">Theme</h2>
                    <p className="mt-1 text-sm text-slate-400">{theme.name} · 3-color combination</p>
                  </div>
                </div>
                <button type="button" onClick={handleRandomTheme} disabled={isThemeSaving} className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-violet-500 to-pink-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
                  <Sparkles className="h-4 w-4" /> Random
                </button>
              </div>

              <div className="mt-5 rounded-2xl border border-violet-400/20 bg-slate-950/50 p-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-24 overflow-hidden rounded-full border border-white/10">
                      {theme.colors.map((color) => <span key={color} className="flex-1" style={{ backgroundColor: color }} />)}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white">Current theme</p>
                      <p className="text-xs text-slate-400">{theme.name}</p>
                    </div>
                  </div>
                  <div className="rounded-full border border-violet-400/20 bg-violet-500/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-violet-200">
                    100+ choices
                  </div>
                </div>
                <p className="mt-3 text-sm text-slate-300">Tap Random to generate a new color palette combination.</p>
              </div>

              {message ? <p role="status" className="mt-4 text-sm text-slate-300">{message}</p> : null}
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}
