/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Space Grotesk"', 'sans-serif'],
      },
      colors: {
        primary: {
          DEFAULT: '#3b82f6', // Royal Blue
          hover: '#2563eb',
        },
        secondary: '#aaddaa',
        accent: '#ffcc00',
        surface: '#FFFFFF',
        background: '#FFF0F0', // Mist Rose
        border: '#000000',
      },
      boxShadow: {
        'neo': '0 0 0 0 rgba(0,0,0,0)', // Clean flat style
        'neo-sm': '2px 2px 0px 0px rgba(0,0,0,1)',
        'neo-lg': '8px 8px 0px 0px rgba(0,0,0,1)',
      }
    }
  },
  plugins: [],
}