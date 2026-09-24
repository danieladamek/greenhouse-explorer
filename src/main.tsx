import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { fontsAfterLoad, fontsBeforeFirstRender } from '@/lib/fonts';
import './index.css';

// The metric-matched fallback faces are local() system fonts, but Chrome still resolves them asynchronously; render
// once they are ready (a few ms, capped at 150 ms), and on a returning visit once the cached web fonts are applied, so
// the first frame already uses its final faces and nothing re-wraps later (src/lib/fonts.ts).
const FALLBACKS = ['400 1em "Source Sans 3 Fallback"', '700 1em "Source Sans 3 Fallback"', 'italic 400 1em "Source Sans 3 Fallback"',
  '400 1em "Fraunces Fallback"', '600 1em "Fraunces Fallback"', 'italic 400 1em "Fraunces Fallback"', '400 1em "JetBrains Mono Fallback"'];
const ready = document.fonts?.load ? Promise.all(FALLBACKS.map((f) => document.fonts.load(f).catch(() => []))) : Promise.resolve();
const render = () => ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
void Promise.all([Promise.race([ready, new Promise((r) => setTimeout(r, 150))]), fontsBeforeFirstRender()]).then(() => { render(); fontsAfterLoad(); });
