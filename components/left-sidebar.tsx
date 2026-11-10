import Link from 'next/link';
import { Bell, Compass, Home, LogIn, Search, Settings, User } from 'lucide-react';

export function LeftSidebar() {
  return (
    <aside className="hidden w-72 shrink-0 xl:block">
      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-soft">
        <div className="mb-8 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-pink-500 to-violet-500 text-lg font-bold text-white">
            W
          </div>
          <div>
            <p className="text-xl font-bold">WeLoveRanters</p>
            <p className="text-sm text-slate-500">Your daily release</p>
          </div>
        </div>

        <nav className="space-y-2">
          {[
            { label: 'Home', icon: Home, active: true, href: '/feed' },
            { label: 'Explore', icon: Compass, href: '/feed' },
            { label: 'Notifications', icon: Bell, href: '/feed' },
            { label: 'Profile', icon: User, href: '/profile/iamnotokay' },
            { label: 'Settings', icon: Settings, href: '/feed' },
            { label: 'Login', icon: LogIn, href: '/login' }
          ].map(({ label, icon: Icon, active, href }) => (
            <Link
              key={label}
              href={href}
              className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition ${
                active ? 'bg-pink-50 text-pink-700' : 'text-slate-700 hover:bg-slate-100'
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          ))}
        </nav>
      </div>
    </aside>
  );
}

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
