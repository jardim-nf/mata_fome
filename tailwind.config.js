module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
theme: {
  extend: {
    keyframes: {
      run: {
        '0%, 100%': { transform: 'translateX(0) rotate(-1deg)' },
        '50%': { transform: 'translateX(3px) rotate(1deg)' },
      },
    },
    animation: {
      run: 'run 0.4s ease-in-out infinite',
    },
  },
},
  plugins: [],
}