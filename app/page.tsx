import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, Search } from 'lucide-react';
import { AuthScreen } from '@/components/AuthScreen';
import logo from '@/src/images/logo.png';

const trends = [
  ['burnout', '2.5k posts'],
  ['anxiety', '1.9k posts'],
  ['friendship', '1.4k posts'],
  ['college', '980 posts'],
  ['relationships', '860 posts']
];

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[#050816] text-white">
      <section className="mx-auto max-w-7xl px-4 pb-16 pt-8 sm:px-6 lg:px-8">
        <nav className="mb-8 flex items-center justify-between rounded-full border border-violet-400/30 bg-[#0b1120]/80 px-5 py-3 shadow-[0_0_30px_rgba(168,85,247,0.14)] backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-full border border-violet-400/40 bg-slate-900/80 p-1.5 shadow-[0_0_20px_rgba(168,85,247,0.25)]">
              <Image src={logo} alt="WeLoveRanters logo" width={48} height={48} className="h-full w-full rounded-full object-cover" />
            </div>
            <div className="hidden sm:block">
              <p className="text-lg font-black tracking-tight text-white">weloveranters.lol</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link href="/auth" className="inline-flex items-center justify-center rounded-full border border-violet-400/30 bg-violet-500/10 px-4 py-2 text-sm font-semibold text-violet-100 transition hover:bg-violet-500/15">
              Login
            </Link>
            <Link
              href="/feed"
              className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-violet-500 to-pink-500 px-5 py-2.5 text-sm font-semibold text-white shadow-[0_0_25px_rgba(168,85,247,0.35)] transition hover:brightness-110"
            >
              Explore feed <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </nav>

        <div className="mx-auto mt-6 grid max-w-6xl gap-8 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="flex justify-center lg:justify-start">
            <AuthScreen />
          </div>

          <aside className="w-full">
            <div className="rounded-[28px] border border-violet-400/20 bg-slate-900/80 p-5 shadow-[0_0_30px_rgba(168,85,247,0.10)] backdrop-blur-xl">
              <div className="mb-5 flex items-center justify-between">
                <h3 className="text-lg font-bold text-white">TRENDING NOW</h3>
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
        </div>
      </section>

    </main>
  );
}
