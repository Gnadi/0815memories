/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        cream: '#FAF5EE',
        terra: {
          DEFAULT: '#C4472A',
          dark: '#9E3520',
          light: '#D4633F',
        },
        hearth: {
          bg: '#FAF5EE',
          card: '#FFFFFF',
          text: '#1A1A1A',
          muted: '#6B6B6B',
          border: '#E8E0D5',
        },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
      },
      boxShadow: {
        card: '0 2px 12px rgba(0,0,0,0.07)',
        'card-hover': '0 6px 24px rgba(0,0,0,0.11)',
      },
    },
  },
  plugins: [],
}
