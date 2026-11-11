import Image from 'next/image';
import Link from 'next/link';
import { Bell, Compass, Home, LogIn, Settings, User } from 'lucide-react';
import logo from '@/src/images/logo.png';

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
      <div className="rounded-[28px] border border-violet-400/20 bg-slate-900/80 p-5 shadow-[0_0_30px_rgba(168,85,247,0.10)] backdrop-blur-xl">
        <div className="mb-8 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full border border-violet-400/30 bg-slate-950 p-1.5">
            <Image src={logo} alt="WeLoveRanters logo" width={44} height={44} className="h-full w-full object-contain" />
          </div>
          <div>
            <p className="text-xl font-black tracking-tight text-white">WeLoveRanters</p>
            <p className="text-sm text-slate-400">Your daily release</p>
          </div>
        </div>

        <nav className="space-y-2">
          {navItems.map(({ label, href, icon: Icon }) => (
            <Link
              key={label}
              href={href}
              className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition ${
                label === 'Home' ? 'bg-violet-500/10 text-violet-200 ring-1 ring-violet-400/20' : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          ))}
        </nav>

        <div className="mt-8 rounded-2xl border border-violet-400/20 bg-gradient-to-br from-violet-500/10 to-slate-900 p-4 text-white">
          <p className="text-sm font-semibold">Need a quiet moment?</p>
          <p className="mt-2 text-sm text-slate-300">Take a breath. You are not behind; you are just processing.</p>
        </div>
      </div>
    </aside>
  );
}
