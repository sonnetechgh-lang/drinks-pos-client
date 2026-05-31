/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        'bg-canvas': '#EFF6FF',
        'bg-card': '#FFFFFF',
        'bg-sidebar': '#FFFFFF',
        'bg-overlay': 'rgba(0,0,0,0.35)',
        'brand-blue': '#2563EB',
        'brand-blue-light': '#DBEAFE',
        'brand-blue-dark': '#1D4ED8',
        'success': '#22C55E',
        'success-light': '#DCFCE7',
        'danger': '#EF4444',
        'danger-light': '#FEE2E2',
        'warning': '#F59E0B',
        'warning-light': '#FEF3C7',
        'info': '#3B82F6',
        'text-primary': '#111827',
        'text-secondary': '#6B7280',
        'text-muted': '#9CA3AF',
        'border': '#E5E7EB',
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
