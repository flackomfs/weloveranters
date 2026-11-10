import { Search } from 'lucide-react';

export function RightSidebar() {
  return (
    <aside className="hidden w-80 shrink-0 lg:block">
      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-soft">
        <div className="mb-5 flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-900">Trending</h3>
          <Search className="h-4 w-4 text-pink-500" />
        </div>
        <div className="space-y-4">
          {[
            ['burnout', '2.5k posts'],
            ['anxiety', '1.9k posts'],
            ['friendship', '1.4k posts'],
            ['college', '980 posts']
          ].map(([topic, count], index) => (
            <div key={topic} className="flex items-start gap-3">
              <span className="text-sm font-semibold text-slate-400">0{index + 1}</span>
              <div>
                <p className="font-medium text-slate-800">#{topic}</p>
                <p className="text-sm text-slate-500">{count}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}
