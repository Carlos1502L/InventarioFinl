/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        yape: {
          DEFAULT: '#742384',
          dark: '#581865',
          light: '#9b30b0'
        },
        plin: {
          DEFAULT: '#00bfa5',
          dark: '#008e7b',
          light: '#33d6bf'
        },
        mercadopago: {
          DEFAULT: '#009ee3',
          dark: '#007bb2',
          light: '#33b5ec'
        }
      }
    },
  },
  plugins: [],
}
