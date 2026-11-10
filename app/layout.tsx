import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'WeLoveRanters',
  description: 'A social venting platform where users can share their unfiltered thoughts and support each other.'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
