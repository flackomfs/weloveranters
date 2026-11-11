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
    <form onSubmit={handleSubmit} className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
      <div className="mb-4 flex items-center gap-3">
        {user?.photoURL ? (
          <Image src={user.photoURL} alt="" width={44} height={44} unoptimized className="h-11 w-11 rounded-full object-cover" />
        ) : (
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-pink-500 text-sm font-bold text-white">
            {(user?.displayName || user?.email || 'U').slice(0, 1).toUpperCase()}
          </div>
        )}
        <p className="text-sm font-medium text-slate-700">{user?.displayName || user?.email || 'Share a rant'}</p>
      </div>

      <textarea
        value={content}
        onChange={(event) => setContent(event.target.value)}
        placeholder={!user ? 'Log in to start posting your rant.' : 'What is weighing on your mind today?'}
        rows={4}
        disabled={!isAuthReady || !user}
        className="w-full resize-none rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-800 outline-none transition focus:border-violet-300 focus:ring-2 focus:ring-violet-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
      />

      <div className="mt-4 flex items-center justify-between gap-4">
        <p className="text-xs text-slate-500">{!user ? 'You need to sign in before posting.' : 'Keep it honest, kind, and respectful.'}</p>
        <button
          type="submit"
          disabled={!isAuthReady || !user || isSubmitting}
          className="rounded-full bg-violet-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-400 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500"
        >
          {!user ? 'Login to post' : isSubmitting ? 'Posting...' : 'Post rant'}
        </button>
      </div>

      {message ? <p className="mt-3 text-sm text-violet-700">{message}</p> : null}
    </form>
  );
}
