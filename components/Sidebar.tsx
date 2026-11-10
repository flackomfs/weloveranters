import Link from 'next/link';
import { Bell, Compass, Home, LogIn, Search, Settings, User } from 'lucide-react';

const navItems = [
  { label: 'Home', href: '/feed', icon: Home },
  { label: 'Explore', href: '/feed', icon: Compass },
  { label: 'Notifications', href: '/feed', icon: Bell },
  { label: 'Profile', href: '/profile', icon: User },
  { label: 'Settings', href: '/feed', icon: Settings },
  { label: 'Login', href: '/auth', icon: LogIn }
];

export function Sidebar() {
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
          {navItems.map(({ label, href, icon: Icon }) => (
            <Link
              key={label}
              href={href}
              className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition ${
                label === 'Home' ? 'bg-pink-50 text-pink-700' : 'text-slate-700 hover:bg-slate-100'
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          ))}
        </nav>

        <div className="mt-8 rounded-2xl bg-slate-900 p-4 text-white">
          <p className="text-sm font-semibold">Need a quiet moment?</p>
          <p className="mt-2 text-sm text-slate-300">Take a breath. You are not behind; you are just processing.</p>
        </div>
      </div>
    </aside>
  );
}
