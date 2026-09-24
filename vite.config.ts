/// <reference types="vitest" />
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, URL } from 'node:url';
import { localEndpoints } from './scripts/local-endpoints';

/** SPA deep links need a 404.html that is a copy of index.html (the GitHub Pages fallback, as in Bioactive Explorer). */
function spaFallback(): Plugin {
  return {
    name: 'spa-404-fallback',
    apply: 'build',
    closeBundle() {
      const dist = path.resolve(fileURLToPath(new URL('./dist', import.meta.url)));
      const index = path.join(dist, 'index.html');
      if (fs.existsSync(index)) fs.copyFileSync(index, path.join(dist, '404.html'));
    },
  };
}

// BASE_PATH deploys the same build to a GitHub Pages project site, e.g. BASE_PATH=/greenhouse-explorer/.
// localEndpoints(): dev/preview-server middleware only (the notepad's file autosave, APP-SPEC §3.1); absent from dist/.
export default defineConfig({
  base: process.env.BASE_PATH ?? '/',
  plugins: [react(), spaFallback(), localEndpoints(fileURLToPath(new URL('.', import.meta.url)))],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        // function form, so the JSX runtime and scheduler land in the react chunk rather than wherever first imported
        manualChunks(id: string) {
          if (!id.includes('node_modules')) return undefined;
          if (/node_modules\/(react|react-dom|react-router|react-router-dom|scheduler|@remix-run)\//.test(id)) return 'react';
          // everything maths goes with KaTeX (micromark-extension-math imports katex), so plain Markdown never pulls it in
          if (/node_modules\/(katex|remark-math|rehype-katex|micromark-extension-math|mdast-util-math|hast-util-from-html|hast-util-from-dom|hast-util-from-html-isomorphic|hast-util-from-parse5|parse5|hastscript|web-namespaces|vfile-location)\b/.test(id)) return 'katex';
          if (/node_modules\/(recharts|recharts-scale|victory-vendor|d3-(?!force|scale$))/.test(id)) return 'charts';
          if (/node_modules\/(react-markdown|remark-|mdast-|micromark|unified|hast-|unist-|vfile|property-information|space-separated|comma-separated|decode-named|character-entities|trim-lines|devlop|bail|trough|is-plain-obj|zwitch|longest-streak|markdown-table|ccount|escape-string|html-url|estree|style-to|inline-style)/.test(id)) return 'markdown';
          if (/node_modules\/smiles-drawer\//.test(id)) return 'smiles';
          if (/node_modules\/3dmol\//.test(id)) return 'mol3d';
          return undefined;
        },
      },
    },
  },
  test: {
    environment: 'node',
    include: ['tests/unit/**/*.test.ts'],
  },
});
