import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        terminal: {
          bg:      '#050505',
          surface: '#0e0e0e',
          raised:  '#141414',
          border:  '#1c1c1c',
          muted:   '#2a2a2a',
          text:    '#d4d4d4',
          dim:     '#6b6b6b',
          faint:   '#3a3a3a',
          amber:   '#f59e0b',
          'amber-dim': '#78501a',
          red:     '#ef4444',
          green:   '#22c55e',
        },
      },
    },
  },
  plugins: [],
};

export default config;
