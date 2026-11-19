import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'WeLoveRanters',
    short_name: 'WeLoveRanters',
    description: 'A social venting platform where users can share their thoughts and support each other.',
    start_url: '/feed',
    scope: '/',
    display: 'standalone',
    background_color: '#080b18',
    theme_color: '#8b5cf6',
    icons: [
      { src: '/favicon.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/favicon.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
    ]
  };
}
