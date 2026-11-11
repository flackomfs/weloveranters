'use client';

import Image from 'next/image';
import Link from 'next/link';
import { createUserWithEmailAndPassword, GoogleAuthProvider, signInWithEmailAndPassword, signInWithPopup } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import logo from '@/src/images/logo.png';
import { getFirebaseAuth } from '@/lib/firebase-client';

export function AuthScreen() {
  const router = useRouter();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleGoogleSignIn() {
    const auth = getFirebaseAuth();
    if (!auth) {
      setMessage('Firebase sign-in is not configured. Add the NEXT_PUBLIC_FIREBASE settings to enable it.');
      return;
    }

    setIsSubmitting(true);
    setMessage('');

    try {
      await signInWithPopup(auth, new GoogleAuthProvider());
      router.replace('/feed');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Google sign-in failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleEmailSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('');

    if (mode === 'register' && password !== confirmPassword) {
      setMessage('Your passwords do not match.');
      return;
    }

    const auth = getFirebaseAuth();
    if (!auth) {
      setMessage('Firebase sign-in is not configured. Add the NEXT_PUBLIC_FIREBASE settings to enable it.');
      return;
    }

    setIsSubmitting(true);

    try {
      if (mode === 'register') {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
      router.replace('/feed');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to continue. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="relative w-full max-w-xl overflow-hidden rounded-[32px] border border-violet-500/30 bg-slate-950/80 shadow-[0_0_50px_rgba(168,85,247,0.3)] backdrop-blur-xl">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(168,85,247,0.22),_transparent_40%),radial-gradient(circle_at_bottom,_rgba(236,72,153,0.12),_transparent_35%)]" />

      <div className="relative p-5 sm:p-6">
        <div className="mb-4 flex justify-center">
          <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border border-violet-400/40 bg-slate-900/80 p-1 shadow-[0_0_25px_rgba(168,85,247,0.2)]">
            <Image src={logo} alt="WeLoveRanters logo" width={80} height={80} priority className="h-full w-full rounded-full object-cover" />
          </div>
        </div>

        <div className="mb-4 text-center">
          <h1 className="text-2xl font-black tracking-tight text-white">{mode === 'login' ? 'Welcome back' : 'Create your account'}</h1>
          <p className="mt-1 text-sm text-slate-300">{mode === 'login' ? 'Log in to keep venting safely.' : 'Join the conversation, honestly.'}</p>
        </div>

        <button type="button" onClick={handleGoogleSignIn} disabled={isSubmitting} className="group flex w-full items-center justify-center gap-3 rounded-2xl border border-violet-400/30 bg-white px-4 py-3 font-semibold text-slate-900 shadow-lg shadow-violet-500/10 transition hover:-translate-y-0.5 hover:bg-violet-50 disabled:cursor-wait disabled:opacity-70">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white">G</span>
            {isSubmitting ? 'Signing in...' : 'Continue with Google'}
        </button>

        <div className="my-4 flex items-center gap-3 text-xs text-slate-500">
          <span className="h-px flex-1 bg-white/10" />
          OR USE EMAIL
          <span className="h-px flex-1 bg-white/10" />
        </div>

        <div className="mb-3 grid grid-cols-2 rounded-xl border border-white/10 bg-slate-900/70 p-1">
          <button type="button" onClick={() => { setMode('login'); setMessage(''); }} className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${mode === 'login' ? 'bg-violet-500/20 text-violet-100' : 'text-slate-400 hover:text-white'}`}>
            Log in
          </button>
          <button type="button" onClick={() => { setMode('register'); setMessage(''); }} className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${mode === 'register' ? 'bg-violet-500/20 text-violet-100' : 'text-slate-400 hover:text-white'}`}>
            Register
          </button>
        </div>

        <form onSubmit={handleEmailSubmit} className="space-y-3">
          <label className="block">
            <span className="sr-only">Email address</span>
            <input type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Email address" className="w-full rounded-xl border border-white/10 bg-slate-900/80 px-4 py-2.5 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-violet-400/60 focus:ring-2 focus:ring-violet-500/15" />
          </label>
          <label className="block">
            <span className="sr-only">Password</span>
            <input type="password" autoComplete={mode === 'register' ? 'new-password' : 'current-password'} required minLength={6} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Password" className="w-full rounded-xl border border-white/10 bg-slate-900/80 px-4 py-2.5 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-violet-400/60 focus:ring-2 focus:ring-violet-500/15" />
          </label>
          {mode === 'register' ? (
            <label className="block">
              <span className="sr-only">Confirm password</span>
              <input type="password" autoComplete="new-password" required minLength={6} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="Confirm password" className="w-full rounded-xl border border-white/10 bg-slate-900/80 px-4 py-2.5 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-violet-400/60 focus:ring-2 focus:ring-violet-500/15" />
            </label>
          ) : null}
          <button type="submit" disabled={isSubmitting} className="w-full rounded-xl bg-gradient-to-r from-violet-500 to-pink-500 px-4 py-2.5 text-sm font-bold text-white shadow-[0_0_20px_rgba(168,85,247,0.2)] transition hover:brightness-110 disabled:cursor-wait disabled:opacity-70">
            {isSubmitting ? 'Please wait...' : mode === 'login' ? 'Log in with email' : 'Create account'}
          </button>
        </form>

        {message ? <p role="alert" className="mt-3 text-center text-xs text-rose-300">{message}</p> : null}

        <p className="mt-4 text-center text-sm text-slate-400">
          Not ready yet?{' '}
          <Link href="/feed" className="font-semibold text-violet-300 transition hover:text-violet-200">
            Explore as guest
          </Link>
        </p>
      </div>
    </div>
  );
}
