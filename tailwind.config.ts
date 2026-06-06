import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f0fdf4',
          100: '#dcfce7',
          500: '#22c55e',
          600: '#16a34a',
          700: '#15803d',
          900: '#14532d',
        },
        gold: { 400: '#facc15', 500: '#eab308', 600: '#ca8a04' },
        // GOAL26 semantic aliases (via CSS vars)
        wc: {
          bg:      'var(--bg)',
          surface: 'var(--surface)',
          's2':    'var(--surface-2)',
          ink:     'var(--ink)',
          'ink-2': 'var(--ink-2)',
          'ink-3': 'var(--ink-3)',
          line:    'var(--line)',
          navy:    'var(--navy)',
          accent:  'var(--accent)',
          live:    'var(--live)',
          win:     'var(--win)',
          gold:    'var(--gold)',
        },
      },
      fontFamily: {
        // GOAL26 type stack
        cond:  ['var(--f-cond)', 'system-ui', 'sans-serif'],
        body:  ['var(--f-body)', 'system-ui', 'sans-serif'],
        mono:  ['var(--f-mono)', 'monospace'],
        sans:  ['var(--f-body)', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        'wc-card':  '16px',
        'wc-large': '20px',
        'wc-pill':  '11px',
      },
      boxShadow: {
        'wc-card': '0 1px 2px rgba(20,22,40,0.04)',
        'wc-live': '0 0 0 1.5px var(--live), 0 6px 18px -8px rgba(224,60,44,0.5)',
      },
      keyframes: {
        'wc-ping': {
          '0%, 100%': { transform: 'scale(1)', opacity: '1' },
          '50%':      { transform: 'scale(2.2)', opacity: '0' },
        },
      },
      animation: {
        'wc-ping': 'wc-ping 1.6s cubic-bezier(0.25,0.46,0.45,0.94) infinite',
      },
    },
  },
  plugins: [],
}

export default config
