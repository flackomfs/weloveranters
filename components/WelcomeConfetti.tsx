'use client';

import { useUser } from '@clerk/nextjs';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState, type CSSProperties } from 'react';

type ConfettiPiece = {
  id: number;
  left: number;
  width: number;
  height: number;
  color: string;
  drift: number;
  spin: number;
  fallDuration: number;
  delay: number;
  tumbleDuration: number;
  shape: 'square' | 'ribbon' | 'triangle' | 'circle';
};

type ConfettiStyle = CSSProperties & {
  '--confetti-drift': string;
  '--confetti-spin': string;
  '--confetti-color': string;
  '--confetti-delay': string;
  '--confetti-fall-duration': string;
  '--confetti-tumble-duration': string;
};

const colors = ['#8b5cf6', '#ec4899', '#38bdf8', '#fbbf24', '#34d399', '#fb7185', '#f97316', '#e879f9'];

function createConfettiPieces(): ConfettiPiece[] {
  return Array.from({ length: 160 }, (_, id) => {
    const shapeRoll = Math.random();
    const shape = shapeRoll < 0.18
      ? 'triangle'
      : shapeRoll < 0.4
        ? 'ribbon'
        : shapeRoll < 0.58
          ? 'circle'
          : 'square';
    const isRibbon = shape === 'ribbon';
    const isCircle = shape === 'circle';
    const delay = Math.random() * 0.45;

    return {
      id,
      left: Math.random() * 100,
      width: isRibbon ? 3 + Math.random() * 3 : isCircle ? 5 + Math.random() * 4 : 6 + Math.random() * 5,
      height: isRibbon ? 12 + Math.random() * 13 : isCircle ? 5 + Math.random() * 4 : 7 + Math.random() * 8,
      color: colors[Math.floor(Math.random() * colors.length)],
      drift: (Math.random() - 0.5) * 34,
      spin: (Math.random() > 0.5 ? 1 : -1) * (360 + Math.random() * 720),
      fallDuration: 3 - delay,
      delay,
      tumbleDuration: 0.55 + Math.random() * 0.75,
      shape
    };
  });
}

export function WelcomeConfetti() {
  const pathname = usePathname();
  const [pieces, setPieces] = useState<ConfettiPiece[]>([]);
  const { isLoaded, isSignedIn } = useUser();
  const hasCelebrated = useRef(false);

  useEffect(() => {
    if (!isLoaded || isSignedIn) return;
    hasCelebrated.current = false;
    setPieces([]);
  }, [isLoaded, isSignedIn]);

  useEffect(() => {
    if (!isLoaded || !isSignedIn || pathname !== '/feed' || hasCelebrated.current) return;
    hasCelebrated.current = true;
    setPieces(createConfettiPieces());
  }, [isLoaded, isSignedIn, pathname]);

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
          top: '-0.75rem',
          width: `${piece.width}px`,
          height: `${piece.height}px`,
          '--confetti-drift': `${piece.drift}vw`,
          '--confetti-spin': `${piece.spin}deg`,
          '--confetti-color': piece.color,
          '--confetti-delay': `${piece.delay}s`,
          '--confetti-fall-duration': `${piece.fallDuration}s`,
          '--confetti-tumble-duration': `${piece.tumbleDuration}s`
        };
        return (
          <span
            key={piece.id}
            data-confetti-shape={piece.shape}
            className="welcome-confetti-piece absolute"
            style={style}
          />
        );
      })}
    </div>
  );
}
