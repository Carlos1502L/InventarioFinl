/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          DEFAULT: '#1A2035',
          dark: '#121624',
          light: '#242B45',
          lighter: '#2E3655',
          subtle: '#3A4468',
        },
        orange: {
          DEFAULT: '#FF6B00',
          hover: '#E55F00',
          light: '#FFF2E8',
          subtle: '#FFE6D5'
        },
        surface: {
          DEFAULT: '#F8F9FA',
          white: '#FFFFFF',
          card: '#FFFFFF',
          muted: '#F1F3F5'
        },
        brand: {
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
        }
      },
      borderRadius: {
        'card': '12px'
      }
    },
  },
  plugins: [],
}
