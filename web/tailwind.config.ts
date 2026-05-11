import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      // ===== Design token preset (inlined from shared/design-tokens) =====
      screens: {
        mobile: { max: '767px' },
        tablet: { min: '768px', max: '1279px' },
        desktop: { min: '1280px' },
      },
      spacing: {
        'layout-sidebar': '200px',
        'layout-sidebar-collapsed': '48px',
        'layout-panel': '280px',
        'layout-header': '48px',
        'layout-dock': '56px',
        'content-timeline': '640px',
        'content-detail': '720px',
      },
      maxWidth: {
        'content-timeline': '640px',
        'content-detail': '720px',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['Geist', 'sans-serif'],
      },
      fontSize: {
        body: ['14px', { lineHeight: '1.5', fontWeight: '400' }],
        label: ['12px', { lineHeight: '1.25', fontWeight: '400' }],
        heading: ['20px', { lineHeight: '1.2', fontWeight: '600' }],
        display: ['28px', { lineHeight: '1.1', fontWeight: '600' }],
      },
      // ===== Existing Echoes theme =====
      colors: {
        // shadcn color tokens — map CSS variables to Tailwind utilities
        // Using raw var() because CSS variables contain OKLCH values (shadcn v4 style)
        background: 'var(--background)',
        foreground: 'var(--foreground)',
        card: {
          DEFAULT: 'var(--card)',
          foreground: 'var(--card-foreground)',
        },
        popover: {
          DEFAULT: 'var(--popover)',
          foreground: 'var(--popover-foreground)',
        },
        primary: {
          DEFAULT: 'var(--primary)',
          foreground: 'var(--primary-foreground)',
        },
        secondary: {
          DEFAULT: 'var(--secondary)',
          foreground: 'var(--secondary-foreground)',
        },
        muted: {
          DEFAULT: 'var(--muted)',
          foreground: 'var(--muted-foreground)',
        },
        accent: {
          DEFAULT: 'var(--accent)',
          foreground: 'var(--accent-foreground)',
        },
        destructive: {
          DEFAULT: 'var(--destructive)',
          foreground: 'var(--destructive-foreground)',
        },
        border: 'var(--border)',
        input: 'var(--input)',
        ring: 'var(--ring)',
        sidebar: {
          DEFAULT: 'var(--sidebar)',
          foreground: 'var(--sidebar-foreground)',
          primary: 'hsl(var(--sidebar-primary))',
          'primary-foreground': 'var(--sidebar-primary-foreground)',
          accent: 'var(--sidebar-accent)',
          'accent-foreground': 'var(--sidebar-accent-foreground)',
          border: 'var(--sidebar-border)',
          ring: 'var(--sidebar-ring)',
        },
        // Echoes design system - Notion-like gray scale (preserved)
        gray: {
          50: '#F7F7F7',
          100: '#EFEFEF',
          200: '#E0E0E0',
          300: '#CFCFCF',
          400: '#A0A0A0',
          500: '#808080',
          600: '#606060',
          700: '#404040',
          800: '#2D2D2D',
          900: '#1A1A1A',
        },
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-up': 'slideUp 0.3s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
}

export default config
