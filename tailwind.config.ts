import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx,mdx}'
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#fff3f6',
          100: '#ffe4ed',
          200: '#ffc7d5',
          300: '#fe9db9',
          400: '#fb6f9b',
          500: '#f64d87',
          600: '#e5447a',
          700: '#c52e63',
          800: '#a32e57',
          900: '#852c4d'
        }
      },
      boxShadow: {
        soft: '0 10px 30px rgba(15, 23, 42, 0.08)'
      }
    }
  },
  plugins: []
};

export default config;
