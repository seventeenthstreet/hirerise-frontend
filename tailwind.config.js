/** @type {import('tailwindcss').Config} */

/**
 * tailwind.config.js — HireRise Tailwind Foundation
 *
 * Maps semantic CSS tokens defined in globals.css to Tailwind utility classes.
 *
 * PATTERN: All color values use `hsl(var(--token))` so Tailwind's opacity
 * modifier syntax works correctly: bg-primary/10, text-muted-foreground/50, etc.
 *
 * IMPORTANT: Do NOT add new hardcoded colors here. All colors should flow
 * through the CSS custom property system in globals.css.
 */
module.exports = {
  // Dark mode via class strategy — add class="dark" to <html>
  darkMode: 'class',

  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],

  theme: {
    extend: {
      // ── Semantic Color Tokens ──────────────────────────────────────────────
      // Maps to CSS vars in globals.css — enables:
      //   bg-background, text-foreground, border-border,
      //   bg-primary, text-primary-foreground, bg-muted, etc.
      colors: {
        background:  'hsl(var(--background))',
        foreground:  'hsl(var(--foreground))',

        card: {
          DEFAULT:    'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },

        primary: {
          DEFAULT:    'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },

        muted: {
          DEFAULT:    'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },

        border:      'hsl(var(--border))',
        input:       'hsl(var(--input))',
        ring:        'hsl(var(--ring))',

        destructive: {
          DEFAULT:    'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },

        success: {
          DEFAULT:    'hsl(var(--success))',
          foreground: 'hsl(var(--success-foreground))',
        },

        warning: {
          DEFAULT:    'hsl(var(--warning))',
          foreground: 'hsl(var(--warning-foreground))',
        },
      },

      // ── Border Radius ─────────────────────────────────────────────────────
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },

      // ── Max Width ─────────────────────────────────────────────────────────
      // Preserves max-w-7xl usage across the codebase
      maxWidth: {
        '7xl': '80rem',
      },
    },
  },

  plugins: [],
};
