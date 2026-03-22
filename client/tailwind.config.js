/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        navy: '#0E1B2E',
        'navy-light': '#162844',
        orange: '#F05001',
        'orange-hover': '#D94800',
        offwhite: '#F5F3F0',
        stone: '#8A8278',
        'stone-light': '#A89F94',
        status: {
          green: '#22c55e',
          yellow: '#eab308',
          red: '#ef4444',
          blue: '#3b82f6',
        },
        tier: {
          crisis: '#dc2626',
          survival: '#F05001',
          stability: '#eab308',
          healthy: '#22c55e',
          wealth: '#f59e0b',
        },
      },
      fontFamily: {
        sora: ['Sora', 'sans-serif'],
        mulish: ['Mulish', 'sans-serif'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        shimmer: 'shimmer 1.5s infinite',
      },
      keyframes: {
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
    },
  },
  plugins: [],
};
