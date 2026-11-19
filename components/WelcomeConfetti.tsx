'use client';

import { onAuthStateChanged } from 'firebase/auth';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { getFirebaseAuth } from '@/lib/firebase-client';

type ConfettiPiece = {
  id: number;
  left: number;
  top: number;
  width: number;
  height: number;
  color: string;
  drift: number;
  spin: number;
  isRound: boolean;
};

type ConfettiStyle = CSSProperties & {
  '--confetti-drift': string;
  '--confetti-spin': string;
};

const colors = ['#8b5cf6', '#ec4899', '#38bdf8', '#fbbf24', '#34d399', '#fb7185'];

function createConfettiPieces(prefersReducedMotion: boolean): ConfettiPiece[] {
  return Array.from({ length: 140 }, (_, id) => ({
    id,
    left: Math.random() * 100,
    top: prefersReducedMotion ? Math.random() * 100 : 0,
    width: 4 + Math.random() * 4,
    height: 6 + Math.random() * 6,
    color: colors[Math.floor(Math.random() * colors.length)],
    drift: (Math.random() - 0.5) * 50,
    spin: (Math.random() > 0.5 ? 1 : -1) * (360 + Math.random() * 720),
    isRound: Math.random() < 0.25
  }));
}

export function WelcomeConfetti() {
  const pathname = usePathname();
  const [pieces, setPieces] = useState<ConfettiPiece[]>([]);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const hasCelebrated = useRef(false);

  useEffect(() => {
    const auth = getFirebaseAuth();
    if (!auth) return;

    setPrefersReducedMotion(window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    return onAuthStateChanged(auth, (user) => {
      setIsAuthenticated(Boolean(user));
      if (!user) {
        hasCelebrated.current = false;
        setPieces([]);
      }
    });
  }, []);

  useEffect(() => {
    if (!isAuthenticated || pathname !== '/feed' || hasCelebrated.current) return;
    hasCelebrated.current = true;
    setPieces(createConfettiPieces(prefersReducedMotion));
  }, [isAuthenticated, pathname, prefersReducedMotion]);

  useEffect(() => {
    if (!pieces.length) return;
    const timeoutId = window.setTimeout(() => setPieces([]), 3000);
    return () => window.clearTimeout(timeoutId);
  }, [pieces]);

  if (!pieces.length) return null;

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-[100] overflow-hidden">
      {pieces.map((piece) => {
        const style: ConfettiStyle = {
          left: `${piece.left}%`,
          top: prefersReducedMotion ? `${piece.top}%` : '-0.75rem',
          width: `${piece.width}px`,
          height: `${piece.height}px`,
          backgroundColor: piece.color,
          borderRadius: piece.isRound ? '50%' : '2px',
          '--confetti-drift': `${piece.drift}vw`,
          '--confetti-spin': `${piece.spin}deg`
        };
        return (
          <span
            key={piece.id}
            className={`absolute ${prefersReducedMotion ? '' : 'welcome-confetti-piece'}`}
            style={style}
          />
        );
      })}
    </div>
  );
}
