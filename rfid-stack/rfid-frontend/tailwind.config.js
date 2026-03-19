/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Cormorant Garamond"', 'serif'],
        ui:      ['"Syne"', 'sans-serif'],
        mono:    ['"JetBrains Mono"', 'monospace'],
      },
      colors: {
        ink:  { DEFAULT:'#0c0c0e', 2:'#141418', 3:'#1e1e24', 4:'#2a2a33', 5:'#363642' },
        muted:{ DEFAULT:'#52525f', 2:'#7a7a8a', 3:'#a0a0b0', 4:'#c8c8d8' },
        cream:{ DEFAULT:'#f5f0e8', 2:'#ede6d8' },
        gold: { DEFAULT:'#c9a84c', 2:'#e2c47a', dim:'rgba(201,168,76,0.15)' },
        ok:   { DEFAULT:'#4caf7d', dim:'rgba(76,175,125,0.12)' },
        warn: { DEFAULT:'#d4a520', dim:'rgba(212,165,32,0.12)' },
        danger:{ DEFAULT:'#c0392b', dim:'rgba(192,57,43,0.12)' },
      },
      boxShadow: {
        glow: '0 0 40px rgba(201,168,76,0.08)',
        'glow-lg': '0 0 80px rgba(201,168,76,0.12)',
      },
      animation: {
        'slide-in':    'slideIn 0.3s ease',
        'fade-up':     'fadeUp 0.4s ease',
        'pulse-slow':  'pulse 3s ease-in-out infinite',
        'scan-ping':   'scanPing 1.5s ease-in-out infinite',
      },
      keyframes: {
        slideIn:  { from:{ opacity:'0', transform:'translateX(-8px)' }, to:{ opacity:'1', transform:'translateX(0)' } },
        fadeUp:   { from:{ opacity:'0', transform:'translateY(10px)' }, to:{ opacity:'1', transform:'translateY(0)' } },
        scanPing: { '0%,100%':{ boxShadow:'0 0 0 0 rgba(201,168,76,0.5)' }, '50%':{ boxShadow:'0 0 0 16px rgba(201,168,76,0)' } },
      },
    },
  },
  plugins: [],
};
