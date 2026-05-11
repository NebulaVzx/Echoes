import type { Config } from 'tailwindcss'

const preset: Partial<Config> = {
  theme: {
    extend: {
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
    },
  },
}

export default preset
