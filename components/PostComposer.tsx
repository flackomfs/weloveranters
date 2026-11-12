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
  const [isDraftReady, setIsDraftReady] = useState(false);
  const [draftStatus, setDraftStatus] = useState('');

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

  useEffect(() => {
    if (!isAuthReady) return;
    let active = true;
    setIsDraftReady(false);

    async function restoreDraft() {
      let localDraft = '';
      try {
        localDraft = window.localStorage.getItem('weloveranters-post-draft') || '';
      } catch {
        if (active && !user) setDraftStatus('Local drafts are unavailable in this browser.');
      }

      try {
        if (!user) {
          if (active) setContent(localDraft);
          return;
        }

        const token = await user.getIdToken();
        const response = await fetch('/api/drafts', {
          cache: 'no-store',
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Unable to load your draft.');
        if (data.draft?.content) {
          if (active) setContent(data.draft.content);
        } else if (localDraft) {
          const saveResponse = await fetch('/api/drafts', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ content: localDraft })
          });
          const saveData = await saveResponse.json();
          if (!saveResponse.ok) throw new Error(saveData.error || 'Unable to sync your draft.');
          window.localStorage.removeItem('weloveranters-post-draft');
          if (active) setContent(localDraft);
        }
      } catch (draftError) {
        if (active) setDraftStatus(draftError instanceof Error ? draftError.message : 'Unable to restore your draft.');
      } finally {
        if (active) setIsDraftReady(true);
      }
    }

    void restoreDraft();
    return () => {
      active = false;
    };
  }, [isAuthReady, user]);

  useEffect(() => {
    if (!isDraftReady) return;
    const timerId = window.setTimeout(() => {
      if (!user) {
        try {
          if (content) window.localStorage.setItem('weloveranters-post-draft', content);
          else window.localStorage.removeItem('weloveranters-post-draft');
          setDraftStatus(content ? 'Draft saved on this device.' : '');
        } catch {
          setDraftStatus('Unable to save draft on this device.');
        }
        return;
      }

      void (async () => {
        try {
          const token = await user.getIdToken();
          const response = await fetch('/api/drafts', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ content })
          });
          const data = await response.json();
          if (!response.ok) throw new Error(data.error || 'Unable to save your draft.');
          setDraftStatus(content ? 'Draft synced to your account.' : '');
        } catch (draftError) {
          setDraftStatus(draftError instanceof Error ? draftError.message : 'Unable to save your draft.');
        }
      })();
    }, 600);
    return () => window.clearTimeout(timerId);
  }, [content, isDraftReady, user]);

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
      try {
        window.localStorage.removeItem('weloveranters-post-draft');
      } catch {
        setDraftStatus('Post published, but the device draft could not be cleared.');
      }
      onPosted();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Something went wrong.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border border-slate-200 bg-slate-50 p-2.5 sm:rounded-2xl sm:p-3">
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
        placeholder={!user ? 'Write a draft. Sign in to publish it.' : 'What is weighing on your mind today?'}
        rows={2}
        maxLength={2000}
        disabled={!isAuthReady}
        className="w-full resize-none rounded-xl border border-slate-200 bg-white p-2.5 text-sm text-slate-800 outline-none transition focus:border-violet-300 focus:ring-2 focus:ring-violet-100 disabled:cursor-not-allowed disabled:bg-slate-100 sm:p-3"
      />

      <div className="mt-2 flex items-center justify-between gap-3 sm:mt-3">
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
      {draftStatus ? <p aria-live="polite" className="mt-1 text-[10px] text-slate-500 sm:text-xs">{draftStatus}</p> : null}
    </form>
  );
}
