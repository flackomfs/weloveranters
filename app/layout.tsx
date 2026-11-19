import type { Metadata } from 'next';
import { ThemeProvider } from '@/components/ThemeProvider';
import { WelcomeConfetti } from '@/components/WelcomeConfetti';
import './globals.css';

export const metadata: Metadata = {
  title: 'WeLoveRanters',
  description: 'A social venting platform where users can share their unfiltered thoughts and support each other.',
  icons: {
    icon: '/favicon.png',
    apple: '/favicon.png'
  },
  appleWebApp: {
    capable: true,
    title: 'WeLoveRanters',
    statusBarStyle: 'default'
  }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ThemeProvider>
          {children}
          <WelcomeConfetti />
        </ThemeProvider>
      </body>
    </html>
  );
}
