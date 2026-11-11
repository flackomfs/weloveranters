import { AuthScreen } from '@/components/AuthScreen';

export default function AuthPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(168,85,247,0.2),_transparent_30%),linear-gradient(135deg,#050816_0%,#0f172a_40%,#111827_100%)] px-4 py-10 text-white">
      <AuthScreen />
    </main>
  );
}
