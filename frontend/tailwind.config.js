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
        ink: {
          DEFAULT: '#17191c',
          black: '#17191c',
        },
        paper: '#ffffff',
        mist: {
          DEFAULT: '#f2f2f3',
          gray: '#f2f2f3',
        },
        fog: {
          DEFAULT: '#fafafb',
          white: '#fafafb',
          light: '#F3F4F6',
          dark: '#D1D5DB',
        },
        slate: {
          DEFAULT: '#777b86',
          gray: '#777b86',
        },
        ash: {
          DEFAULT: '#979799',
          gray: '#979799',
        },
        smoke: {
          DEFAULT: '#a3a6af',
          gray: '#a3a6af',
        },
        peach: {
          DEFAULT: '#fbe1d1',
          blush: '#fbe1d1',
        },
        sienna: {
          DEFAULT: '#5d2a1a',
          brown: '#5d2a1a',
        },
        hairline: '#ececec',
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
        canvas: {
          DEFAULT: '#F8F9FA',
          alt: '#F3F4F6',
        },
        alert: {
          yellow: '#ffdd00',
        }
      },
      fontFamily: {
        serif: ['"Playfair Display"', 'Georgia', 'ui-serif', 'serif'],
        sans: ['"Inter Tight"', 'Inter', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', 'sans-serif'],
      },
      borderRadius: {
        '3xl': '24px',
        '2xl': '16px',
        'xl': '12px',
        'pill': '9999px',
      },
      boxShadow: {
        'steep-subtle': '0 0 0 1px rgba(0,0,0,0.05), 0 4px 24px 0 rgba(0,0,0,0.06)',
        'steep-card': '0 0 0 1px rgba(4,23,43,0.05), 0 20px 25px -5px rgba(0,0,0,0.06), 0 8px 10px -6px rgba(0,0,0,0.04)',
      }
    },
  },
  plugins: [],
}
