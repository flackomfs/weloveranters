'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { onAuthStateChanged, type User as FirebaseUser } from 'firebase/auth';
import { Bell, Compass, Home, LogIn, Settings, UserRound } from 'lucide-react';
import { useEffect, useState } from 'react';
import logo from '@/src/images/logo.png';
import { getFirebaseAuth } from '@/lib/firebase-client';

const navItems = [
  { label: 'Home', href: '/feed', icon: Home },
  { label: 'Explore', href: '/feed?view=explore', icon: Compass },
  { label: 'Notifications', href: '/notifications', icon: Bell },
  { label: 'Profile', href: '/profile', icon: UserRound },
  { label: 'Settings', href: '/settings', icon: Settings }
];

export function Sidebar() {
  const pathname = usePathname();
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<{ name: string; avatarUrl: string; username: string } | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    const auth = getFirebaseAuth();
    if (!auth) return;
    return onAuthStateChanged(auth, setUser);
  }, []);

  useEffect(() => {
    if (!user) {
      setProfile(null);
      setUnreadCount(0);
      return;
    }

    const activeUser = user;
    let isMounted = true;
    async function refreshAccountData() {
      try {
        const token = await activeUser.getIdToken();
        const headers = { Authorization: `Bearer ${token}` };
        const [profileResponse, notificationsResponse] = await Promise.all([
          fetch('/api/profile', { cache: 'no-store', headers }),
          fetch('/api/notifications', { cache: 'no-store', headers })
        ]);
        if (profileResponse.ok) {
          const data = await profileResponse.json();
          if (isMounted) setProfile(data.profile);
        }
        if (notificationsResponse.ok) {
          const data = await notificationsResponse.json();
          if (isMounted) setUnreadCount(data.notifications.filter((item: { readAt: string | null }) => !item.readAt).length);
        }
      } catch {
        return;
      }
    }

    void refreshAccountData();
    const intervalId = window.setInterval(() => void refreshAccountData(), 3000);
    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
    };
  }, [user]);

  return (
    <>
      <aside className="hidden w-64 shrink-0 xl:block">
        <div className="rounded-[28px] border border-violet-400/20 bg-slate-900/80 p-5 shadow-[0_0_30px_rgba(168,85,247,0.10)] backdrop-blur-xl">
          <div className="mb-8 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full border border-violet-400/30 bg-slate-950 p-1.5">
              {profile?.avatarUrl || user?.photoURL ? (
                <Image src={profile?.avatarUrl || user?.photoURL || ''} alt="" width={44} height={44} unoptimized className="h-full w-full rounded-full object-cover" />
              ) : (
                <Image src={logo} alt="WeLoveRanters logo" width={44} height={44} className="h-full w-full rounded-full object-cover" />
              )}
            </div>
            <div>
              <p className="text-xl font-black tracking-tight text-white">WeLoveRanters</p>
              <p className="max-w-40 truncate text-sm text-slate-400">{profile?.name || user?.displayName || user?.email || 'Your daily release'}</p>
            </div>
          </div>

          <nav className="space-y-2">
            {navItems.map(({ label, href, icon: Icon }) => (
              <Link
                key={label}
                href={href}
                className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition ${
                  (label === 'Home' && pathname === '/feed') || (label === 'Profile' && pathname.startsWith('/profile')) || (label === 'Settings' && pathname === '/settings') || (label === 'Explore' && pathname === '/feed')
                    ? 'bg-violet-500/10 text-violet-200 ring-1 ring-violet-400/20'
                    : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                }`}
              >
                <Icon className="h-4 w-4" />
                {label}
                {label === 'Notifications' && unreadCount > 0 ? (
                  <span className="ml-auto min-w-5 rounded-full bg-pink-600 px-1.5 py-0.5 text-center text-[10px] font-bold leading-none text-white">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                ) : null}
              </Link>
            ))}
            {!user ? (
              <Link href="/auth" className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition ${pathname === '/auth' ? 'bg-violet-500/10 text-violet-200 ring-1 ring-violet-400/20' : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'}`}>
                <LogIn className="h-4 w-4" /> Login
              </Link>
            ) : null}
          </nav>

          <div className="mt-8 rounded-2xl border border-violet-400/20 bg-gradient-to-br from-violet-500/10 to-slate-900 p-4 text-white">
            <p className="text-sm font-semibold">Need a quiet moment?</p>
            <p className="mt-2 text-sm text-slate-300">Take a breath. You are not behind; you are just processing.</p>
          </div>
        </div>
      </aside>
      <nav aria-label="Mobile navigation" className="fixed inset-x-0 bottom-0 z-50 border-t border-violet-400/20 bg-slate-950/95 px-1 pt-2 pb-[max(env(safe-area-inset-bottom),0.5rem)] shadow-[0_-8px_25px_rgba(15,23,42,0.6)] xl:hidden">
        <div className="mx-auto flex max-w-lg items-stretch justify-around">
          {navItems.map(({ label, href, icon: Icon }) => {
            const active = (label === 'Home' && pathname === '/feed') || (label === 'Profile' && pathname.startsWith('/profile')) || (label === 'Settings' && pathname === '/settings') || (label === 'Explore' && pathname === '/feed');
            return (
              <Link key={label} href={href} aria-label={label} title={label} className={`relative flex min-w-0 flex-1 items-center justify-center rounded-lg py-2.5 ${active ? 'text-violet-200' : 'text-slate-400 hover:text-white'}`}>
                <Icon className="h-5 w-5" />
                {label === 'Notifications' && unreadCount > 0 ? (
                  <span className="absolute right-[calc(50%-1.25rem)] top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-pink-600 px-1 text-[9px] font-bold leading-none text-white">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
