'use client';

import { onAuthStateChanged, type User } from 'firebase/auth';
import { useCallback, useEffect, useState } from 'react';
import { PostCard, type FeedPost } from '@/components/PostCard';
import { PostComposer } from '@/components/PostComposer';
import { getFirebaseAuth } from '@/lib/firebase-client';

export function Feed({ isExplore = false }: { isExplore?: boolean } = {}) {
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [sort, setSort] = useState<'latest' | 'popular' | 'following'>('latest');
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
      const response = await fetch(`/api/posts?sort=${sort}`, {
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
  }, [sort, user]);

  useEffect(() => {
    void loadPosts();
    const intervalId = window.setInterval(() => void loadPosts(), 3000);
    return () => window.clearInterval(intervalId);
  }, [loadPosts]);

  const normalizedQuery = query.trim().toLowerCase();
  const filteredPosts = !isExplore || !normalizedQuery
    ? posts
    : posts.filter((post) =>
        [post.content, post.authorName, post.authorUsername, ...post.tags]
          .some((value) => value?.toLowerCase().includes(normalizedQuery))
      );

  return (
    <div className="min-w-0 rounded-none border-0 bg-transparent p-0 shadow-none sm:rounded-3xl sm:border sm:border-slate-200 sm:bg-white sm:p-4 sm:shadow-soft">
      {isExplore ? (
        <div className="mb-2 flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 sm:mb-4 sm:rounded-2xl sm:px-4 sm:py-3">
          <span className="text-lg text-slate-400">⌕</span>
          <input
            aria-label="Search"
            placeholder="Search topics, people, or emotions"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="w-full border-0 bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400"
          />
        </div>
      ) : null}

      <nav aria-label="Feed filter" className="mb-2 flex gap-2 overflow-x-auto sm:mb-3">
        {(['latest', 'popular', 'following'] as const).map((filter) => (
          <button
            key={filter}
            type="button"
            aria-pressed={sort === filter}
            onClick={() => setSort(filter)}
            className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold capitalize transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-500 ${
              sort === filter ? 'bg-violet-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-violet-50'
            }`}
          >
            {filter}
          </button>
        ))}
      </nav>

      <PostComposer onPosted={loadPosts} />

      <div className="mt-2 space-y-2 sm:mt-4 sm:space-y-3">
        {isLoading ? <p className="py-8 text-center text-sm text-slate-500">Loading posts...</p> : null}
        {!isLoading && error ? <p role="alert" className="py-8 text-center text-sm text-rose-600">{error}</p> : null}
        {!isLoading && !error && !isAvailable ? <p className="py-8 text-center text-sm text-slate-500">The feed is unavailable because database storage is not configured.</p> : null}
        {!isLoading && !error && sort === 'following' && !user ? <p className="py-8 text-center text-sm text-slate-500">Sign in to see posts from people you follow.</p> : null}
        {!isLoading && !error && isAvailable && posts.length === 0 && !(sort === 'following' && !user) ? <p className="py-8 text-center text-sm text-slate-500">No rants yet. Be the first to share one.</p> : null}
        {!isLoading && !error && posts.length > 0 && filteredPosts.length === 0 ? <p className="py-8 text-center text-sm text-slate-500">No rants match your search.</p> : null}
        {filteredPosts.map((post) => <PostCard key={post.entryId} post={post} onChanged={() => void loadPosts()} />)}
      </div>
    </div>
  );
}
