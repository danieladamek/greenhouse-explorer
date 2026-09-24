import { useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { sectionsIndex } from '@/lib/data';
import { useNotepad } from '@/lib/notepad-context';
import { fromMarkdown, groupBySection, type AnchorType } from '@/lib/notepad';
import { exportNotes, NoteEditor, useAnchorIndex } from '@/components/notepad/NotepadPanel';

/**
 * The notepad as a page (APP-SPEC §2 /notes, §3.1), ported from apps/ptsd-inflammation-critique: notes anchored to
 * sections, terms, concepts, compounds, plants, preparations, figures and references, in reading order; export is
 * Markdown organised by section with anchors and quotes. Every word is the reader's.
 */
const TYPE_LABEL: Record<AnchorType, string> = {
  section: 'a primer section', term: 'a glossary term', concept: 'a concept', compound: 'a compound', taxon: 'a plant',
  preparation: 'a preparation', figure: 'a figure', ref: 'a reference', free: 'nothing',
};
export default function Notes() {
  const np = useNotepad();
  const idx = useAnchorIndex();
  const fileRef = useRef<HTMLInputElement>(null);
  const [type, setType] = useState<AnchorType>('taxon');
  const [anchorId, setAnchorId] = useState('');
  const groups = useMemo(() => (idx ? groupBySection(np.state, idx) : []), [np.state, idx]);
  const options = useMemo(() => {
    if (!idx) return [] as { id: string; label: string }[];
    if (type === 'section') return sectionsIndex.map((s) => ({ id: s.id, label: s.title }));
    if (type === 'ref') return [...idx.refs.entries()].map(([n, r]) => ({ id: String(n), label: `[${n}] ${r.label.slice(0, 70)}` }));
    if (type === 'free') return [];
    const map = { term: idx.terms, concept: idx.concepts, compound: idx.compounds, taxon: idx.taxa, preparation: idx.preparations, figure: idx.figures }[type];
    return [...map.entries()].map(([id, x]) => ({ id, label: x.label })).sort((a, b) => a.label.localeCompare(b.label));
  }, [idx, type]);
  const add = () => {
    if (type !== 'free' && !anchorId) return;
    np.addNote({ type, id: type === 'free' ? '' : anchorId });
  };
  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-3xl sm:text-4xl">Notes</h1>
      <p className="bx-prose mt-2">
        Your notes, in reading order. Anchor a note to a primer section, a plant, a compound, a preparation, a term, a concept, a figure or a reference.
        {np.file === 'saved' || np.file === 'saving' ? ' They live in this browser and are autosaved to notes/notepad.md in the app folder; export them as Markdown any time.' : ''}
      </p>
      {np.file !== 'saved' && np.file !== 'saving' && <p className="mt-2 text-sm font-semibold" data-testid="notes-storage">Saved in this browser only — export to keep a copy.</p>}
      <section className="bx-card p-3 mt-5 text-sm no-print" aria-labelledby="new-h">
        <h2 id="new-h" className="text-lg">New note</h2>
        <div className="mt-2 grid gap-2 sm:grid-cols-[10rem_minmax(0,1fr)_auto] items-end">
          <label className="block"><span className="block text-xs bx-muted mb-1">Anchor to</span>
            <select className="bx-input" value={type} onChange={(e) => { setType(e.target.value as AnchorType); setAnchorId(''); }} data-testid="anchor-type">
              {(Object.keys(TYPE_LABEL) as AnchorType[]).map((t) => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
            </select></label>
          {type !== 'free' ? (
            <label className="block min-w-0"><span className="block text-xs bx-muted mb-1">Which</span>
              <select className="bx-input" value={anchorId} onChange={(e) => setAnchorId(e.target.value)} data-testid="anchor-id"><option value="">choose…</option>{options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}</select></label>
          ) : <span />}
          <button type="button" className="bx-btn-primary" onClick={add} disabled={type !== 'free' && !anchorId} data-testid="add-anchored-note">Add note</button>
        </div>
      </section>
      <div className="mt-4 flex flex-wrap gap-2 no-print">
        <button type="button" className="bx-btn" disabled={!idx || !np.state.notes.length} onClick={() => idx && exportNotes(np.state, idx)} data-testid="export-notes">Export Markdown (by section)</button>
        <button type="button" className="bx-btn" onClick={() => fileRef.current?.click()}>Import Markdown</button>
        <input ref={fileRef} type="file" accept=".md,text/markdown,text/plain" className="sr-only" aria-label="Import notes from a Markdown file" onChange={async (e) => { const f = e.target.files?.[0]; if (f) np.dispatch({ type: 'merge', notes: fromMarkdown(await f.text()) }); e.target.value = ''; }} />
        <span className="text-sm bx-muted self-center" role="status">{np.state.notes.length} note{np.state.notes.length === 1 ? '' : 's'}</span>
      </div>
      {!idx ? <p className="mt-6 bx-muted" role="status">Loading…</p> : groups.length === 0 ? <p className="mt-6 bx-muted">No notes yet. Select text on <Link className="underline" to="/read">Read</Link>, use “✎ Note” on a plant or compound page, or add one above.</p> : (
        <div className="mt-6 grid gap-8">
          {groups.map((g) => (
            <section key={g.key} aria-labelledby={`ng-${g.key}`}>
              <h2 id={`ng-${g.key}`} className="text-xl">{g.title}</h2>
              <ul className="mt-2 grid gap-2">{g.notes.map((n) => <NoteEditor key={n.id} note={n} idx={idx} autoFocus={np.focusId === n.id} />)}</ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
