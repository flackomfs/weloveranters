import Image from 'next/image';
import Link from 'next/link';
import logo from '@/src/images/logo.png';

export function AuthScreen() {
  return (
    <div className="relative w-full max-w-xl overflow-hidden rounded-[32px] border border-violet-500/30 bg-slate-950/80 shadow-[0_0_50px_rgba(168,85,247,0.3)] backdrop-blur-xl">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(168,85,247,0.22),_transparent_40%),radial-gradient(circle_at_bottom,_rgba(236,72,153,0.12),_transparent_35%)]" />

      <div className="relative p-6 sm:p-8">
        <div className="mb-5 flex justify-center">
          <div className="flex h-28 w-28 items-center justify-center overflow-hidden rounded-full border border-violet-400/40 bg-slate-900/80 p-1.5 shadow-[0_0_25px_rgba(168,85,247,0.2)]">
            <Image src={logo} alt="WeLoveRanters logo" width={112} height={112} priority className="h-full w-full rounded-full object-cover" />
          </div>
        </div>

        <div className="mb-6 text-center">
          <h1 className="text-2xl font-black tracking-tight text-white sm:text-3xl">Welcome back</h1>
          <p className="mt-2 text-sm text-slate-300">Log in or create an account to keep venting safely.</p>
        </div>

        <div className="space-y-4">
          <button className="group flex w-full items-center justify-center gap-3 rounded-2xl border border-violet-400/30 bg-white px-4 py-3.5 font-semibold text-slate-900 shadow-lg shadow-violet-500/10 transition hover:-translate-y-0.5 hover:bg-violet-50">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white">G</span>
            Continue with Google
          </button>

          <button className="flex w-full items-center justify-center gap-3 rounded-2xl border border-white/10 bg-slate-900/90 px-4 py-3.5 font-semibold text-white transition hover:-translate-y-0.5 hover:border-violet-400/40 hover:bg-slate-800">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-violet-500/20 text-xs font-bold text-violet-200">@</span>
            Continue with email
          </button>
        </div>

        <div className="mt-6 rounded-2xl border border-violet-400/30 bg-violet-500/10 p-4 text-center text-sm text-violet-100">
          Firebase handles sign-in while Turso stores your profile and rant data.
        </div>

        <p className="mt-6 text-center text-sm text-slate-400">
          Not ready yet?{' '}
          <Link href="/feed" className="font-semibold text-violet-300 transition hover:text-violet-200">
            Explore as guest
          </Link>
        </p>
      </div>
    </div>
  );
}
