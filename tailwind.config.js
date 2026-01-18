/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Space Grotesk"', 'sans-serif'],
      },
      colors: {
        primary: {
          DEFAULT: '#88aaee',
          hover: '#7799dd',
        },
        secondary: '#aaddaa',
        accent: '#ffcc00',
        surface: '#FFFFFF',
        background: '#f8f9fa',
        border: '#000000',
      },
      boxShadow: {
        'neo': '4px 4px 0px 0px rgba(0,0,0,1)',
        'neo-sm': '2px 2px 0px 0px rgba(0,0,0,1)',
        'neo-lg': '8px 8px 0px 0px rgba(0,0,0,1)',
      },
      translate: {
        'box': '4px',
      }
    }
  },
  plugins: [],
}