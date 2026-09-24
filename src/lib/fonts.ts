/**
 * The bundled faces (K5.1 §2): Fraunces (display), Source Sans 3 (body), JetBrains Mono (identifiers). The woff2 files
 * ship in dist/ (fontsource packages, imported as URLs) — never fetched from anywhere else.
 *
 * When they are applied, so a font swap never moves a page the reader is looking at (CLS) and never competes with the
 * route's code and data on a slow connection (LCP):
 *  - returning visit (the files are in the HTTP cache): loaded and applied before the first render, so the first frame
 *    already uses them;
 *  - first visit: downloaded in the background a few seconds after the page has loaded, and applied on the reader's
 *    first navigation
 *    (a user-initiated change, which layout-shift scoring excludes). Until then the page uses metric-matched fallback
 *    faces (index.css), sized to the same text widths.
 */
import fraunces from '@fontsource-variable/fraunces/files/fraunces-latin-opsz-normal.woff2?url';
import sans400 from '@fontsource/source-sans-3/files/source-sans-3-latin-400-normal.woff2?url';
import sans400i from '@fontsource/source-sans-3/files/source-sans-3-latin-400-italic.woff2?url';
import sans700 from '@fontsource/source-sans-3/files/source-sans-3-latin-700-normal.woff2?url';
import mono from '@fontsource-variable/jetbrains-mono/files/jetbrains-mono-latin-wght-normal.woff2?url';

const LATIN = 'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD';
const FACES: [string, string, FontFaceDescriptors][] = [
  ['Fraunces Variable', fraunces, { weight: '100 900', style: 'normal' }],
  ['Source Sans 3', sans400, { weight: '400', style: 'normal' }],
  ['Source Sans 3', sans400i, { weight: '400', style: 'italic' }],
  ['Source Sans 3', sans700, { weight: '700', style: 'normal' }],
  ['JetBrains Mono Variable', mono, { weight: '100 800', style: 'normal' }],
];
const KEY = 'gx-fonts-cached';

let faces: FontFace[] | null = null;
let loaded: Promise<FontFace[]> | null = null;
let applied = false;

function load(): Promise<FontFace[]> {
  if (!loaded) {
    faces = FACES.map(([family, url, d]) => new FontFace(family, `url(${url}) format('woff2')`, { display: 'swap', unicodeRange: LATIN, ...d }));
    loaded = Promise.all(faces.map((f) => f.load())).then((fs) => { try { localStorage.setItem(KEY, '1'); } catch { /* ignore */ } return fs; });
  }
  return loaded;
}

export function applyFonts(): void {
  if (applied) return;
  void load().then((fs) => { if (applied) return; applied = true; fs.forEach((f) => document.fonts.add(f)); });
}

/** Before the first render: on a returning visit, wait (briefly) for the cached files and apply them at once. */
export function fontsBeforeFirstRender(): Promise<unknown> {
  if (typeof FontFace === 'undefined' || !document.fonts) return Promise.resolve();
  let cached = false;
  try { cached = localStorage.getItem(KEY) === '1'; } catch { /* ignore */ }
  if (!cached) return Promise.resolve();
  return Promise.race([load().then(() => applyFonts()), new Promise((r) => setTimeout(r, 200))]).catch(() => undefined);
}

/** First visit: fetch after load (then on idle), apply on the first in-app navigation. */
export function fontsAfterLoad(): void {
  if (typeof FontFace === 'undefined' || !document.fonts || applied) return;
  const start = () => { void load().catch(() => undefined); };
  // a few seconds after load, on idle: well clear of the page's own code, data and images on a slow connection
  const idle = () => setTimeout(() => ('requestIdleCallback' in window ? (window as unknown as { requestIdleCallback: (f: () => void, o?: { timeout: number }) => void }).requestIdleCallback(start, { timeout: 3000 }) : start()), 4000);
  if (document.readyState === 'complete') idle(); else window.addEventListener('load', idle, { once: true });
}
