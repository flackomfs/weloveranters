import Link from 'next/link';
import { AuthScreen } from '@/components/AuthScreen';
import { TrendingNow } from '@/components/TrendingNow';

export default function HomePage() {
  return (
    <main className="min-h-screen bg-transparent text-white">
      <section className="mx-auto max-w-7xl px-4 pb-16 pt-8 sm:px-6 lg:px-8">
        <nav className="mb-8 flex justify-center rounded-full border border-violet-400/30 bg-[#0b1120]/80 px-5 py-3 shadow-[0_0_30px_rgba(168,85,247,0.14)] backdrop-blur-xl">
          <Link href="/" className="text-base font-black text-white sm:text-lg">
            weloveranters
          </Link>
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
