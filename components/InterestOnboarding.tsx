'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Check, UserPlus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useUser } from '@clerk/nextjs';
import { INTERESTS, INTEREST_LABELS, type Interest } from '@/lib/interests';

type Recommendation = {
  id: string;
  username: string;
  name: string;
  avatarUrl: string;
};

export function InterestOnboarding() {
  const { isLoaded, user } = useUser();
  const [interests, setInterests] = useState<Interest[]>([]);
  const [selected, setSelected] = useState<Interest[]>([]);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [following, setFollowing] = useState<string[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [dismissed, setDismissed] = useState(false);
  const [error, setError] = useState('');

  async function loadInterests() {
    const response = await fetch('/api/interests', { cache: 'no-store' });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Unable to load your interests.');
    const nextInterests = data.interests as Interest[];
    setInterests(nextInterests);
    setSelected(nextInterests);
    setRecommendations(data.recommendations as Recommendation[]);
    setIsEditing(nextInterests.length === 0);
  }

  useEffect(() => {
    if (!isLoaded || !user) {
      setIsLoading(false);
      return;
    }
    let active = true;
    void (async () => {
      try {
        await loadInterests();
      } catch (loadError) {
        if (active) setError(loadError instanceof Error ? loadError.message : 'Unable to load your interests.');
      } finally {
        if (active) setIsLoading(false);
      }
    })();
    return () => { active = false; };
  }, [isLoaded, user]);

  function toggleInterest(interest: Interest) {
    setSelected((current) => current.includes(interest)
      ? current.filter((value) => value !== interest)
      : current.length < 6 ? [...current, interest] : current);
  }

  async function saveInterests() {
    if (selected.length === 0 || isSaving) return;
    setIsSaving(true);
    setError('');
    try {
      const response = await fetch('/api/interests', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ interests: selected })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to save interests.');
      await loadInterests();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save interests.');
    } finally {
      setIsSaving(false);
    }
  }

  async function followRecommendation(userId: string) {
    if (following.includes(userId)) return;
    setError('');
    try {
      const response = await fetch('/api/follow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetId: userId })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to follow this account.');
      if (data.following) setFollowing((current) => [...current, userId]);
      else setRecommendations((current) => current.filter((recommendation) => recommendation.id !== userId));
    } catch (followError) {
      setError(followError instanceof Error ? followError.message : 'Unable to follow this account.');
    }
  }

  if (!isLoaded || !user || isLoading || dismissed) return null;

  return (
    <section className="mb-3 rounded-2xl border border-violet-200 bg-white p-3 text-slate-800 shadow-sm sm:mb-4 sm:p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-bold">{interests.length ? 'Your interests' : 'Make your feed yours'}</h2>
          <p className="mt-1 text-xs text-slate-500">
            {interests.length
              ? 'Choose topics to get more relevant account suggestions.'
              : 'Pick a few topics and we’ll suggest people to follow.'}
          </p>
        </div>
        {interests.length > 0 ? (
          <button type="button" onClick={() => { setSelected(interests); setIsEditing((current) => !current); }} className="shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold text-violet-700 hover:bg-violet-50">
            {isEditing ? 'Cancel' : 'Edit'}
          </button>
        ) : (
          <button type="button" onClick={() => setDismissed(true)} className="shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold text-slate-500 hover:bg-slate-50">
            Skip
          </button>
        )}
      </div>

      {isEditing ? (
        <>
          <div className="mt-3 flex flex-wrap gap-2">
            {INTERESTS.map((interest) => {
              const isSelected = selected.includes(interest);
              return (
                <button
                  key={interest}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => toggleInterest(interest)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                    isSelected ? 'border-violet-600 bg-violet-600 text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-violet-300'
                  }`}
                >
                  {INTEREST_LABELS[interest]}
                </button>
              );
            })}
          </div>
          <div className="mt-3 flex items-center justify-between gap-3">
            <p className="text-[11px] text-slate-500">{selected.length}/6 selected</p>
            <button type="button" onClick={() => void saveInterests()} disabled={!selected.length || isSaving} className="rounded-full bg-violet-600 px-4 py-2 text-xs font-semibold text-white disabled:opacity-50">
              {isSaving ? 'Saving...' : 'Save interests'}
            </button>
          </div>
        </>
      ) : (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {interests.map((interest) => (
            <span key={interest} className="rounded-full bg-violet-50 px-2.5 py-1 text-[11px] font-medium text-violet-800">{INTEREST_LABELS[interest]}</span>
          ))}
        </div>
      )}

      {!isEditing && recommendations.length > 0 ? (
        <div className="mt-4 border-t border-slate-100 pt-3">
          <h3 className="mb-2 text-xs font-semibold text-slate-700">People you might like</h3>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {recommendations.map((recommendation) => (
              <article key={recommendation.id} className="flex min-w-48 items-center gap-2 rounded-xl border border-slate-100 bg-slate-50 p-2">
                <Link href={`/profile/${encodeURIComponent(recommendation.username)}`} className="flex min-w-0 flex-1 items-center gap-2">
                  {recommendation.avatarUrl ? (
                    <Image src={recommendation.avatarUrl} alt="" width={32} height={32} unoptimized className="h-8 w-8 rounded-full object-cover" />
                  ) : (
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-violet-100 text-xs font-bold text-violet-700">
                      {(recommendation.name || 'U').slice(0, 1).toUpperCase()}
                    </span>
                  )}
                  <span className="min-w-0">
                    <span className="block truncate text-xs font-semibold text-slate-800">{recommendation.name}</span>
                    <span className="block truncate text-[10px] text-slate-500">@{recommendation.username}</span>
                  </span>
                </Link>
                <button
                  type="button"
                  onClick={() => void followRecommendation(recommendation.id)}
                  aria-label={following.includes(recommendation.id) ? `Following ${recommendation.name}` : `Follow ${recommendation.name}`}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-violet-600 text-white hover:bg-violet-700"
                >
                  {following.includes(recommendation.id) ? <Check className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
                </button>
              </article>
            ))}
          </div>
        </div>
      ) : null}
      {error ? <p role="alert" className="mt-3 text-xs text-rose-600">{error}</p> : null}
    </section>
  );
}
