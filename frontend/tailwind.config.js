/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // BCN design system
        bcn: {
          orange: '#E8622A',
          blue:   '#4D84D4',
          green:  '#3CB887',
          amber:  '#C98E2E',
          red:    '#D45555',
          purple: '#8B6AD4',
          // surfaces
          card:   '#141414',
          card2:  '#1C1C1C',
          line:   '#262626',
          line2:  '#1A1A1A',
        },
        // Legacy neon (kept for map layer colors)
        neon: {
          green:  '#00ff88',
          blue:   '#00aaff',
          yellow: '#ffcc00',
          red:    '#ff3333',
        },
      },
      fontFamily: {
        syne: ['Syne', 'sans-serif'],
        mono: ['Instrument Mono', 'monospace'],
      },
      backdropBlur: {
        xs: '2px',
      },
    },
  },
  plugins: [],
}
