"use client";

import Image from 'next/image';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { useEffect, useState, type FormEvent } from 'react';
import { getFirebaseAuth } from '@/lib/firebase-client';

export function PostComposer({ onPosted }: { onPosted: () => void }) {
  const [content, setContent] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);

  useEffect(() => {
    const auth = getFirebaseAuth();
    if (!auth) {
      setIsAuthReady(true);
      return;
    }

    return onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      setIsAuthReady(true);
    });
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!user) {
      setMessage('Please log in to start posting.');
      return;
    }

    if (!content.trim()) {
      setMessage('Write something before posting.');
      return;
    }

    setIsSubmitting(true);

    try {
      const token = await user.getIdToken();
      const response = await fetch('/api/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ content })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Unable to post rant.');
      }

      setContent('');
      setMessage(data.message || 'Your rant is live.');
      onPosted();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Something went wrong.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
      <div className="mb-2 flex items-center gap-2.5">
        {user?.photoURL ? (
          <Image src={user.photoURL} alt="" width={36} height={36} unoptimized className="h-9 w-9 rounded-full object-cover" />
        ) : (
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-pink-500 text-xs font-bold text-white">
            {(user?.displayName || user?.email || 'U').slice(0, 1).toUpperCase()}
          </div>
        )}
        <p className="text-xs font-medium text-slate-700 sm:text-sm">{user?.displayName || user?.email || 'Share a rant'}</p>
      </div>

      <textarea
        value={content}
        onChange={(event) => setContent(event.target.value)}
        placeholder={!user ? 'Log in to start posting your rant.' : 'What is weighing on your mind today?'}
        rows={3}
        disabled={!isAuthReady || !user}
        className="w-full resize-none rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-800 outline-none transition focus:border-violet-300 focus:ring-2 focus:ring-violet-100 disabled:cursor-not-allowed disabled:bg-slate-100"
      />

      <div className="mt-3 flex items-center justify-between gap-3">
        <p className="text-[10px] text-slate-500 sm:text-xs">{!user ? 'You need to sign in before posting.' : 'Keep it honest, kind, and respectful.'}</p>
        <button
          type="submit"
          disabled={!isAuthReady || !user || isSubmitting}
          className="rounded-full bg-violet-500 px-4 py-2 text-xs font-semibold text-white transition hover:bg-violet-400 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-50 sm:px-4 sm:text-sm"
        >
          {!user ? 'Login to post' : isSubmitting ? 'Posting...' : 'Post rant'}
        </button>
      </div>

      {message ? <p className="mt-2 text-xs text-violet-700 sm:text-sm">{message}</p> : null}
    </form>
  );
}
