import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, Flame, MessageSquareText, ShieldCheck, Sparkles } from 'lucide-react';
import logo from '@/src/images/logo.png';

const features = [
  {
    icon: Flame,
    title: 'Venting without judgment',
    description: 'Share raw thoughts, daily wins, and honest updates without a filtered social feed.'
  },
  {
    icon: MessageSquareText,
    title: 'Build real community',
    description: 'Follow people who understand your mood and join meaningful conversations.'
  },
  {
    icon: ShieldCheck,
    title: 'Safe by default',
    description: 'Firebase auth and Turso-backed data keep the app lightweight and secure.'
  }
];

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[#050816] text-white">
      <section className="mx-auto max-w-7xl px-4 pb-16 pt-8 sm:px-6 lg:px-8">
        <nav className="mb-6 flex items-center justify-between rounded-full border border-violet-400/20 bg-slate-900/70 px-5 py-3 shadow-[0_0_30px_rgba(168,85,247,0.12)] backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-full border border-violet-400/40 bg-slate-900/80 p-1.5 shadow-[0_0_20px_rgba(168,85,247,0.25)]">
              <Image src={logo} alt="WeLoveRanters logo" width={48} height={48} className="h-full w-full object-contain" />
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

        <div className="mb-8 rounded-full border border-violet-400/30 bg-violet-500/10 px-4 py-3 text-center text-sm font-semibold uppercase tracking-[0.2em] text-violet-100 shadow-[0_0_25px_rgba(168,85,247,0.10)]">
          A space for honest conversations
        </div>

        <div className="grid items-center gap-12 pb-20 pt-4 lg:grid-cols-[1.15fr_0.85fr]">
          <div>
            <p className="mb-4 text-sm font-semibold uppercase tracking-[0.2em] text-violet-300">Why it works</p>
            <h1 className="max-w-xl text-5xl font-black tracking-tight text-white sm:text-6xl">
              Built for honesty, emotional clarity, and connection
            </h1>
            <p className="mt-6 max-w-xl text-lg text-slate-300">
              An honest social feed for raw thoughts, real feelings, and community support without the polished performance.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Link href="/feed" className="rounded-full bg-white px-6 py-3 font-bold text-slate-900 transition hover:bg-slate-100">
                Start reading
              </Link>
              <Link href="/auth" className="rounded-full border border-violet-400/30 bg-violet-500/10 px-6 py-3 font-bold text-violet-100 transition hover:bg-violet-500/15">
                Join now
              </Link>
            </div>

            <div className="mt-10 flex items-center gap-8 text-sm text-slate-300">
              <div>
                <span className="block text-2xl font-black text-white">12k+</span>
                Voices
              </div>
              <div>
                <span className="block text-2xl font-black text-white">48k</span>
                Rants
              </div>
              <div>
                <span className="block text-2xl font-black text-white">4.9/5</span>
                Community rating
              </div>
            </div>
          </div>

          <div className="rounded-[30px] border border-violet-400/20 bg-gradient-to-br from-slate-900 via-slate-900 to-violet-950/80 p-6 shadow-[0_0_40px_rgba(168,85,247,0.18)]">
            <div className="mb-6 flex items-center justify-between gap-4">
              <Link href="/auth" className="inline-flex items-center justify-center rounded-full border border-violet-400/30 bg-violet-500/10 px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-violet-100 transition hover:bg-violet-500/15">
                Login
              </Link>
              <span className="rounded-full border border-violet-400/30 bg-violet-500/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-violet-100">
                Trending now
              </span>
            </div>

            <div className="space-y-5">
              {[
                ['#burnout', '2.4k rants'],
                ['#collegechaos', '1.9k rants'],
                ['#mentalhealth', '3.1k rants'],
                ['#friendship', '965 rants']
              ].map(([topic, count]) => (
                <div key={topic} className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div>
                    <p className="font-semibold text-white">{topic}</p>
                    <p className="text-sm text-slate-400">{count}</p>
                  </div>
                  <div className="h-2.5 w-2.5 rounded-full bg-violet-400" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="features" className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="mb-12 text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-violet-300">Why it works</p>
          <h2 className="mt-3 text-3xl font-bold text-white">Built for honesty, emotional clarity, and connection</h2>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {features.map(({ icon: Icon, title, description }) => (
            <div key={title} className="rounded-3xl border border-violet-400/20 bg-slate-900/80 p-6 shadow-[0_0_25px_rgba(168,85,247,0.08)]">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-500/10 text-violet-200">
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="mb-2 text-xl font-bold text-white">{title}</h3>
              <p className="text-slate-300">{description}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="community" className="bg-slate-950 py-20 text-white">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-8 md:grid-cols-2">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-violet-300">Community</p>
              <h2 className="mt-3 text-3xl font-bold text-white">A social feed that feels human</h2>
              <p className="mt-4 max-w-lg text-slate-300">
                The experience is familiar like Twitter/X but intentionally designed around emotional support, honesty, and collective healing.
              </p>
            </div>

            <div className="rounded-3xl border border-violet-400/20 bg-white/5 p-6 shadow-[0_0_30px_rgba(168,85,247,0.10)]">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-full bg-gradient-to-br from-violet-500 to-pink-500" />
                <div>
                  <p className="font-semibold text-white">@midnightmuse</p>
                  <p className="text-sm text-slate-400">Feeling overwhelmed but still showing up.</p>
                </div>
              </div>
              <p className="mt-5 text-slate-200">
                “Some days are loud. I’m grateful for the people who understand without needing a full explanation.”
              </p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
