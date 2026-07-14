/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ['class', '[data-theme="dark"]'],
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        blue: {
          DEFAULT: '#2563EB',
          light: '#5B8DEF',
          deep: '#173E9E',
        },
        gold: {
          DEFAULT: '#FBBF24',
          deep: '#B8860B',
        },
        green: '#34D399',
        red: '#F87171',
      },
      fontFamily: {
        display: ['"Space Grotesk"', 'Inter', 'sans-serif'],
        body: ['Inter', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      borderRadius: {
        sm: '12px',
        md: '18px',
        lg: '26px',
        xl: '32px',
      },
      transitionTimingFunction: {
        premium: 'cubic-bezier(.22,1,.36,1)',
      },
      keyframes: {
        heroRise: {
          from: { opacity: '0', transform: 'translateY(22px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        glassBreathe: {
          '0%, 100%': { backdropFilter: 'blur(20px) saturate(140%)' },
          '50%': { backdropFilter: 'blur(26px) saturate(160%)' },
        },
      },
      animation: {
        'hero-rise': 'heroRise .8s cubic-bezier(.22,1,.36,1) both',
        'glass-breathe': 'glassBreathe 12s ease-in-out infinite',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};
