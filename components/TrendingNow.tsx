'use client';

import { Search } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useRealtime } from '@/components/RealtimeProvider';

type Trend = {
  topic: string;
  posts: number;
};

export function TrendingNow() {
  const [trends, setTrends] = useState<Trend[]>([]);
  const [isAvailable, setIsAvailable] = useState(true);
  const [hasError, setHasError] = useState(false);

  const loadTrends = useCallback(async () => {
    try {
      const response = await fetch('/api/trends', { cache: 'no-store' });
      if (!response.ok) throw new Error('Unable to load trends.');

      const data = await response.json();
      setTrends(data.trends);
      setIsAvailable(data.available);
      setHasError(false);
    } catch {
      setHasError(true);
    }
  }, []);

  useRealtime(loadTrends);

  useEffect(() => {
    void loadTrends();
  }, [loadTrends]);

  return (
    <aside className="w-full min-w-0">
      <div className="rounded-2xl border border-violet-400/20 bg-slate-900/80 p-4 shadow-[0_0_30px_rgba(168,85,247,0.10)] backdrop-blur-xl sm:rounded-[28px] sm:p-5">
        <div className="mb-4 flex items-center justify-between sm:mb-5">
          <h3 className="text-base font-bold text-white sm:text-lg">TRENDING NOW</h3>
          <Search className="h-4 w-4 text-violet-300" />
        </div>

        {trends.length > 0 ? (
          <div className="space-y-4">
            {trends.map(({ topic, posts }, index) => (
              <div key={topic} className="flex items-start gap-3 rounded-2xl border border-white/5 bg-slate-950/40 p-3">
                <span className="text-sm font-semibold text-slate-400">{String(index + 1).padStart(2, '0')}</span>
                <div>
                  <p className="font-medium text-slate-100">#{topic}</p>
                  <p className="text-sm text-slate-400">{posts.toLocaleString()} {posts === 1 ? 'post' : 'posts'}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="rounded-2xl border border-white/5 bg-slate-950/40 p-4 text-sm text-slate-400">
            {hasError ? 'Trending topics are temporarily unavailable.' : !isAvailable ? 'Live trends will appear when the database is connected.' : 'No hashtags yet. Add a #hashtag to a post to start a trend.'}
          </p>
        )}
      </div>
    </aside>
  );
}