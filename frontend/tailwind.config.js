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
          DEFAULT: '#1E3A5F',
          dark: '#142740',
          light: '#284E7E',
          50: '#F0F4F8',
          100: '#D9E3ED',
          500: '#1E3A5F',
          600: '#172E4C',
          900: '#0F1E32',
        },
        nude: {
          DEFAULT: '#E8B4A0',
          dark: '#D89E88',
          light: '#F5D3C6',
          50: '#FAF0EB',
          100: '#F5E1D8',
          200: '#E8B4A0',
        },
        paper: '#ffffff',
        canvas: {
          DEFAULT: '#F8F9FA',
          alt: '#F3F4F6',
        },
        fog: {
          DEFAULT: '#E5E7EB',
          light: '#F3F4F6',
          dark: '#D1D5DB',
        },
        alert: {
          yellow: '#ffdd00',
        }
      },
      borderRadius: {
        '2xl': '16px',
      }
    },
  },
  plugins: [],
}
