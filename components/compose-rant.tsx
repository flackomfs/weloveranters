"use client";

import { useState } from 'react';

export function ComposeRant() {
  const [content, setContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState('');

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!content.trim()) {
      setMessage('Write something before posting.');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch('/api/posts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          content,
          token: ''
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Unable to post rant.');
      }

      setContent('');
      setMessage(data.message || 'Your rant is live.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Something went wrong.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-pink-500 to-violet-500 text-sm font-bold text-white">
          Y
        </div>
        <p className="text-sm font-medium text-slate-700">Share a rant</p>
      </div>

      <textarea
        value={content}
        onChange={(event) => setContent(event.target.value)}
        placeholder="What is weighing on your mind today?"
        rows={4}
        className="w-full resize-none rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-800 outline-none focus:border-pink-300 focus:ring-2 focus:ring-pink-100"
      />

      <div className="mt-4 flex items-center justify-between gap-4">
        <p className="text-xs text-slate-500">Keep it honest, kind, and respectful.</p>
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-full bg-pink-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-pink-400 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? 'Posting...' : 'Post rant'}
        </button>
      </div>

      {message ? <p className="mt-3 text-sm text-pink-700">{message}</p> : null}
    </form>
  );
}
