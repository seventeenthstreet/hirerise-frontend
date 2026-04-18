import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    './src/features/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-body)', 'sans-serif'],
        display: ['var(--font-display)', 'sans-serif'],
        mono: ['var(--font-mono)', 'monospace'],
      },
      colors: {
        hr: {
          50:  '#f0f4ff',
          100: '#e0eaff',
          200: '#c1d3fe',
          300: '#93b4fd',
          400: '#608bfa',
          500: '#3d65f6',
          600: '#2546eb',
          700: '#1d35d8',
          800: '#1e2faf',
          900: '#1e2d8a',
          950: '#161e5c',
        },
        // ─── Surface palette ──────────────────────────────────────────────────
        // This is a DARK-FIRST design system.
        // Low numbers = dark backgrounds  |  High numbers = light text
        //
        // Usage guide:
        //   bg-surface-950  → page background (darkest)
        //   bg-surface-900  → sidebar / section background
        //   bg-surface-800  → card background
        //   bg-surface-700  → subtle hover / divider
        //   bg-surface-600  → muted / disabled element
        //   text-surface-500 → placeholder text
        //   text-surface-400 → secondary / muted text
        //   text-surface-300 → body text
        //   text-surface-200 → primary text
        //   text-surface-100 → bright / heading text
        //   text-surface-50  → near-white text
        //   text-surface-0   → pure white
        //
        // LIGHT COMPONENTS (inputs, badges on white bg) use bg-white and
        // text-surface-900 / text-surface-800 directly via Tailwind defaults.
        surface: {
          0:   '#ffffff',  // Pure white (light component text)
          50:  '#f8f9fc',  // Near-white text / light bg
          100: '#f1f3f9',  // Bright text
          200: '#e4e8f2',  // Primary text
          300: '#c9d0e4',  // Body text
          400: '#9aa3be',  // Secondary / muted text
          500: '#6b7594',  // Placeholder / disabled text
          600: '#4a5270',  // Muted element
          700: '#2e3555',  // Subtle hover / divider
          800: '#1c2033',  // Card background
          900: '#12152a',  // Sidebar / section background
          950: '#0b0e1c',  // Page background (darkest)
        },
      },
      boxShadow: {
        'card':    '0 1px 3px 0 rgb(0 0 0 / 0.06), 0 1px 2px -1px rgb(0 0 0 / 0.06)',
        'card-md': '0 4px 12px 0 rgb(0 0 0 / 0.08), 0 2px 4px -1px rgb(0 0 0 / 0.04)',
        'card-lg': '0 8px 24px 0 rgb(0 0 0 / 0.10), 0 4px 8px -2px rgb(0 0 0 / 0.06)',
      },
      animation: {
        'fade-in':  'fadeIn 0.2s ease-out',
        'slide-up': 'slideUp 0.25s ease-out',
        'skeleton': 'skeleton 1.6s ease-in-out infinite',
      },
      keyframes: {
        fadeIn:   { from: { opacity: '0' }, to: { opacity: '1' } },
        slideUp:  { from: { opacity: '0', transform: 'translateY(8px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        skeleton: { '0%, 100%': { opacity: '1' }, '50%': { opacity: '0.4' } },
      },
    },
  },
  plugins: [],
};

export default config;