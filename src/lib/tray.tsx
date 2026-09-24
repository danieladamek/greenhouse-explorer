import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

/**
 * The compare tray (Bioactive Explorer pattern, feature E2), with two lanes: compounds for /compare?ids= and
 * plants for /compare?plants=. Kept for the browser session; 2–4 of either can be compared.
 */
export type TrayKind = 'compounds' | 'plants';
export const TRAY_MAX = 4;

interface TrayCtx {
  compounds: string[];
  plants: string[];
  toggle: (kind: TrayKind, id: string) => void;
  remove: (kind: TrayKind, id: string) => void;
  clear: (kind?: TrayKind) => void;
  has: (kind: TrayKind, id: string) => boolean;
  full: (kind: TrayKind) => boolean;
}

const empty: TrayCtx = { compounds: [], plants: [], toggle: () => {}, remove: () => {}, clear: () => {}, has: () => false, full: () => false };
const Ctx = createContext<TrayCtx>(empty);

function load(): { compounds: string[]; plants: string[] } {
  try {
    const s = sessionStorage.getItem('bx-tray-v2');
    if (s) { const j = JSON.parse(s) as { compounds?: string[]; plants?: string[] }; return { compounds: (j.compounds ?? []).slice(0, TRAY_MAX), plants: (j.plants ?? []).slice(0, TRAY_MAX) }; }
  } catch { /* storage blocked: start empty */ }
  return { compounds: [], plants: [] };
}

export function TrayProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState(load);
  useEffect(() => { try { sessionStorage.setItem('bx-tray-v2', JSON.stringify(state)); } catch { /* ignore */ } }, [state]);
  const toggle = useCallback((kind: TrayKind, id: string) => setState((s) => {
    const list = s[kind];
    const next = list.includes(id) ? list.filter((x) => x !== id) : list.length >= TRAY_MAX ? list : [...list, id];
    return { ...s, [kind]: next };
  }), []);
  const remove = useCallback((kind: TrayKind, id: string) => setState((s) => ({ ...s, [kind]: s[kind].filter((x) => x !== id) })), []);
  const clear = useCallback((kind?: TrayKind) => setState((s) => (kind ? { ...s, [kind]: [] } : { compounds: [], plants: [] })), []);
  const value = useMemo<TrayCtx>(() => ({
    compounds: state.compounds, plants: state.plants, toggle, remove, clear,
    has: (k, id) => state[k].includes(id), full: (k) => state[k].length >= TRAY_MAX,
  }), [state, toggle, remove, clear]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useTray = () => useContext(Ctx);
