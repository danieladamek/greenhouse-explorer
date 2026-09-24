import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { getCompoundMeta, getConcept, getFigure, getTerm, sectionTitle } from '@/lib/data';
import { loadGlossary, useAsync } from '@/lib/heavy';
import KindChip from './KindChip';

interface DrawerCtx { openTerm: (id: string) => void; close: () => void }
const Ctx = createContext<DrawerCtx>({ openTerm: () => {}, close: () => {} });
export const useTermDrawer = () => useContext(Ctx);

/** Slide-over (CompoundDrawer pattern) for glossary entries opened from figures, so the figure stays visible. */
export function TermDrawerProvider({ children }: { children: ReactNode }) {
  const [id, setId] = useState<string | null>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const openTerm = useCallback((t: string) => { openerRef.current = document.activeElement as HTMLElement; setId(t); }, []);
  const close = useCallback(() => { setId(null); openerRef.current?.focus?.(); }, []);
  const value = useMemo(() => ({ openTerm, close }), [openTerm, close]);
  return (
    <Ctx.Provider value={value}>
      {children}
      {/* mounted only while open, so the full glossary is fetched on first use rather than on every page */}
      {id && <TermDrawer id={id} onClose={close} />}
    </Ctx.Provider>
  );
}

function TermDrawer({ id, onClose }: { id: string | null; onClose: () => void }) {
  const full = useAsync(loadGlossary);
  const t = id ? full?.find((x) => x.id === id) : undefined;
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!id) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [id, t, onClose]);
  if (!id) return null;
  if (!t) {
    return (
      <div className="fixed inset-0 z-50 flex justify-end" role="presentation">
        <button type="button" className="flex-1 bg-black/30" aria-label="Close glossary panel" onClick={onClose} />
        <aside role="dialog" aria-modal="true" aria-label="Glossary" className="h-full w-full max-w-md bg-paper dark:bg-night p-5">
          <button ref={closeRef} type="button" className="bx-btn" onClick={onClose} aria-label="Close">×</button>
          <p className="mt-4 bx-muted" role="status">{full ? `Term ${id} not found` : 'Loading…'}</p>
        </aside>
      </div>
    );
  }
  const concept = getConcept(t.concept ?? t.concepts[0]);
  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="presentation">
      <button type="button" className="flex-1 bg-black/30" aria-label="Close glossary panel" onClick={onClose} />
      <aside role="dialog" aria-modal="true" aria-labelledby="term-drawer-title" className="h-full w-full max-w-md overflow-y-auto bg-paper dark:bg-night p-5 shadow-2xl" data-testid="term-drawer">
        <div className="flex items-start justify-between gap-3">
          <h2 id="term-drawer-title" className="text-2xl">{t.term}</h2>
          <button ref={closeRef} type="button" className="bx-btn" onClick={onClose} aria-label="Close">×</button>
        </div>
        <p className="mt-2"><KindChip kind={t.kind} /></p>
        <p className="mt-3 font-semibold">{t.short}</p>
        <p className="bx-prose mt-2">{t.definition}</p>
        {concept && <p className="mt-3 text-sm"><Link className="underline" to={`/concepts/${concept.id}`} onClick={onClose}>Learn the concept → {concept.title}</Link></p>}
        {t.see.length > 0 && <p className="mt-3 text-sm">See also: {t.see.map((s) => <Link key={s} className="underline mr-2" to={`/glossary#${s}`} onClick={onClose}>{getTerm(s)?.term ?? s}</Link>)}</p>}
        {t.appears_in.length > 0 && <p className="mt-3 text-sm bx-muted">Appears in: {t.appears_in.map((s) => <Link key={s} className="underline mr-2" to={`/read#${s}`} onClick={onClose}>{sectionTitle(s)}</Link>)}</p>}
        {t.figures.length > 0 && <p className="mt-2 text-sm bx-muted">In figures: {t.figures.map((f) => <Link key={f} className="underline mr-2" to={`/figures/${f}`} onClick={onClose}>{getFigure(f)?.label ?? f}</Link>)}</p>}
        {t.compounds.length > 0 && <p className="mt-2 text-sm bx-muted">In compound records: {t.compounds.slice(0, 8).map((c) => <Link key={c} className="underline mr-2" to={`/compounds/${c}`} onClick={onClose}>{getCompoundMeta(c)?.name ?? c}</Link>)}{t.compounds.length > 8 ? ` and ${t.compounds.length - 8} more` : ''}</p>}
        <div className="mt-4"><Link to={`/glossary#${t.id}`} className="bx-btn-primary" onClick={onClose}>Open in glossary</Link></div>
      </aside>
    </div>
  );
}
