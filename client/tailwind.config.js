/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        blood: {
          light: '#fb7185',
          DEFAULT: '#e11d48',
          dark: '#9f1239',
          soft: '#fff1f2',
        }
      }
    },
  },
  plugins: [],
}
