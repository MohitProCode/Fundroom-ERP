/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
        },
      },
    },
  },
  plugins: [],
  safelist: [
    'bg-cyan-400', 'bg-violet-400', 'bg-amber-400', 'bg-emerald-400', 'bg-rose-400',
    'bg-cyan-400/10', 'bg-violet-400/10', 'bg-rose-400/10',
    'text-cyan-300', 'text-violet-300', 'text-rose-300',
  ],
}
