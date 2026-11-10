"use client";

import { Sidebar } from '@/components/Sidebar';
import { Feed } from '@/components/Feed';
import { RightSidebar } from '@/components/RightSidebar';

export default function FeedPage() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto flex max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <Sidebar />
        <main className="min-w-0 flex-1">
          <Feed />
        </main>
        <RightSidebar />
      </div>
    </div>
  );
}
