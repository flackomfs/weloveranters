"use client";

import { Sidebar } from '@/components/Sidebar';
import { Feed } from '@/components/Feed';
import { TrendingNow } from '@/components/TrendingNow';

export default function FeedPage() {
  return (
    <div className="min-h-screen bg-transparent text-slate-100">
      <div className="mx-auto grid max-w-7xl grid-cols-1 items-start gap-2 px-2 pb-20 pt-2 sm:gap-4 sm:px-6 sm:py-6 lg:grid-cols-[minmax(0,1fr)_18rem] lg:gap-5 xl:grid-cols-[16rem_minmax(0,1fr)_18rem] lg:px-6">
        <Sidebar />
        <main className="min-w-0">
          <Feed />
        </main>
        <div className="hidden min-w-0 lg:block">
          <TrendingNow />
        </div>
      </div>
    </div>
  );
}
