'use client';

import Link from 'next/link';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { Bell, CheckCheck, ChevronLeft } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Sidebar } from '@/components/Sidebar';
import { getFirebaseAuth } from '@/lib/firebase-client';

type NotificationItem = {
  id: string;
  type: 'follow' | 'unfollow' | 'post' | 'like' | 'comment' | 'repost';
  entityId: string | null;
  createdAt: string;
  readAt: string | null;
  actorName: string | null;
  actorUsername: string | null;
  postContent: string | null;
};

const notificationMessages: Record<NotificationItem['type'], string> = {
  follow: 'started following you.',
  unfollow: 'unfollowed you.',
  post: 'posted a new rant.',
  like: 'reacted to your rant.',
  comment: 'commented on your rant.',
  repost: 'reposted your rant.'
};

export default function NotificationsPage() {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [isMarkingRead, setIsMarkingRead] = useState(false);

  useEffect(() => {
    const auth = getFirebaseAuth();
    if (!auth) {
      setIsAuthReady(true);
      setIsLoading(false);
      return;
    }
    return onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      setIsAuthReady(true);
      if (!nextUser) {
        setNotifications([]);
        setIsLoading(false);
      }
    });
  }, []);

  const loadNotifications = useCallback(async (currentUser: User) => {
    try {
      const token = await currentUser.getIdToken();
      const response = await fetch('/api/notifications', {
        cache: 'no-store',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to load notifications.');
      setNotifications(data.notifications);
      setError('');
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load notifications.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    void loadNotifications(user);
    const intervalId = window.setInterval(() => void loadNotifications(user), 3000);
    return () => window.clearInterval(intervalId);
  }, [loadNotifications, user]);

  async function markAllRead() {
    if (!user) return;
    setIsMarkingRead(true);
    try {
      const token = await user.getIdToken();
      const response = await fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({})
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to update notifications.');
      const readAt = new Date().toISOString();
      setNotifications((current) => current.map((notification) => ({ ...notification, readAt: notification.readAt || readAt })));
      setError('');
    } catch (markError) {
      setError(markError instanceof Error ? markError.message : 'Unable to update notifications.');
    } finally {
      setIsMarkingRead(false);
    }
  }

  const unreadCount = notifications.filter((notification) => !notification.readAt).length;

  return (
    <div className="min-h-screen bg-transparent pb-20 text-slate-100 xl:pb-0">
      <div className="mx-auto flex max-w-7xl gap-6 px-3 py-3 sm:px-6 sm:py-6 lg:px-8">
        <Sidebar />
        <main className="min-w-0 flex-1">
          <section className="mx-auto max-w-3xl rounded-2xl border border-violet-400/20 bg-slate-900/80 p-4 shadow-[0_0_30px_rgba(168,85,247,0.10)] sm:rounded-3xl sm:p-6">
            <header className="flex items-center justify-between gap-3">
              <div>
                <Link href="/feed" className="inline-flex items-center gap-1 text-sm text-slate-400 hover:text-white"><ChevronLeft className="h-4 w-4" />Feed</Link>
                <h1 className="mt-3 text-2xl font-bold text-white">Notifications</h1>
                {user ? <p className="mt-1 text-sm text-slate-400">{unreadCount ? `${unreadCount} unread` : 'You’re all caught up.'}</p> : null}
              </div>
              {user && unreadCount > 0 ? (
                <button type="button" onClick={markAllRead} disabled={isMarkingRead} aria-label="Mark all as read" title="Mark all as read" className="inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-2 text-sm font-semibold text-slate-300 hover:bg-white/5 disabled:opacity-60">
                  <CheckCheck className="h-4 w-4" /><span className="hidden sm:inline">Mark all read</span>
                </button>
              ) : null}
            </header>

            {!isAuthReady || (user && isLoading) ? <p className="py-10 text-center text-sm text-slate-400">Loading notifications...</p> : null}
            {isAuthReady && !user ? (
              <div className="mt-6 rounded-xl border border-white/5 bg-slate-950/40 p-5 text-center">
                <Bell className="mx-auto h-6 w-6 text-violet-300" />
                <p className="mt-3 text-sm text-slate-300">Log in to see new followers, reactions, comments, reposts, and posts.</p>
                <Link href="/auth" className="mt-4 inline-flex rounded-full bg-violet-600 px-4 py-2 text-sm font-semibold text-white">Log in</Link>
              </div>
            ) : null}
            {error ? <p role="alert" className="mt-5 text-sm text-rose-300">{error}</p> : null}
            {isAuthReady && user && !isLoading && !error && notifications.length === 0 ? <p className="py-10 text-center text-sm text-slate-400">No activity yet. New followers, reactions, comments, reposts, and posts will appear here.</p> : null}
            {user && notifications.length > 0 ? (
              <div className="mt-5 divide-y divide-white/5">
                {notifications.map((notification) => (
                  <article key={notification.id} className={`flex items-start gap-3 py-4 ${notification.readAt ? '' : 'rounded-lg bg-violet-500/5 px-3'}`}>
                    <span className={`mt-2 h-2 w-2 shrink-0 rounded-full ${notification.readAt ? 'bg-transparent' : 'bg-pink-400'}`} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-slate-200">
                        <Link href={notification.actorUsername ? `/profile/${encodeURIComponent(notification.actorUsername)}` : '/feed'} className="font-semibold text-white hover:text-violet-200">
                          {notification.actorName || 'Someone'}
                        </Link>{' '}
                        {notificationMessages[notification.type]}
                      </p>
                      {notification.type !== 'follow' && notification.type !== 'unfollow' && notification.postContent ? <p className="mt-1 line-clamp-2 text-sm text-slate-400">{notification.postContent}</p> : null}
                      <time className="mt-1 block text-xs text-slate-500" dateTime={notification.createdAt}>{new Date(notification.createdAt).toLocaleString()}</time>
                    </div>
                  </article>
                ))}
              </div>
            ) : null}
          </section>
        </main>
      </div>
    </div>
  );
}