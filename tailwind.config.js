// tailwind.config.js
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/**/*.{js,jsx,ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: '#FFD400',    // amarelo DevBrota
        secondary: '#000000',  // preto
        accent: '#FFFFFF',     // branco
      },
      fontFamily: {
        sans: ['Poppins', 'sans-serif'],
        heading: ['Poppins', 'sans-serif'],
      },
      spacing: {
        '1': '0.25rem',  // 4px
        '2': '0.5rem',   // 8px
        '3': '0.75rem',  // 12px
        '4': '1rem',     // 16px
        '6': '1.5rem',   // 24px
        '8': '2rem',     // 32px
        '10': '2.5rem',  // 40px
        '12': '3rem',    // 48px
      },
    },
  },
  
  plugins: [],
}
