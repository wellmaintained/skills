/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/client/index.html', './src/client/src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        beads: {
          open: '#6b7280',
          inprogress: '#2563eb',
          blocked: '#dc2626',
          completed: '#16a34a',
        },
      },
    },
  },
  plugins: [],
};
