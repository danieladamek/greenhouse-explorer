import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import type * as $3DmolNS from '3dmol';
import { useTheme } from '@/lib/theme';
import type { AtomRecord, Structure } from '@/types';
import type { Highlight } from './groups';
import { measure, midpoint, type Vec3 } from './measure';

type Mol = typeof $3DmolNS;
type Viewer = ReturnType<Mol['createViewer']>;

import type { StyleName, ViewerOptions } from './options';
export type { StyleName, SurfaceMode, ViewerOptions } from './options';
export { DEFAULT_VIEWER_OPTIONS } from './options';

export interface MolViewerHandle {
  resetView: () => void;
  pngURI: () => string | null;
  getView: () => number[] | null;
  setView: (v: number[]) => void;
  requestFullscreen: () => void;
  rotate: (deg: number, axis: 'x' | 'y') => void;
  zoom: (factor: number) => void;
  getAtomPositions: () => Vec3[] | null;
}

interface Props {
  sdfUrl: string;
  structure: Structure;
  /** Per-atom records (from the detail file). Optional: without them charges, CIP labels and element-aware highlights are skipped. */
  atoms?: AtomRecord[] | null;
  options: ViewerOptions;
  highlights?: Highlight[];
  picked?: number[];
  onAtomClick?: (index: number) => void;
  onViewChange?: (view: number[]) => void;
  onReady?: () => void;
  label: string;
  className?: string;
  testKey?: string;
}

// the viewer canvas sits on the page's paper (K5.1 manila / warm night)
const BG = { light: '#efe3c6', dark: '#1a1712' };
const PICK_COLOR = '#ffd43b';

/** 3Dmol accepts arrays for any selection property at runtime; its typings only declare scalars. */
const sel = (serials: number[]) => ({ serial: serials } as unknown as $3DmolNS.AtomSelectionSpec);

function baseStyle(style: StyleName, color?: string) {
  const c = color ? { color } : {};
  switch (style) {
    case 'stick': return { stick: { radius: 0.2, ...c } };
    case 'spacefill': return { sphere: { scale: 1.0, ...c } };
    case 'wireframe': return { line: { linewidth: 2, ...c } };
    default: return { stick: { radius: 0.14, ...c }, sphere: { scale: 0.26, ...c } };
  }
}

declare global {
  interface Window { __bxViewers?: Record<string, unknown> }
}

// The 3Dmol bundle is ~170 kB gzipped; load it once, after the first paint, and share the promise.
let molPromise: Promise<Mol> | null = null;
function load3Dmol(): Promise<Mol> {
  if (!molPromise) {
    molPromise = new Promise<void>((resolve) => {
      const w = window as unknown as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => void };
      if (w.requestIdleCallback) w.requestIdleCallback(() => resolve(), { timeout: 800 }); else setTimeout(resolve, 50);
    }).then(() => import('3dmol'));
  }
  return molPromise;
}

const MolViewer = forwardRef<MolViewerHandle, Props>(function MolViewer(
  { sdfUrl, structure, atoms = null, options, highlights = [], picked = [], onAtomClick, onViewChange, onReady, label, className = '', testKey },
  ref,
) {
  const { theme, reducedMotion } = useTheme();
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<Viewer | null>(null);
  const molRef = useRef<Mol | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const clickRef = useRef(onAtomClick);
  const viewChangeRef = useRef(onViewChange);
  const applyingView = useRef(false);
  const decorated = useRef(false); // whether labels/shapes have ever been added
  const surfaced = useRef(false);
  clickRef.current = onAtomClick;
  viewChangeRef.current = onViewChange;

  // create viewer + load model (3Dmol itself is imported lazily)
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    let cancelled = false;
    let viewer: Viewer | null = null;
    setReady(false);
    Promise.all([load3Dmol(), fetch(sdfUrl).then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.text(); })])
      .then(([mol, sdf]) => {
        if (cancelled) return;
        molRef.current = mol;
        viewer = mol.createViewer(el, { backgroundColor: document.documentElement.classList.contains('dark') ? BG.dark : BG.light, antialias: true, disableFog: true });
        viewerRef.current = viewer;
        viewer.addModel(sdf, 'sdf');
        viewer.setClickable({}, true, (atom: { serial: number }) => clickRef.current?.(atom.serial));
        viewer.setViewChangeCallback((v: number[]) => { if (!applyingView.current) viewChangeRef.current?.(v); });
        viewer.zoomTo();
        if (testKey) { window.__bxViewers = window.__bxViewers ?? {}; window.__bxViewers[testKey] = viewer; }
        setReady(true); // the style effect performs the first render
        onReady?.();
      })
      .catch((e: Error) => { if (!cancelled) setError(e.message); });
    const ro = new ResizeObserver(() => { viewerRef.current?.resize(); });
    ro.observe(el);
    const onFs = () => viewerRef.current?.resize();
    document.addEventListener('fullscreenchange', onFs);
    return () => {
      cancelled = true;
      ro.disconnect();
      document.removeEventListener('fullscreenchange', onFs);
      try { viewerRef.current?.clear(); } catch { /* ignore */ }
      el.innerHTML = '';
      viewerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sdfUrl]);

  // per-atom Gasteiger charges (for the charge-coloured surface) once atoms are known
  useEffect(() => {
    const v = viewerRef.current;
    if (!v || !ready || !atoms) return;
    const list = v.getModel().selectedAtoms({}) as { serial?: number; properties?: Record<string, unknown> }[];
    list.forEach((a) => { const rec = atoms[a.serial ?? -1]; a.properties = { ...(a.properties ?? {}), partialCharge: rec ? rec.q : 0 }; });
  }, [ready, atoms]);

  // background follows theme
  useEffect(() => {
    const v = viewerRef.current;
    if (!v || !ready) return;
    v.setBackgroundColor(theme === 'dark' ? BG.dark : BG.light, 1);
    v.render();
  }, [theme, ready]);

  // styles: base + hydrogens + group highlights + picked atoms (also performs the first render)
  useEffect(() => {
    const v = viewerRef.current;
    if (!v || !ready) return;
    v.setStyle({}, baseStyle(options.style));
    if (!options.hydrogens) v.setStyle({ elem: 'H' }, {});
    highlights.forEach((h) => {
      const list = options.hydrogens ? h.atoms : h.atoms.filter((i) => i < structure.heavyAtomCount);
      if (list.length) v.setStyle(sel(list), baseStyle(options.style === 'wireframe' ? 'stick' : options.style, h.color));
    });
    if (picked.length) v.addStyle(sel(picked), { sphere: { scale: 0.36, color: PICK_COLOR } });
    v.render();
  }, [ready, options.style, options.hydrogens, highlights, picked, structure]);

  // labels, CIP labels, measurement shapes (skipped entirely while nothing needs drawing)
  useEffect(() => {
    const v = viewerRef.current;
    if (!v || !ready) return;
    const wants = options.labels || options.cip || picked.length > 0;
    if (!wants && !decorated.current) return;
    v.removeAllLabels();
    v.removeAllShapes();
    decorated.current = wants;
    const dark = theme === 'dark';
    const list = v.getModel().selectedAtoms({}) as (Vec3 & { serial: number; elem: string })[];
    const labelStyle = { fontSize: 11, fontColor: dark ? '#efe6d3' : '#2a231a', backgroundColor: dark ? '#252019' : '#f7efdc', backgroundOpacity: 0.75, borderThickness: 0, inFront: true, alignment: 'center' as const };
    if (options.labels) {
      list.forEach((a) => {
        if (!options.hydrogens && a.elem === 'H') return;
        v.addLabel(`${a.elem}${a.serial}`, { ...labelStyle, position: { x: a.x, y: a.y, z: a.z } });
      });
    }
    if (options.cip && atoms) {
      atoms.forEach((rec) => {
        if (!rec.cip) return;
        const a = list[rec.i];
        if (!a) return;
        v.addLabel(rec.cip, { ...labelStyle, fontSize: 13, fontColor: '#2a231a', backgroundColor: PICK_COLOR, backgroundOpacity: 0.95, position: { x: a.x + 0.35, y: a.y + 0.35, z: a.z } });
      });
    }
    const pts = picked.map((i) => list[i]).filter(Boolean);
    if (pts.length >= 2) {
      for (let i = 0; i < pts.length - 1; i++) {
        v.addCylinder({ start: pts[i], end: pts[i + 1], radius: 0.06, color: PICK_COLOR, dashed: true, fromCap: 1, toCap: 1 });
      }
      const m = measure(pts);
      if (m) {
        const pos = pts.length === 2 ? midpoint(pts[0], pts[1]) : pts.length === 3 ? pts[1] : midpoint(pts[1], pts[2]);
        v.addLabel(m.label, { ...labelStyle, fontSize: 14, fontColor: '#2a231a', backgroundColor: PICK_COLOR, backgroundOpacity: 0.95, position: { x: pos.x, y: pos.y + 0.6, z: pos.z } });
      }
    }
    v.render();
  }, [ready, options.labels, options.cip, options.hydrogens, picked, theme, atoms]);

  // surfaces (skipped while none is requested and none is shown)
  useEffect(() => {
    const v = viewerRef.current;
    const mol = molRef.current;
    if (!v || !mol || !ready) return;
    if (options.surface === 'none' && !surfaced.current) return;
    v.removeAllSurfaces();
    surfaced.current = options.surface !== 'none';
    if (options.surface !== 'none') {
      const scheme = options.surface === 'charge'
        ? { colorscheme: { prop: 'partialCharge', gradient: new mol.Gradient.RWB(-0.35, 0.35) } }
        : { colorscheme: 'Jmol' };
      void v.addSurface(mol.SurfaceType.VDW, { opacity: options.surfaceOpacity, ...scheme }, {});
    }
    v.render();
  }, [ready, options.surface, options.surfaceOpacity]);

  // spin (never auto-starts; the control is disabled under reduced motion)
  useEffect(() => {
    const v = viewerRef.current;
    if (!v || !ready) return;
    const on = options.spin && !reducedMotion;
    if (on) v.spin('y'); else if (v.isAnimated?.() || options.spin === false) v.spin(false);
  }, [ready, options.spin, reducedMotion]);

  useImperativeHandle(ref, () => ({
    resetView: () => { const v = viewerRef.current; if (v) { v.zoomTo(); v.render(); } },
    pngURI: () => viewerRef.current?.pngURI() ?? null,
    getView: () => viewerRef.current?.getView() ?? null,
    setView: (view) => {
      const v = viewerRef.current; if (!v) return;
      applyingView.current = true;
      try { v.setView(view); } finally { applyingView.current = false; }
    },
    requestFullscreen: () => { containerRef.current?.parentElement?.requestFullscreen?.(); },
    rotate: (d, axis) => { const v = viewerRef.current; if (v) { v.rotate(d, axis); v.render(); } },
    zoom: (f) => { const v = viewerRef.current; if (v) { v.zoom(f); v.render(); } },
    getAtomPositions: () => {
      const v = viewerRef.current; if (!v) return null;
      const m = v.getModel(); if (!m) return null;
      return (m.selectedAtoms({}) as Vec3[]).map((a) => ({ x: a.x, y: a.y, z: a.z }));
    },
  }), []);

  const onKey = (e: React.KeyboardEvent) => {
    const v = viewerRef.current; if (!v) return;
    const map: Record<string, () => void> = {
      ArrowLeft: () => v.rotate(-10, 'y'), ArrowRight: () => v.rotate(10, 'y'), ArrowUp: () => v.rotate(-10, 'x'), ArrowDown: () => v.rotate(10, 'x'),
      '+': () => v.zoom(1.2), '=': () => v.zoom(1.2), '-': () => v.zoom(0.8), Home: () => v.zoomTo(),
    };
    const fn = map[e.key];
    if (fn) { e.preventDefault(); fn(); v.render(); }
  };

  return (
    <div className={`bx-viewer h-full w-full ${className}`} data-ready={ready ? '1' : '0'}>
      <div
        ref={containerRef}
        className="h-full w-full rounded-lg"
        role="img"
        aria-label={`${label}. Interactive 3D model: drag to rotate, scroll or pinch to zoom, click an atom to inspect it. Keyboard: arrow keys rotate, plus and minus zoom, Home resets.`}
        tabIndex={0}
        onKeyDown={onKey}
      />
      {!ready && !error && <p className="absolute inset-0 flex items-center justify-center text-sm bx-muted" role="status">Loading 3D model…</p>}
      {error && <p className="absolute inset-0 flex items-center justify-center text-sm text-red-700 dark:text-red-300 p-4 text-center" role="alert">Could not load the 3D structure ({error}).</p>}
    </div>
  );
});

export default MolViewer;
