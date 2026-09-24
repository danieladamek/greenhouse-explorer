/**
 * The notepad (APP-SPEC §3.1), ported from apps/ptsd-inflammation-critique (commit afb9dab). Pure state +
 * serialisation, so it is unit-tested and survives content rebuilds: notes are keyed to stable ids and an anchor
 * that disappears from the pack is kept and reported as orphaned — never dropped.
 *
 * Adapted to this app's objects (the one change APP-SPEC §3.1 asks for): a note hangs on a reader section, a
 * glossary term, a concept, a compound, a taxon (plant page), a preparation, a figure or a reference — or on
 * nothing. The export is organised by section in reading order; a note on a catalogue object files under the
 * first primer section that mentions it, or under "Catalogue and library" when none does.
 */

export type AnchorType = 'section' | 'term' | 'concept' | 'compound' | 'taxon' | 'preparation' | 'figure' | 'ref' | 'free';
export const ANCHOR_TYPES: AnchorType[] = ['section', 'term', 'concept', 'compound', 'taxon', 'preparation', 'figure', 'ref', 'free'];
export interface Anchor { type: AnchorType; id: string }
export interface Note { id: string; anchor: Anchor; quote?: string; body: string; created: string; updated: string }
export interface NotepadState { version: 2; notes: Note[] }

export const emptyNotepad = (): NotepadState => ({ version: 2, notes: [] });

export type NotepadAction =
  | { type: 'add'; note: Omit<Note, 'id' | 'created' | 'updated'> & { id?: string; created?: string } }
  | { type: 'update'; id: string; body?: string; anchor?: Anchor; quote?: string }
  | { type: 'remove'; id: string }
  | { type: 'replace'; state: NotepadState }
  | { type: 'merge'; notes: Note[] }
  | { type: 'clear' };

let counter = 0;
export function newId(now = Date.now()): string {
  counter = (counter + 1) % 1e6;
  return `n-${now.toString(36)}-${counter.toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

export function reducer(state: NotepadState, action: NotepadAction, now: () => string = () => new Date().toISOString()): NotepadState {
  switch (action.type) {
    case 'add': {
      const t = now();
      const note: Note = { id: action.note.id ?? newId(), anchor: action.note.anchor, quote: action.note.quote, body: action.note.body, created: action.note.created ?? t, updated: t };
      return { ...state, notes: [...state.notes, note] };
    }
    case 'update':
      return { ...state, notes: state.notes.map((n) => (n.id === action.id ? { ...n, body: action.body ?? n.body, anchor: action.anchor ?? n.anchor, quote: action.quote ?? n.quote, updated: now() } : n)) };
    case 'remove':
      return { ...state, notes: state.notes.filter((n) => n.id !== action.id) };
    case 'replace':
      return normalise(action.state);
    case 'merge': {
      const byId = new Map(state.notes.map((n) => [n.id, n]));
      for (const n of action.notes) {
        const prev = byId.get(n.id);
        if (!prev || prev.updated < n.updated) byId.set(n.id, n);
      }
      return { ...state, notes: [...byId.values()] };
    }
    case 'clear':
      return emptyNotepad();
  }
}

/** Accept anything that looks like a saved state (v2), or a v1 single-text notepad, and return a valid v2 state. */
export function normalise(raw: unknown): NotepadState {
  if (!raw || typeof raw !== 'object') return emptyNotepad();
  const r = raw as { version?: number; notes?: unknown; text?: unknown };
  if (Array.isArray(r.notes)) {
    const notes = r.notes.filter((n): n is Note => !!n && typeof n === 'object' && typeof (n as Note).id === 'string' && typeof (n as Note).body === 'string' && !!(n as Note).anchor)
      .map((n) => ({ ...n, anchor: { type: (ANCHOR_TYPES.includes(n.anchor.type) ? n.anchor.type : 'free') as AnchorType, id: String(n.anchor.id ?? '') } }));
    return { version: 2, notes };
  }
  if (typeof r.text === 'string' && r.text.trim()) {
    const t = new Date().toISOString();
    return { version: 2, notes: [{ id: newId(), anchor: { type: 'free', id: '' }, body: r.text, created: t, updated: t }] };
  }
  return emptyNotepad();
}

// ------------------------------------------------------------------------------------------ resolving anchors
export interface Labelled { label: string; sections: string[] }
export interface AnchorIndex {
  sections: { id: string; title: string; number: string | null }[];   // reading order
  terms: Map<string, Labelled>;
  concepts: Map<string, Labelled>;
  compounds: Map<string, Labelled>;
  taxa: Map<string, Labelled>;
  preparations: Map<string, Labelled>;
  figures: Map<string, Labelled>;
  refs: Map<number, Labelled>;
}

export interface ResolvedAnchor { ok: boolean; label: string; section: string | null; to: string }

const ROUTE: Record<Exclude<AnchorType, 'section' | 'free'>, (id: string) => string> = {
  term: (id) => `/glossary#${id}`,
  concept: (id) => `/concepts/${id}`,
  compound: (id) => `/compounds/${id}`,
  taxon: (id) => `/plants/${id}`,
  preparation: (id) => `/tea#${id}`,
  figure: (id) => `/figures/${id}`,
  ref: (id) => `/references#ref-${id}`,
};
const NOUN: Record<Exclude<AnchorType, 'section' | 'free'>, string> = {
  term: 'term', concept: 'concept', compound: 'compound', taxon: 'plant', preparation: 'preparation', figure: 'figure', ref: 'reference',
};

export function resolveAnchor(a: Anchor, idx: AnchorIndex): ResolvedAnchor {
  if (a.type === 'section') {
    const s = idx.sections.find((x) => x.id === a.id);
    return { ok: !!s, label: s ? `section ${s.number ? `§${s.number} ` : ''}${s.title.replace(/^\d+(\.\d+)*\.?\s+/, '')}` : `section ${a.id}`, section: s ? s.id : null, to: `/read#${a.id}` };
  }
  if (a.type === 'free') return { ok: true, label: 'unanchored', section: null, to: '/notes' };
  const map = { term: idx.terms, concept: idx.concepts, compound: idx.compounds, taxon: idx.taxa, preparation: idx.preparations, figure: idx.figures }[a.type as 'term'];
  const hit = a.type === 'ref' ? idx.refs.get(Number(a.id)) : map?.get(a.id);
  const sec = hit?.sections.find((s) => idx.sections.some((x) => x.id === s)) ?? null;
  const label = a.type === 'ref' ? `reference [${a.id}]` : `${NOUN[a.type]} ${hit?.label ?? a.id}`;
  return { ok: !!hit, label, section: sec, to: ROUTE[a.type](a.id) };
}

export interface NoteGroup { key: string; title: string; notes: (Note & { resolved: ResolvedAnchor })[] }

/** Notes grouped in reading order, then catalogue & library, then unanchored, then orphaned anchors. */
export function groupBySection(state: NotepadState, idx: AnchorIndex): NoteGroup[] {
  const groups = new Map<string, NoteGroup>();
  for (const s of idx.sections) groups.set(s.id, { key: s.id, title: s.number ? `§${s.number} ${s.title.replace(/^\d+(\.\d+)*\.?\s+/, '')}` : s.title, notes: [] });
  const extra = { lib: { key: '_library', title: 'Catalogue and library (not tied to a primer section)', notes: [] as NoteGroup['notes'] }, free: { key: '_free', title: 'Unanchored', notes: [] as NoteGroup['notes'] }, orphan: { key: '_orphan', title: 'Anchors no longer in the pack (re-anchor these)', notes: [] as NoteGroup['notes'] } };
  const sorted = [...state.notes].sort((a, b) => (a.created < b.created ? -1 : a.created > b.created ? 1 : 0));
  for (const n of sorted) {
    const r = resolveAnchor(n.anchor, idx);
    const item = { ...n, resolved: r };
    if (!r.ok) extra.orphan.notes.push(item);
    else if (r.section && groups.has(r.section)) groups.get(r.section)!.notes.push(item);
    else if (n.anchor.type === 'free') extra.free.notes.push(item);
    else extra.lib.notes.push(item);
  }
  return [...groups.values(), extra.lib, extra.free, extra.orphan].filter((g) => g.notes.length);
}

// ------------------------------------------------------------------------------------------ Markdown export / import
const MARK = 'bx-note';

export function toMarkdown(state: NotepadState, idx: AnchorIndex, meta: { title: string; slug: string; date?: string }): string {
  const out: string[] = [
    `# Notes — ${meta.title}`,
    '',
    `_Exported ${meta.date ?? new Date().toISOString().slice(0, 10)} from ${meta.title} (${meta.slug}). Organised by section in reading order; each note keeps its anchor and the quote it hangs on. Every note below was written by you._`,
    '',
  ];
  for (const g of groupBySection(state, idx)) {
    out.push(`## ${g.title}`, '');
    for (const n of g.notes) {
      out.push(`### ${n.resolved.label}`, '');
      if (n.quote) { out.push(...n.quote.split('\n').map((l) => `> ${l}`), ''); }
      out.push(n.body.trim() || '_(empty note)_', '');
      const metaJson = JSON.stringify({ id: n.id, anchor: n.anchor, quote: n.quote, created: n.created, updated: n.updated });
      out.push(`<!-- ${MARK} ${metaJson.replace(/--/g, '\\u002d\\u002d')} -->`, '');
    }
  }
  return out.join('\n');
}

/** Parse an exported file back into notes. A Markdown file without note markers becomes one unanchored note. */
export function fromMarkdown(md: string): Note[] {
  const re = new RegExp(`^### [^\\n]*\\n([\\s\\S]*?)<!-- ${MARK} (\\{[\\s\\S]*?\\}) -->`, 'gm');
  const notes: Note[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(md))) {
    let meta: Partial<Note>;
    try { meta = JSON.parse(m[2]) as Partial<Note>; } catch { continue; }
    const lines = m[1].split('\n');
    let i = 0;
    while (i < lines.length && (lines[i].startsWith('>') || !lines[i].trim())) i++;
    let body = lines.slice(i).join('\n').trim();
    if (body === '_(empty note)_') body = '';
    if (!meta.id || !meta.anchor) continue;
    const t = new Date().toISOString();
    notes.push({ id: meta.id, anchor: meta.anchor, quote: meta.quote, body, created: meta.created ?? t, updated: meta.updated ?? t });
  }
  if (!notes.length && md.trim()) {
    const t = new Date().toISOString();
    notes.push({ id: newId(), anchor: { type: 'free', id: '' }, body: md.trim(), created: t, updated: t });
  }
  return notes;
}
