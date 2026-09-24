/** @type {import('tailwindcss').Config} */
// fam.* = manifest.palette.groups, keyed by botanical family (used for taxa, and for compounds via palette_group).
// cat.* = the design-system categorical slots, used for glossary-kind chips and chart series.
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Fraunces Variable"', '"Fraunces Fallback"', '"Iowan Old Style"', 'Georgia', 'serif'],
        body: ['"Source Sans 3"', '"Source Sans 3 Fallback"', '"Avenir Next"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono Variable"', '"JetBrains Mono Fallback"', '"SF Mono"', 'Menlo', 'monospace'],
      },
      colors: {
        // K5.1 §3: manila light, warm night dark
        ink: { DEFAULT: '#2a231a', muted: '#5f5442' },  // muted darkened from #6b5f4b to clear AA on paper-2
        paper: { DEFAULT: '#efe3c6', 2: '#e6d7b3', card: 'rgb(247 239 220 / 0.85)' },
        night: { DEFAULT: '#1a1712', 2: '#252019', card: 'rgb(42 36 28 / 0.85)', ink: '#efe6d3', muted: '#b8ab94' },
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
