/** @type {import('tailwindcss').Config} */
// EasyFlow CFO brand (v2, Nov 23 2026). Colors and fonts come from the brand guide only.
// The old class names (font-sora, font-mulish, navy-light, stone) are kept so existing
// screens keep compiling; they now point at the brand fonts and colors.
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        navy: '#0E1B2E',
        'navy-light': '#162844',
        ink: '#0A2463',
        cobalt: '#1456D6',
        sky: '#3FA3FF',
        orange: '#F05001',
        'orange-hover': '#D84300',
        flame: '#F05001',
        amber: '#FFA51F',
        gold: '#FFC24D',
        cream: '#FFF7EE',
        offwhite: '#F5F3F0',
        ember: '#9A3412',
        pale: '#DCEBFF',
        slate: '#5B6577',
        stone: '#8A8278',
        'stone-light': '#A89F94',
        line: '#E7E2DB',
        status: {
          green: '#1456D6',
          yellow: '#FFA51F',
          red: '#9A3412',
          blue: '#1456D6',
        },
        tier: {
          crisis: '#9A3412',
          survival: '#F05001',
          stability: '#FFA51F',
          healthy: '#1456D6',
          wealth: '#0A2463',
        },
      },
      fontFamily: {
        heading: ['Montserrat', 'system-ui', 'sans-serif'],
        body: ['"Source Sans 3"', 'system-ui', 'sans-serif'],
        sora: ['Montserrat', 'system-ui', 'sans-serif'],
        mulish: ['"Source Sans 3"', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: '0 18px 40px -24px rgba(10,36,99,0.45)',
        flame: '0 10px 22px -12px rgba(240,80,1,0.75)',
        hairline: '0 1px 0 rgba(10,36,99,0.08)',
      },
      backgroundImage: {
        'glossy-cobalt': 'linear-gradient(135deg, #0A2463 0%, #1456D6 55%, #3FA3FF 100%)',
        'flame-btn': 'linear-gradient(135deg, #D84300 0%, #F05001 50%, #FF7A1A 100%)',
        'flame-btn-hover': 'linear-gradient(135deg, #C03B00 0%, #DE4A00 50%, #F26A10 100%)',
        'amber-text': 'linear-gradient(90deg, #FFA51F, #FFD27A)',
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
