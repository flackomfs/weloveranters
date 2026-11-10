import Link from 'next/link';
import { ArrowRight, Flame, MessageSquareText, ShieldCheck, Sparkles } from 'lucide-react';

const features = [
  {
    icon: Flame,
    title: 'Venting without judgment',
    description: 'Create space for honest expression, daily updates, and emotional check-ins.'
  },
  {
    icon: MessageSquareText,
    title: 'Build community',
    description: 'Follow people who understand your mood and join conversations that matter.'
  },
  {
    icon: ShieldCheck,
    title: 'Safe and intentional',
    description: 'Private auth flows and a lightweight backend keep the app fast and safe.'
  }
];

export default function HomePage() {
  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <section className="mx-auto max-w-7xl px-4 pb-16 pt-10 sm:px-6 lg:px-8">
        <nav className="flex items-center justify-between rounded-full border border-white/10 bg-white/5 px-4 py-3 backdrop-blur">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-pink-500 to-violet-500 text-lg font-bold">W</div>
            <div>
              <p className="text-lg font-semibold">WeLoveRanters</p>
            </div>
          </div>

          <div className="hidden items-center gap-8 text-sm text-slate-300 md:flex">
            <Link href="#features" className="transition hover:text-white">Features</Link>
            <Link href="#community" className="transition hover:text-white">Community</Link>
            <Link href="#auth" className="transition hover:text-white">Login</Link>
          </div>

          <Link
            href="/feed"
            className="inline-flex items-center gap-2 rounded-full bg-pink-500 px-5 py-2 text-sm font-medium text-white transition hover:bg-pink-400"
          >
            Explore feed <ArrowRight className="h-4 w-4" />
          </Link>
        </nav>

        <div className="grid items-center gap-12 pb-20 pt-20 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-pink-500/40 bg-pink-500/10 px-3 py-1 text-sm text-pink-200">
              <Sparkles className="h-4 w-4" />
              A space for honest conversations
            </div>
            <h1 className="max-w-xl text-5xl font-black tracking-tight text-white sm:text-6xl">
              Share what you feel without filtering it.
            </h1>
            <p className="mt-6 max-w-xl text-lg text-slate-300">
              WeLoveRanters is a community-driven social app where people vent, connect, support each other, and engage in thoughtful conversations about real life.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Link
                href="/feed"
                className="rounded-full bg-white px-6 py-3 font-medium text-slate-900 transition hover:bg-slate-100"
              >
                Start reading
              </Link>
              <Link
                href="/login"
                className="rounded-full border border-white/20 bg-white/5 px-6 py-3 font-medium text-white transition hover:bg-white/10"
              >
                Join now
              </Link>
            </div>

            <div className="mt-10 flex items-center gap-8 text-sm text-slate-300">
              <div>
                <span className="block text-2xl font-bold text-white">12k+</span>
                Voices
              </div>
              <div>
                <span className="block text-2xl font-bold text-white">48k</span>
                Rants
              </div>
              <div>
                <span className="block text-2xl font-bold text-white">4.9/5</span>
                Community rating
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900 to-slate-800 p-6 shadow-soft">
            <div className="mb-6 flex items-center justify-between">
              <span className="rounded-full border border-pink-500/40 bg-pink-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-pink-200">
                Trending now
              </span>
              <span className="text-sm text-slate-400">Live</span>
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
                  <div className="h-2.5 w-2.5 rounded-full bg-pink-500" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="features" className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="mb-12 text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-pink-400">Why it works</p>
          <h2 className="mt-3 text-3xl font-bold text-slate-900">Built for emotional honesty and connection</h2>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {features.map(({ icon: Icon, title, description }) => (
            <div key={title} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-soft">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-pink-100 text-pink-600">
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="mb-2 text-xl font-bold text-slate-900">{title}</h3>
              <p className="text-slate-600">{description}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="community" className="bg-slate-900 py-20 text-white">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-8 md:grid-cols-2">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-pink-400">Community</p>
              <h2 className="mt-3 text-3xl font-bold">A social feed that feels human</h2>
              <p className="mt-4 max-w-lg text-slate-300">
                The product is designed to feel familiar to social platforms while staying centered on mental clarity, emotional support, and meaningful sharing.
              </p>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-full bg-gradient-to-br from-pink-500 to-violet-500" />
                <div>
                  <p className="font-semibold">@midnightmuse</p>
                  <p className="text-sm text-slate-400">Feeling overwhelmed but still showing up.</p>
                </div>
              </div>
              <p className="mt-5 text-slate-200">
                "Some days are just loud. I’m grateful for the people who understand without needing a full explanation."
              </p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
