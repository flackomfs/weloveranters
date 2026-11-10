import Link from 'next/link';

export function AuthScreen() {
  return (
    <div className="w-full max-w-md rounded-3xl border border-white/10 bg-white/5 p-8 shadow-2xl shadow-pink-500/10 backdrop-blur-md">
      <div className="mb-8 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-pink-500 to-violet-500 text-2xl font-bold">
          W
        </div>
        <h1 className="text-3xl font-bold">Welcome back</h1>
        <p className="mt-2 text-sm text-slate-300">Log in or create an account to keep venting safely.</p>
      </div>

      <div className="space-y-4">
        <button className="flex w-full items-center justify-center gap-3 rounded-2xl bg-white px-4 py-3 font-medium text-slate-900 transition hover:bg-slate-100">
          Continue with Google
        </button>

        <button className="flex w-full items-center justify-center gap-3 rounded-2xl border border-white/15 bg-slate-900 px-4 py-3 font-medium text-white transition hover:bg-slate-800">
          Continue with email
        </button>
      </div>

      <div className="mt-6 rounded-2xl border border-pink-400/30 bg-pink-500/10 p-4 text-sm text-pink-100">
        Firebase handles sign-in while Turso stores profile and rant data.
      </div>

      <p className="mt-6 text-center text-sm text-slate-400">
        Not ready yet?{' '}
        <Link href="/feed" className="font-medium text-pink-300 hover:text-pink-200">
          Explore as guest
        </Link>
      </p>
    </div>
  );
}
