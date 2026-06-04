/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        'bg-canvas': 'rgb(var(--bg-canvas) / <alpha-value>)',
        'bg-card': 'rgb(var(--bg-card) / <alpha-value>)',
        'bg-elevated': 'rgb(var(--bg-elevated) / <alpha-value>)',
        'bg-subtle': 'rgb(var(--bg-subtle) / <alpha-value>)',
        'bg-sidebar': 'rgb(var(--bg-sidebar) / <alpha-value>)',
        'bg-overlay': 'rgba(0,0,0,0.35)',
        'brand-blue': 'rgb(var(--primary) / <alpha-value>)',
        'brand-blue-light': 'rgb(var(--primary-light) / <alpha-value>)',
        'brand-blue-dark': 'rgb(var(--primary-hover) / <alpha-value>)',
        'success': 'rgb(var(--success) / <alpha-value>)',
        'success-light': 'rgb(var(--success-light) / <alpha-value>)',
        'danger': 'rgb(var(--danger) / <alpha-value>)',
        'danger-light': 'rgb(var(--danger-light) / <alpha-value>)',
        'warning': 'rgb(var(--warning) / <alpha-value>)',
        'warning-light': 'rgb(var(--warning-light) / <alpha-value>)',
        'info': 'rgb(var(--info) / <alpha-value>)',
        'text-primary': 'rgb(var(--text-primary) / <alpha-value>)',
        'text-secondary': 'rgb(var(--text-secondary) / <alpha-value>)',
        'text-muted': 'rgb(var(--text-muted) / <alpha-value>)',
        'border': 'rgb(var(--border) / <alpha-value>)',
      },
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'DM Sans', 'sans-serif'],
      },
      boxShadow: {
        float: '0 10px 24px rgba(15, 23, 42, 0.08)',
      },
      borderRadius: {
        '2xl': '12px',
        '3xl': '16px',
      },
    },
  },
  plugins: [],
}
