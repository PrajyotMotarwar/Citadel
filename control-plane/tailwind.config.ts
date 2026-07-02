import type { Config } from 'tailwindcss';

export default {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#08111f',
        panel: '#0f1c2e',
        cyan: '#53d5ff',
        lime: '#b8f34a',
        muted: '#8ea5bd',
      },
      boxShadow: {
        glow: '0 0 50px rgba(83, 213, 255, 0.12)',
      },
    },
  },
  plugins: [],
} satisfies Config;
