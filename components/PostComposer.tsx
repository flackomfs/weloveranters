"use client";

import Image from 'next/image';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { RichText } from '@/components/RichText';
import { getFirebaseAuth } from '@/lib/firebase-client';
import { parseSupportBotCommand } from '@/lib/support-bot-command';

type ComposerProfile = {
  name: string;
  avatarUrl: string;
};

const promptStarters = [
  { label: 'I need to vent', content: 'I need to vent about: ' },
  { label: 'I want advice', content: 'I want advice about: ' },
  { label: "I'm celebrating", content: "I'm celebrating: " }
];

export function PostComposer({ onPosted }: { onPosted: () => void }) {
  const [content, setContent] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<ComposerProfile | null>(null);
  const [isProfileLoaded, setIsProfileLoaded] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [isDraftReady, setIsDraftReady] = useState(false);
  const [draftStatus, setDraftStatus] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isLargePost = content.trimStart().startsWith('#');

  useEffect(() => {
    const auth = getFirebaseAuth();
    if (!auth) {
      setIsAuthReady(true);
      setIsProfileLoaded(true);
      return;
    }

    let active = true;
    let profileRequest = 0;
    const unsubscribe = onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      setIsAuthReady(true);
      setProfile(null);
      setProfileError('');
      setIsProfileLoaded(!nextUser);
      const requestId = ++profileRequest;
      if (!nextUser) return;

      void (async () => {
        try {
          const token = await nextUser.getIdToken();
          const response = await fetch('/api/profile', {
            cache: 'no-store',
            headers: { Authorization: `Bearer ${token}` }
          });
          const data = await response.json();
          if (!response.ok) throw new Error(data.error || 'Unable to load your profile.');
          if (
            !data.profile ||
            typeof data.profile.name !== 'string' ||
            typeof data.profile.avatarUrl !== 'string'
          ) {
            throw new Error('The profile response is incomplete.');
          }
          if (active && requestId === profileRequest) {
            setProfile({ name: data.profile.name, avatarUrl: data.profile.avatarUrl });
          }
        } catch (error) {
          if (active && requestId === profileRequest) {
            console.error('Unable to load profile for post composer:', error);
            setProfileError('Unable to load your latest profile details.');
          }
        } finally {
          if (active && requestId === profileRequest) setIsProfileLoaded(true);
        }
      })();
    });

    return () => {
      active = false;
      unsubscribe();
    };
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

    const supportCommand = parseSupportBotCommand(content);
    if (supportCommand && !window.confirm('This post will be public and sent to Google Gemini to create a separate public reply from Kumusta Bot. Continue?')) {
      return;
    }

    setIsSubmitting(true);

    try {
      const token = await user.getIdToken();
      const response = await fetch('/api/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ content, generateBotReply: Boolean(supportCommand) })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Unable to post rant.');
      }

      setContent('');
      setMessage(data.botReplyError || data.message || 'Your rant is live.');
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

  function choosePromptStarter(starter: string) {
    setContent(starter);
    requestAnimationFrame(() => {
      textareaRef.current?.focus();
      textareaRef.current?.setSelectionRange(starter.length, starter.length);
    });
  }

  const avatarUrl = profile
    ? profile.avatarUrl
    : user && isProfileLoaded && !profileError ? user.photoURL || '' : '';
  const displayName = profile?.name || (
    !user
      ? 'Share a rant'
      : profileError
        ? 'Profile unavailable'
        : isProfileLoaded
          ? user.displayName || user.email || 'Your profile'
          : 'Loading profile...'
  );

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border border-slate-200 bg-slate-50 p-2.5 sm:rounded-2xl sm:p-3">
      <div className="mb-2 flex items-center gap-2.5">
        {avatarUrl ? (
          <Image src={avatarUrl} alt="" width={36} height={36} unoptimized className="h-9 w-9 rounded-full object-cover" />
        ) : (
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-pink-500 text-xs font-bold text-white">
            {(displayName || 'U').slice(0, 1).toUpperCase()}
          </div>
        )}
        <p className="text-xs font-medium text-slate-700 sm:text-sm">{displayName}</p>
      </div>
      {profileError ? <p role="alert" className="mb-2 text-xs text-rose-600">{profileError}</p> : null}

      {!content.trim() ? (
        <div className="mb-2">
          <p className="mb-1.5 text-xs font-semibold text-slate-600">Need a starting point?</p>
          <div className="flex flex-wrap gap-1.5">
            {promptStarters.map((starter) => (
              <button
                key={starter.label}
                type="button"
                onClick={() => choosePromptStarter(starter.content)}
                className="rounded-full border border-violet-200 bg-white px-3 py-1.5 text-xs font-medium text-violet-700 transition hover:bg-violet-50"
              >
                {starter.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <textarea
        ref={textareaRef}
        value={content}
        onChange={(event) => setContent(event.target.value)}
        placeholder={!user ? 'Write a draft. Sign in to publish it.' : 'What is weighing on your mind today?'}
        rows={2}
        maxLength={2000}
        disabled={!isAuthReady}
        className="w-full resize-none rounded-xl border border-slate-200 bg-white p-2.5 text-sm text-slate-800 outline-none transition focus:border-violet-300 focus:ring-2 focus:ring-violet-100 disabled:cursor-not-allowed disabled:bg-slate-100 sm:p-3"
      />

      {isLargePost ? (
        <div aria-label="Post preview" className="mt-2 rounded-xl border border-violet-200 bg-white p-2.5">
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">Large-text preview</p>
          <p className="whitespace-pre-wrap break-words text-base leading-6 text-slate-800"><RichText text={content} /></p>
        </div>
      ) : null}

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
