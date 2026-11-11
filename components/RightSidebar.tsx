import { Search } from 'lucide-react';

const trends = [
  ['burnout', '2.5k posts'],
  ['anxiety', '1.9k posts'],
  ['friendship', '1.4k posts'],
  ['college', '980 posts']
];

export function RightSidebar() {
  return (
    <aside className="hidden w-80 shrink-0 lg:block">
      <div className="rounded-[28px] border border-violet-400/20 bg-slate-900/80 p-5 shadow-[0_0_30px_rgba(168,85,247,0.10)] backdrop-blur-xl">
        <div className="mb-5 flex items-center justify-between">
          <h3 className="text-lg font-bold text-white">Trending</h3>
          <Search className="h-4 w-4 text-violet-300" />
        </div>

        <div className="space-y-4">
          {trends.map(([topic, count], index) => (
            <div key={topic} className="flex items-start gap-3 rounded-2xl border border-white/5 bg-slate-950/40 p-3">
              <span className="text-sm font-semibold text-slate-400">0{index + 1}</span>
              <div>
                <p className="font-medium text-slate-100">#{topic}</p>
                <p className="text-sm text-slate-400">{count}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}
