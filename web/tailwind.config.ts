import type { Config } from 'tailwindcss'
import echoesPreset from '../../shared/design-tokens/tailwind-preset'

const config: Config = {
  presets: [echoesPreset],
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    '../../shared/design-tokens/**/*.{js,ts,jsx,tsx,mdx,json}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Echoes design system - Notion-like gray scale
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
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
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
