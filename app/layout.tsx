import type { Metadata } from 'next';
import { ClerkProvider } from '@clerk/nextjs';
import { ThemeProvider } from '@/components/ThemeProvider';
import { WelcomeConfetti } from '@/components/WelcomeConfetti';
import { RealtimeProvider } from '@/components/RealtimeProvider';
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
        <ClerkProvider>
          <ThemeProvider>
            <RealtimeProvider>
              {children}
              <WelcomeConfetti />
            </RealtimeProvider>
          </ThemeProvider>
        </ClerkProvider>
      </body>
    </html>
  );
}
