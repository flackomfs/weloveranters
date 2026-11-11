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
      <section className="mx-auto max-w-6xl px-4 pb-16 pt-8 sm:px-6 lg:px-8">
        <nav className="mb-8 flex items-center justify-between rounded-full border border-violet-400/30 bg-[#0b1120]/80 px-5 py-3 shadow-[0_0_30px_rgba(168,85,247,0.14)] backdrop-blur-xl">
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

        <div className="mx-auto max-w-5xl">
          <div className="mb-6 flex items-center justify-between gap-4">
            <div className="w-16" />
            <p className="text-center text-sm font-semibold uppercase tracking-[0.25em] text-violet-300">Why it works</p>
            <Link href="/auth" className="inline-flex w-16 items-center justify-center rounded-full border border-violet-400/30 bg-violet-500/10 px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-violet-100 transition hover:bg-violet-500/15">
              Login
            </Link>
          </div>

          <h1 className="text-left text-5xl font-black leading-[0.95] tracking-[-0.06em] text-white sm:text-6xl md:text-[6rem]">
            Built for honesty,<br />
            emotional clarity,<br />
            and connection
          </h1>

          <p className="mt-6 max-w-4xl text-left text-lg text-slate-300 md:text-xl">
            An honest social feed for raw thoughts, real feelings, and community support without the polished performance.
          </p>

          <div className="mt-8 flex justify-start gap-4">
            <Link href="/feed" className="rounded-full bg-white px-8 py-4 text-lg font-bold text-slate-900 transition hover:bg-slate-100">
              Start reading
            </Link>
            <Link href="/auth" className="rounded-full border border-violet-400/30 bg-violet-500/10 px-8 py-4 text-lg font-bold text-violet-100 transition hover:bg-violet-500/15">
              Join now
            </Link>
          </div>

          <div className="mt-10 flex items-center gap-10 text-left text-slate-300">
            <div>
              <span className="block text-4xl font-black text-white">12k+</span>
              <span className="text-base">Voices</span>
            </div>
            <div>
              <span className="block text-4xl font-black text-white">48k</span>
              <span className="text-base">Rants</span>
            </div>
            <div>
              <span className="block text-4xl font-black text-white">4.9/5</span>
              <span className="text-base">Community rating</span>
            </div>
          </div>
        </div>
      </section>

    </main>
  );
}
