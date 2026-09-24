import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from 'react';
import { emptyNotepad, normalise, reducer, toMarkdown, type Anchor, type NotepadAction, type NotepadState } from '@/lib/notepad';
import { loadAnchorIndex } from '@/lib/notes-index';
import { manifest, SLUG } from '@/lib/data';

/**
 * Notepad persistence (KICKOFF §4b, §8.5): localStorage keyed by manifest.slug, always. With
 * manifest.notes_storage = file, every change is also autosaved to notes/notepad.md (+ notepad.json) through
 * the dev/preview-server endpoint (scripts/local-endpoints.ts). The endpoint exists only under `npm run dev` /
 * `npm run preview` on localhost; anywhere else the request fails and the app falls back to localStorage silently.
 */
const KEY = `bx-notes:${SLUG}`;
const FILE_MODE = (manifest as { notes_storage?: string }).notes_storage === 'file';

interface Ctx {
  state: NotepadState;
  dispatch: (a: NotepadAction) => void;
  open: boolean; setOpen: (o: boolean) => void; toggle: () => void;
  addNote: (anchor: Anchor, quote?: string, body?: string) => string;
  focusId: string | null; setFocusId: (id: string | null) => void;
  file: 'unknown' | 'saved' | 'unavailable' | 'saving';
}
const NotepadCtx = createContext<Ctx | null>(null);

function load(): NotepadState {
  try { const raw = localStorage.getItem(KEY); return raw ? normalise(JSON.parse(raw)) : emptyNotepad(); } catch { return emptyNotepad(); }
}

export function NotepadProvider({ children }: { children: ReactNode }) {
  const [state, rawDispatch] = useReducer((s: NotepadState, a: NotepadAction) => reducer(s, a), undefined, load);
  const [open, setOpen] = useState(false);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [file, setFile] = useState<Ctx['file']>('unknown');
  const fileOk = useRef<boolean | null>(null);
  const dirty = useRef(false);

  // restore from the file autosave when this browser has no notes yet (e.g. a cleared profile)
  useEffect(() => {
    if (!FILE_MODE) { fileOk.current = false; setFile('unavailable'); return; }
    fetch('/__local/notes').then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status))))).then((j: { state: unknown }) => {
      fileOk.current = true; setFile('saved');
      if (j.state && load().notes.length === 0) {
        const restored = normalise(j.state);
        if (restored.notes.length) rawDispatch({ type: 'replace', state: restored });
      }
    }).catch(() => { fileOk.current = false; setFile('unavailable'); });
  }, []);

  const dispatch = useCallback((a: NotepadAction) => { dirty.current = true; rawDispatch(a); }, []);

  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* storage full or blocked: nothing else to do */ }
    if (!FILE_MODE || !dirty.current || fileOk.current === false) return;
    const t = setTimeout(() => {
      if (fileOk.current === false) return;
      setFile('saving');
      loadAnchorIndex().then((idx) => fetch('/__local/notes', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ state, markdown: toMarkdown(state, idx, { title: manifest.title, slug: SLUG }) }),
      })).then((r) => { fileOk.current = r.ok; setFile(r.ok ? 'saved' : 'unavailable'); }).catch(() => { fileOk.current = false; setFile('unavailable'); });
    }, 700);
    return () => clearTimeout(t);
  }, [state]);

  const addNote = useCallback((anchor: Anchor, quote?: string, body = '') => {
    const id = `n-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    dispatch({ type: 'add', note: { id, anchor, quote, body } });
    setFocusId(id);
    return id;
  }, [dispatch]);

  const value = useMemo<Ctx>(() => ({ state, dispatch, open, setOpen, toggle: () => setOpen((o) => !o), addNote, focusId, setFocusId, file }), [state, dispatch, open, addNote, focusId, file]);
  return <NotepadCtx.Provider value={value}>{children}</NotepadCtx.Provider>;
}

export function useNotepad(): Ctx {
  const c = useContext(NotepadCtx);
  if (!c) throw new Error('useNotepad outside NotepadProvider');
  return c;
}
