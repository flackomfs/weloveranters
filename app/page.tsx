import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { AuthScreen } from '@/components/AuthScreen';
import { TrendingNow } from '@/components/TrendingNow';

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[#050816] text-white">
      <section className="mx-auto max-w-7xl px-4 pb-16 pt-8 sm:px-6 lg:px-8">
        <nav className="mb-8 flex flex-col items-center gap-3 rounded-full border border-violet-400/30 bg-[#0b1120]/80 px-3 py-3 shadow-[0_0_30px_rgba(168,85,247,0.14)] backdrop-blur-xl sm:relative sm:flex-row sm:justify-end sm:px-5">
          <Link href="/" className="text-base font-black text-white sm:absolute sm:left-1/2 sm:-translate-x-1/2 sm:text-lg">
            weloveranters
          </Link>

          <div className="flex items-center gap-2 sm:gap-3">
            <Link href="/auth" className="inline-flex items-center justify-center rounded-full border border-violet-400/30 bg-violet-500/10 px-3 py-2 text-xs font-semibold text-violet-100 transition hover:bg-violet-500/15 sm:px-4 sm:text-sm">
              Login
            </Link>
            <Link
              href="/feed"
              className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-violet-500 to-pink-500 px-4 py-2.5 text-xs font-semibold text-white shadow-[0_0_25px_rgba(168,85,247,0.35)] transition hover:brightness-110 sm:px-5 sm:text-sm"
            >
              Explore feed <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </nav>

        <div className="mx-auto mt-6 grid max-w-6xl gap-8 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="flex justify-center lg:justify-start">
            <AuthScreen />
          </div>

          <TrendingNow />
        </div>
      </section>

    </main>
  );
}
