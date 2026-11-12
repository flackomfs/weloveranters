'use client';

import { onAuthStateChanged, type User } from 'firebase/auth';
import { useCallback, useEffect, useState } from 'react';
import { PostCard, type FeedPost } from '@/components/PostCard';
import { PostComposer } from '@/components/PostComposer';
import { getFirebaseAuth } from '@/lib/firebase-client';

export function Feed() {
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAvailable, setIsAvailable] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');

  useEffect(() => {
    const auth = getFirebaseAuth();
    if (!auth) return;
    return onAuthStateChanged(auth, setUser);
  }, []);

  const loadPosts = useCallback(async () => {
    try {
      const token = user ? await user.getIdToken() : '';
      const response = await fetch('/api/posts', {
        cache: 'no-store',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to load posts.');
      setPosts(data.posts);
      setIsAvailable(data.available);
      setError('');
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load posts.');
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void loadPosts();
    const intervalId = window.setInterval(() => void loadPosts(), 3000);
    return () => window.clearInterval(intervalId);
  }, [loadPosts]);

  const normalizedQuery = query.trim().toLowerCase();
  const filteredPosts = posts.filter((post) =>
    [post.content, post.authorName, post.authorUsername, ...post.tags]
      .some((value) => value?.toLowerCase().includes(normalizedQuery))
  );

  return (
    <div className="min-w-0 rounded-2xl border border-slate-200 bg-white p-3 shadow-soft sm:rounded-3xl sm:p-4">
      <div className="mb-3 flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 sm:mb-4 sm:rounded-2xl sm:px-4 sm:py-3">
        <span className="text-lg text-slate-400">⌕</span>
        <input
          aria-label="Search"
          placeholder="Search topics, people, or emotions"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="w-full border-0 bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400"
        />
      </div>

      <PostComposer onPosted={loadPosts} />

      <div className="mt-3 space-y-2.5 sm:mt-4 sm:space-y-3">
        {isLoading ? <p className="py-8 text-center text-sm text-slate-500">Loading posts...</p> : null}
        {!isLoading && error ? <p role="alert" className="py-8 text-center text-sm text-rose-600">{error}</p> : null}
        {!isLoading && !error && !isAvailable ? <p className="py-8 text-center text-sm text-slate-500">The feed is unavailable because database storage is not configured.</p> : null}
        {!isLoading && !error && isAvailable && posts.length === 0 ? <p className="py-8 text-center text-sm text-slate-500">No rants yet. Be the first to share one.</p> : null}
        {!isLoading && !error && posts.length > 0 && filteredPosts.length === 0 ? <p className="py-8 text-center text-sm text-slate-500">No rants match your search.</p> : null}
        {filteredPosts.map((post) => <PostCard key={post.entryId} post={post} onChanged={() => void loadPosts()} />)}
      </div>
    </div>
  );
}
