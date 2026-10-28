/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/renderer/index.html',
    './src/renderer/src/**/*.{js,ts,jsx,tsx}'
  ],
  theme: {
    extend: {
      colors: {
        apple: {
          bg: '#1C1C1E',
          card: '#2C2C2E',
          border: '#3A3A3C',
          muted: '#8E8E93',
          blue: '#0A84FF',
          green: '#34C759',
          red: '#FF3B30',
          orange: '#FF9500'
        }
      }
    }
  },
  plugins: []
}
