/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        nordic: {
          DEFAULT: '#26433A',
          dark: '#1b312a',
          hover: '#1e362e',
          light: '#32564b',
        },
        alabaster: {
          DEFAULT: '#F7F5F0',
          card: '#FDFCF9',
          surface: '#FAF7F2',
          border: '#E8E5DF',
        },
        botanical: {
          DEFAULT: '#E7EFEA',
          light: '#F0F5F2',
          dark: '#D5E3DA',
          border: '#D0DFD6',
        },
        terracotta: {
          DEFAULT: '#D97742',
          dark: '#c16533',
          hover: '#e08350',
          light: '#FAEDE6',
        },
        emeraldStatus: {
          DEFAULT: '#2E7D5B',
          bg: '#D6E8DE',
          border: '#BFE0CD',
        }
      },
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'Inter', 'system-ui', '-apple-system', 'sans-serif'],
        editorial: ['Plus Jakarta Sans', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        '3xl': '1.75rem',
        '4xl': '2.25rem',
      },
      boxShadow: {
        'soft': '0 4px 20px -2px rgba(38, 67, 58, 0.06)',
        'lifted': '0 12px 32px -4px rgba(38, 67, 58, 0.12)',
      }
    },
  },
  plugins: [],
}
