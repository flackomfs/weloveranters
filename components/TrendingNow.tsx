'use client';

import { Search } from 'lucide-react';
import { useEffect, useState } from 'react';

type Trend = {
  topic: string;
  posts: number;
};

export function TrendingNow() {
  const [trends, setTrends] = useState<Trend[]>([]);
  const [isAvailable, setIsAvailable] = useState(true);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function loadTrends() {
      try {
        const response = await fetch('/api/trends', { cache: 'no-store' });
        if (!response.ok) throw new Error('Unable to load trends.');

        const data = await response.json();
        if (!isMounted) return;

        setTrends(data.trends);
        setIsAvailable(data.available);
        setHasError(false);
      } catch {
        if (isMounted) setHasError(true);
      }
    }

    void loadTrends();
    const intervalId = window.setInterval(() => void loadTrends(), 3000);

    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
    };
  }, []);

  return (
    <aside className="w-full">
      <div className="rounded-[28px] border border-violet-400/20 bg-slate-900/80 p-5 shadow-[0_0_30px_rgba(168,85,247,0.10)] backdrop-blur-xl">
        <div className="mb-5 flex items-center justify-between">
          <h3 className="text-lg font-bold text-white">TRENDING NOW</h3>
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