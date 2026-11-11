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
        // Monochromatic clinical blueprint palette (Ui / shadcn)
        canvas: {
          DEFAULT: '#f5f5f5',
          alt: '#f0f0f0',
        },
        paper: '#ffffff',
        surface: {
          DEFAULT: '#fafafa',
          alt: '#fafafa',
        },
        ink: {
          DEFAULT: '#0a0a0a',
          soft: '#171717',
          black: '#0a0a0a',
        },
        midgray: {
          DEFAULT: '#737373',
          gray: '#737373',
        },
        hairline: '#e5e5e5',
        ember: {
          DEFAULT: '#e7000b',
          dark: '#c4000a',
        },
        // Legacy fallbacks preserved for business components
        navy: {
          DEFAULT: '#0a0a0a',
          dark: '#000000',
          light: '#171717',
          50: '#f5f5f5',
          100: '#e5e5e5',
          500: '#0a0a0a',
          600: '#171717',
          900: '#000000',
        },
        nude: {
          DEFAULT: '#737373',
          dark: '#525252',
          light: '#f5f5f5',
          50: '#fafafa',
          100: '#f5f5f5',
          200: '#e5e5e5',
        },
        fog: {
          DEFAULT: '#e5e5e5',
          white: '#fafafa',
          light: '#f5f5f5',
          dark: '#737373',
        },
        slate: {
          DEFAULT: '#737373',
          gray: '#737373',
        },
        ash: {
          DEFAULT: '#737373',
          gray: '#737373',
        },
        smoke: {
          DEFAULT: '#a3a3a3',
          gray: '#a3a3a3',
        },
        mist: {
          DEFAULT: '#f5f5f5',
          gray: '#f5f5f5',
        },
        peach: {
          DEFAULT: '#f5f5f5',
          blush: '#f5f5f5',
        },
        sienna: {
          DEFAULT: '#0a0a0a',
          brown: '#0a0a0a',
        },
        alert: {
          yellow: '#e7000b',
        }
      },
      fontFamily: {
        geist: ['"Geist"', '"Inter"', 'ui-sans-serif', 'system-ui', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', 'sans-serif'],
        sans: ['"Geist"', '"Inter Tight"', '"Inter"', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', 'sans-serif'],
      },
      borderRadius: {
        '3xl': '24px',
        '2xl': '18px',
        'xl': '14px',
        'lg': '10px',
        'md': '6px',
        'pill': '18px',
      },
      boxShadow: {
        'ui-card': '0 0 0 1px rgba(23,23,23,0.05), 0 1px 3px rgba(0,0,0,0.1), 0 1px 2px -1px rgba(0,0,0,0.1)',
        'ui-subtle': '0 0 0 1px rgba(23,23,23,0.05)',
        'steep-subtle': '0 0 0 1px rgba(23,23,23,0.05), 0 1px 3px rgba(0,0,0,0.08)',
        'steep-card': '0 0 0 1px rgba(23,23,23,0.05), 0 1px 3px rgba(0,0,0,0.1), 0 1px 2px -1px rgba(0,0,0,0.1)',
      }
    },
  },
  plugins: [],
}
