/** @type {import('tailwindcss').Config} */
// fam.* = manifest.palette.groups, keyed by botanical family (used for taxa, and for compounds via palette_group).
// cat.* = the design-system categorical slots, used for glossary-kind chips and chart series.
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Iowan Old Style"', '"Palatino Linotype"', 'Palatino', '"Book Antiqua"', 'Georgia', 'serif'],
        body: ['"Avenir Next"', 'Avenir', '"Segoe UI"', '"Gill Sans"', 'system-ui', 'sans-serif'],
        mono: ['"SF Mono"', 'Menlo', 'Consolas', 'monospace'],
      },
      colors: {
        ink: { DEFAULT: '#1f1b16', muted: '#5d5750' },
        paper: { DEFAULT: '#faf8f4', 2: '#f1ede6' },
        night: { DEFAULT: '#15130f', 2: '#211d18', ink: '#efeae2', muted: '#b3aca1' },
        cat: { a: '#2a5aa6', b: '#7b2c5e', c: '#1f7a63', d: '#a85a1f', e: '#4a4a8a', f: '#8a6d1f' },
        fam: {
          lamiaceae: '#2f7d4f', asteraceae: '#d49a1c', brassicaceae: '#3b6fb6', apiaceae: '#8a5fb0', amaryllidaceae: '#c2527a',
          solanaceae: '#c8452f', amaranthaceae: '#7a3b2e', fabaceae: '#5f9e2f', cucurbitaceae: '#1f9c9c', shared: '#6b6b6b',
        },
      },
    },
  },
  plugins: [],
};
