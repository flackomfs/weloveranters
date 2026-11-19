'use client';

import { onAuthStateChanged } from 'firebase/auth';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { getFirebaseAuth } from '@/lib/firebase-client';

type ConfettiPiece = {
  id: number;
  left: number;
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

function createConfettiPieces(): ConfettiPiece[] {
  return Array.from({ length: 140 }, (_, id) => ({
    id,
    left: Math.random() * 100,
    width: 4 + Math.random() * 4,
    height: 6 + Math.random() * 6,
    color: colors[Math.floor(Math.random() * colors.length)],
    drift: (Math.random() - 0.5) * 50,
    spin: (Math.random() > 0.5 ? 1 : -1) * (360 + Math.random() * 720),
    isRound: Math.random() < 0.25
  }));
}

export function WelcomeConfetti() {
  const [pieces, setPieces] = useState<ConfettiPiece[]>([]);
  const hasCelebrated = useRef(false);

  useEffect(() => {
    const auth = getFirebaseAuth();
    if (!auth) return;

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    return onAuthStateChanged(auth, (user) => {
      if (!user) {
        hasCelebrated.current = false;
        setPieces([]);
        return;
      }

      if (hasCelebrated.current || prefersReducedMotion) return;
      hasCelebrated.current = true;
      setPieces(createConfettiPieces());
    });
  }, []);

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
          width: `${piece.width}px`,
          height: `${piece.height}px`,
          backgroundColor: piece.color,
          borderRadius: piece.isRound ? '50%' : '2px',
          '--confetti-drift': `${piece.drift}vw`,
          '--confetti-spin': `${piece.spin}deg`
        };
        return <span key={piece.id} className="welcome-confetti-piece absolute -top-3" style={style} />;
      })}
    </div>
  );
}
