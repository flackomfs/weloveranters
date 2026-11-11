'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

import { PostComposer } from '@/components/PostComposer';

type FeedPost = {
  id: string;
  content: string;
  createdAt: string;
  likes: number;
  comments: number;
  reposts: number;
  authorName: string | null;
  authorUsername: string | null;
  avatarUrl: string | null;
  tags: string[];
};

export function Feed() {
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAvailable, setIsAvailable] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');

  const loadPosts = useCallback(async () => {
    try {
      const response = await fetch('/api/posts', { cache: 'no-store' });
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
  }, []);

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

      <div className="mt-4 space-y-3 sm:mt-6 sm:space-y-4">
        {isLoading ? <p className="py-8 text-center text-sm text-slate-500">Loading posts...</p> : null}
        {!isLoading && error ? <p role="alert" className="py-8 text-center text-sm text-rose-600">{error}</p> : null}
        {!isLoading && !error && !isAvailable ? <p className="py-8 text-center text-sm text-slate-500">The feed is unavailable because database storage is not configured.</p> : null}
        {!isLoading && !error && isAvailable && posts.length === 0 ? <p className="py-8 text-center text-sm text-slate-500">No rants yet. Be the first to share one.</p> : null}
        {!isLoading && !error && posts.length > 0 && filteredPosts.length === 0 ? <p className="py-8 text-center text-sm text-slate-500">No rants match your search.</p> : null}
        {filteredPosts.map((post) => (
          <article key={post.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-3 sm:rounded-3xl sm:p-4">
            <div className="flex items-start gap-3">
              {post.avatarUrl ? (
                <Image src={post.avatarUrl} alt="" width={44} height={44} unoptimized className="h-11 w-11 rounded-full object-cover" />
              ) : (
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-pink-500 to-violet-500 text-sm font-bold text-white">
                  {(post.authorName || 'U').slice(0, 1).toUpperCase()}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-slate-900">{post.authorName || 'Member'}</p>
                  {post.authorUsername ? <Link href={`/profile/${encodeURIComponent(post.authorUsername)}`} className="text-sm text-slate-500 hover:text-violet-700">@{post.authorUsername}</Link> : null}
                  <span className="text-sm text-slate-400">· {new Date(post.createdAt).toLocaleString()}</span>
                </div>
                <p className="mt-2 whitespace-pre-line text-sm leading-6 text-slate-700 sm:mt-3 sm:text-[15px] sm:leading-7">{post.content}</p>

                <div className="mt-4 flex flex-wrap gap-2">
                  {post.tags.map((tag) => (
                    <span key={tag} className="rounded-full bg-pink-100 px-2.5 py-1 text-xs font-medium text-pink-700">
                      #{tag}
                    </span>
                  ))}
                </div>

                <div className="mt-4 flex items-center gap-6 text-sm text-slate-500">
                  <span>❤️ {post.likes}</span>
                  <span>💬 {post.comments}</span>
                  <span>↻ {post.reposts}</span>
                </div>
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
