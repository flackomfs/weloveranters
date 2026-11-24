'use client';

import Link from 'next/link';
import { Bookmark, Plus, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { PostCard, type FeedPost, type SavedCollectionOption } from '@/components/PostCard';
import { Sidebar } from '@/components/Sidebar';
import { useUser } from '@clerk/nextjs';

type Collection = SavedCollectionOption & { createdAt: string };

export function BookmarksScreen() {
  const { isLoaded, user } = useUser();
  const [collections, setCollections] = useState<Collection[]>([]);
  const [selectedCollectionId, setSelectedCollectionId] = useState('');
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [newCollectionName, setNewCollectionName] = useState('');
  const [isLoadingCollections, setIsLoadingCollections] = useState(true);
  const [isLoadingPosts, setIsLoadingPosts] = useState(false);
  const [isSavingCollection, setIsSavingCollection] = useState(false);
  const [error, setError] = useState('');

  const loadCollections = useCallback(async () => {
    try {
      const response = await fetch('/api/bookmarks', { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to load collections.');
      const nextCollections = data.collections as Collection[];
      setCollections(nextCollections);
      setSelectedCollectionId((current) =>
        nextCollections.some((collection) => collection.id === current)
          ? current
          : nextCollections[0]?.id || ''
      );
      setError('');
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load collections.');
    } finally {
      setIsLoadingCollections(false);
    }
  }, []);

  const loadPosts = useCallback(async () => {
    if (!selectedCollectionId) {
      setPosts([]);
      return;
    }
    setIsLoadingPosts(true);
    try {
      const response = await fetch(`/api/posts?bookmarks=1&collectionId=${encodeURIComponent(selectedCollectionId)}`, {
        cache: 'no-store'
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to load saved posts.');
      setPosts(data.posts as FeedPost[]);
      setError('');
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load saved posts.');
    } finally {
      setIsLoadingPosts(false);
    }
  }, [selectedCollectionId]);

  useEffect(() => {
    if (!isLoaded || !user) {
      setIsLoadingCollections(false);
      return;
    }
    void loadCollections();
  }, [isLoaded, loadCollections, user]);

  useEffect(() => {
    if (selectedCollectionId) void loadPosts();
  }, [loadPosts, selectedCollectionId]);

  async function handleCreateCollection(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = newCollectionName.trim();
    if (!name || isSavingCollection) return;
    setIsSavingCollection(true);
    setError('');
    try {
      const response = await fetch('/api/bookmarks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create-collection', name })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to create collection.');
      setNewCollectionName('');
      await loadCollections();
      setSelectedCollectionId(String(data.collection.id));
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to create collection.');
    } finally {
      setIsSavingCollection(false);
    }
  }

  async function handleDeleteCollection() {
    const collection = collections.find((item) => item.id === selectedCollectionId);
    if (!collection || collection.name === 'Saved') return;
    if (!window.confirm(`Delete "${collection.name}"? Its posts will move to Saved.`)) return;
    setError('');
    try {
      const response = await fetch('/api/bookmarks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete-collection', collectionId: collection.id })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to delete collection.');
      await loadCollections();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Unable to delete collection.');
    }
  }

  if (!isLoaded || isLoadingCollections) {
    return <main className="min-h-screen px-4 py-8 text-slate-200"><p className="mx-auto max-w-3xl text-sm">Loading saved posts...</p></main>;
  }

  if (!user) {
    return (
      <main className="min-h-screen px-4 py-8 text-slate-900">
        <section className="mx-auto max-w-xl rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-soft">
          <h1 className="text-xl font-bold">Sign in to save posts</h1>
          <p className="mt-2 text-sm text-slate-500">Saved posts and collections are private to your account.</p>
          <Link href="/auth" className="mt-5 inline-flex rounded-full bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white">Sign in</Link>
        </section>
      </main>
    );
  }

  const selectedCollection = collections.find((item) => item.id === selectedCollectionId);

  return (
    <div className="min-h-screen bg-transparent pb-24 text-slate-900 xl:pb-0">
      <div className="mx-auto flex max-w-7xl gap-6 px-3 py-3 sm:px-6 sm:py-6 lg:px-8">
        <Sidebar />
        <main className="min-w-0 flex-1 px-1 sm:px-0">
          <section className="mx-auto max-w-4xl rounded-3xl border border-slate-200 bg-white p-4 shadow-soft sm:p-6">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-100 text-violet-700">
                <Bookmark className="h-5 w-5" />
              </span>
              <div>
                <h1 className="text-xl font-bold">Saved posts</h1>
                <p className="text-sm text-slate-500">Only you can see your saved posts and collections.</p>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-2">
              <label htmlFor="saved-collection" className="sr-only">Choose collection</label>
              <select
                id="saved-collection"
                value={selectedCollectionId}
                onChange={(event) => setSelectedCollectionId(event.target.value)}
                className="min-w-40 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700"
              >
                {collections.map((collection) => <option key={collection.id} value={collection.id}>{collection.name}</option>)}
              </select>
              {selectedCollection?.name !== 'Saved' ? (
                <button type="button" onClick={() => void handleDeleteCollection()} className="inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50">
                  <Trash2 className="h-3.5 w-3.5" /> Delete collection
                </button>
              ) : null}
            </div>

            <form onSubmit={handleCreateCollection} className="mt-3 flex flex-wrap gap-2">
              <input
                value={newCollectionName}
                onChange={(event) => setNewCollectionName(event.target.value)}
                maxLength={40}
                placeholder="New collection name"
                aria-label="New collection name"
                className="min-w-0 flex-1 rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-800"
              />
              <button type="submit" disabled={!newCollectionName.trim() || isSavingCollection} className="inline-flex items-center gap-1.5 rounded-full bg-violet-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
                <Plus className="h-4 w-4" /> {isSavingCollection ? 'Creating...' : 'Create collection'}
              </button>
            </form>

            {error ? <p role="alert" className="mt-4 text-sm text-rose-600">{error}</p> : null}
            <div className="mt-5 space-y-3">
              {isLoadingPosts ? <p className="py-8 text-center text-sm text-slate-500">Loading posts...</p> : null}
              {!isLoadingPosts && !error && posts.length === 0 ? <p className="py-8 text-center text-sm text-slate-500">Nothing saved in this collection yet. Use Save on a post to keep it here.</p> : null}
              {posts.map((post) => (
                <PostCard
                  key={post.entryId}
                  post={post}
                  onChanged={() => void loadPosts()}
                  bookmarkCollections={collections}
                />
              ))}
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
