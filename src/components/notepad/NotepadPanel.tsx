import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useNotepad } from '@/lib/notepad-context';
import { fromMarkdown, resolveAnchor, toMarkdown, type AnchorIndex, type Note } from '@/lib/notepad';
import { loadAnchorIndex } from '@/lib/notes-index';
import { getSection, manifest, SLUG } from '@/lib/data';
import { downloadBlob } from '@/components/figures/download';

export function useAnchorIndex(): AnchorIndex | undefined {
  const [idx, setIdx] = useState<AnchorIndex>();
  useEffect(() => { let live = true; loadAnchorIndex().then((x) => { if (live) setIdx(x); }); return () => { live = false; }; }, []);
  return idx;
}

export function exportNotes(state: Parameters<typeof toMarkdown>[0], idx: AnchorIndex) {
  const md = toMarkdown(state, idx, { title: manifest.title, slug: SLUG });
  downloadBlob(new Blob([md], { type: 'text/markdown;charset=utf-8' }), `${SLUG}-notes-${new Date().toISOString().slice(0, 10)}.md`);
}

export function NoteEditor({ note, idx, autoFocus }: { note: Note; idx?: AnchorIndex; autoFocus?: boolean }) {
  const { dispatch } = useNotepad();
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { if (autoFocus) ref.current?.focus(); }, [autoFocus]);
  const r = idx ? resolveAnchor(note.anchor, idx) : null;
  return (
    <li className="bx-card p-2.5" data-testid="note">
      <div className="flex items-baseline justify-between gap-2 text-xs">
        {r ? (r.ok ? <Link className="underline font-semibold" to={r.to}>{r.label}</Link> : <span className="bx-todo">{r.label} — no longer in the pack</span>) : <span>{note.anchor.type} {note.anchor.id}</span>}
        <button type="button" className="bx-muted hover:underline" onClick={() => { if (confirm('Delete this note?')) dispatch({ type: 'remove', id: note.id }); }} aria-label="Delete note">Delete</button>
      </div>
      {note.quote && <blockquote className="mt-1 border-l-2 border-[color:var(--bx-accent)] pl-2 text-xs bx-muted line-clamp-4">{note.quote}</blockquote>}
      <label className="sr-only" htmlFor={`note-${note.id}`}>Note on {r?.label ?? note.anchor.id}</label>
      <textarea id={`note-${note.id}`} ref={ref} className="bx-input mt-1.5 min-h-[5.5rem] font-body !text-sm leading-6" value={note.body} placeholder="Your note…" onChange={(e) => dispatch({ type: 'update', id: note.id, body: e.target.value })} data-testid="note-body" />
    </li>
  );
}

/** The docked notepad / drawer: notes on the section in view first, then the rest; export and import .md. */
export default function NotepadPanel({ section, onClose }: { section?: string | null; onClose?: () => void }) {
  const np = useNotepad();
  const idx = useAnchorIndex();
  const fileRef = useRef<HTMLInputElement>(null);
  const [scope, setScope] = useState<'here' | 'all'>(section ? 'here' : 'all');
  useEffect(() => { if (!section) setScope('all'); }, [section]);
  const notes = useMemo(() => {
    const all = [...np.state.notes].sort((a, b) => (a.created < b.created ? 1 : -1));
    if (scope === 'all' || !section || !idx) return all;
    return all.filter((n) => resolveAnchor(n.anchor, idx).section === section);
  }, [np.state.notes, scope, section, idx]);
  const sec = getSection(section);

  const onImport = async (f: File) => {
    const text = await f.text();
    np.dispatch({ type: 'merge', notes: fromMarkdown(text) });
  };

  return (
    <div className="flex h-full flex-col gap-2 text-sm" data-testid="notepad">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-display">Notepad</h2>
        {onClose && <button type="button" className="bx-btn !py-0.5" onClick={onClose} aria-label="Close notepad">×</button>}
      </div>
      <p className="text-xs bx-muted" data-testid="notepad-storage">
        {np.file === 'saved' || np.file === 'saving'
          ? <>Your notes, in this browser and autosaved to notes/notepad.md{np.file === 'saving' ? ' (saving…)' : ''}.</>
          : np.file === 'unavailable' ? <strong>Saved in this browser only — export to keep a copy.</strong> : 'Your notes, in this browser.'}
        {' '}Select text in the primer to quote it, or use “✎ Note” on a plant, compound or preparation.
      </p>
      <div className="flex flex-wrap gap-1.5">
        {section && <button type="button" className="bx-btn" onClick={() => { setScope('here'); np.addNote({ type: 'section', id: section }); }} data-testid="new-section-note">+ Note on {sec?.number ? `§${sec.number}` : 'this section'}</button>}
        <button type="button" className="bx-btn" onClick={() => { setScope('all'); np.addNote({ type: 'free', id: '' }); }} data-testid="new-note">+ Unanchored note</button>
      </div>
      {section && (
        <div className="flex gap-1 text-xs" role="group" aria-label="Which notes">
          <button type="button" className={`bx-btn !py-0.5 ${scope === 'here' ? 'bx-btn-on' : ''}`} aria-pressed={scope === 'here'} onClick={() => setScope('here')}>This section</button>
          <button type="button" className={`bx-btn !py-0.5 ${scope === 'all' ? 'bx-btn-on' : ''}`} aria-pressed={scope === 'all'} onClick={() => setScope('all')}>All ({np.state.notes.length})</button>
        </div>
      )}
      <ul className="grid gap-2 overflow-y-auto pr-1 flex-1 min-h-0">
        {notes.length === 0 && <li className="bx-muted text-xs">No notes {scope === 'here' ? 'on this section ' : ''}yet.</li>}
        {notes.map((n) => <NoteEditor key={n.id} note={n} idx={idx} autoFocus={np.focusId === n.id} />)}
      </ul>
      <div className="flex flex-wrap gap-1.5 border-t border-[color:var(--bx-line)] pt-2">
        <button type="button" className="bx-btn" disabled={!idx || !np.state.notes.length} onClick={() => idx && exportNotes(np.state, idx)} data-testid="export-notes">Export .md</button>
        <button type="button" className="bx-btn" onClick={() => fileRef.current?.click()}>Import .md</button>
        <input ref={fileRef} type="file" accept=".md,text/markdown,text/plain" className="sr-only" aria-label="Import notes from a Markdown file" onChange={(e) => { const f = e.target.files?.[0]; if (f) void onImport(f); e.target.value = ''; }} />
        <Link className="bx-btn" to="/notes">All notes →</Link>
      </div>
    </div>
  );
}
