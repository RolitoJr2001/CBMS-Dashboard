/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          950: '#061425',
          900: '#0a1f38',
          800: '#0e2c4f',
          700: '#133b68',
          600: '#1a4d85',
        },
        teal: {
          900: '#0b3d3a',
          800: '#0f534e',
          700: '#136a63',
          600: '#178379',
          500: '#1c9c90',
          400: '#3fb6a9',
        },
        status: {
          green: '#1f9d55',
          greenBg: '#e6f6ec',
          yellow: '#c79a12',
          yellowBg: '#fbf2db',
          red: '#d23c3c',
          redBg: '#fbe7e7',
        }
      },
      fontFamily: {
        sans: ['Inter', 'Segoe UI', 'system-ui', 'sans-serif'],
        display: ['"Source Serif 4"', 'Georgia', 'serif'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(10, 31, 56, 0.04), 0 6px 16px rgba(10, 31, 56, 0.08)',
        cardHover: '0 4px 8px rgba(10, 31, 56, 0.06), 0 12px 28px rgba(10, 31, 56, 0.14)',
      },
      backgroundImage: {
        'gov-pattern': "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.06) 1px, transparent 0)",
      }
    },
  },
  plugins: [],
}
