import { Fragment, lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import sectionsJson from '@/data/sections.json';
import type { Section } from '@/types';
import { AS_OF, asOfLong, bodySections, getSection, manifest, provenance } from '@/lib/data';
import { useNotepad } from '@/lib/notepad-context';
import Markdown from '@/components/reader/Markdown';
import SectionRail from '@/components/reader/SectionRail';
import ReaderFigure from '@/components/reader/ReaderFigure';
import Drawer from '@/components/ui/Drawer';

const NotepadPanel = lazy(() => import('@/components/notepad/NotepadPanel'));

/** ≥ 1280 px docks the notepad beside the reader (APP-SPEC §3.1); below that it is a drawer. */
function useWide(): boolean {
  const q = '(min-width: 1280px)';
  const [wide, setWide] = useState(() => typeof window !== 'undefined' && window.matchMedia(q).matches);
  useEffect(() => { const m = window.matchMedia(q); const on = () => setWide(m.matches); m.addEventListener('change', on); return () => m.removeEventListener('change', on); }, []);
  return wide;
}

const sections = sectionsJson as unknown as Section[];
const HEADINGS = { 2: 'h2', 3: 'h3', 4: 'h4' } as const;
const BANNER_KEY = `bx-banner-dismissed:${manifest.slug}`;

function SectionHeading({ depth, number, title, id }: { depth: number; number: string | null; title: string; id: string }) {
  const Tag = HEADINGS[(Math.min(Math.max(depth, 2), 4)) as 2 | 3 | 4];
  const cls = depth <= 2 ? 'text-2xl sm:text-3xl mt-10' : depth === 3 ? 'text-xl sm:text-2xl mt-8' : 'text-lg sm:text-xl mt-6';
  return (
    <Tag id={`h-${id}`} className={`${cls} scroll-mt-36 group`}>
      {title}{' '}
      <a href={`#${id}`} className="bx-muted text-sm font-body no-underline opacity-0 group-hover:opacity-100 focus:opacity-100" aria-label={`Link to section ${number ?? title}`}>#</a>
    </Tag>
  );
}

/** The commissioned-review banner (DESIGN-SYSTEM §3.1). Dismissal is per-slug; the as_of chip never hides. */
function Banner() {
  const [dismissed, setDismissed] = useState(() => { try { return localStorage.getItem(BANNER_KEY) === '1'; } catch { return false; } });
  if (dismissed) return null;
  return (
    <div className="bx-banner no-print" data-testid="review-banner">
      <div className="flex items-start gap-3">
        <p className="flex-1">
          Written by the {manifest.builder.name} from {provenance.references.total} sources, current as of {asOfLong()}.
          Every claim is cited; passages marked <em>synthesis</em> draw conclusions the cited works do not individually state.
          This is a commissioned review and is <strong>not peer reviewed</strong>.
        </p>
        <button type="button" className="bx-btn !py-0.5 !px-2 text-xs" onClick={() => { setDismissed(true); try { localStorage.setItem(BANNER_KEY, '1'); } catch { /* ignore */ } }} aria-label="Dismiss the commissioned-review notice">Dismiss</button>
      </div>
    </div>
  );
}

export default function Read() {
  const loc = useLocation();
  const notepad = useNotepad();
  const [active, setActive] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const wide = useWide();
  const [sel, setSel] = useState<{ x: number; y: number; text: string; section: string } | null>(null);
  const articleRef = useRef<HTMLElement>(null);

  // ?section=id (DESIGN-SYSTEM) → #id
  useEffect(() => {
    const q = new URLSearchParams(loc.search).get('section');
    if (q && getSection(q)) history.replaceState(null, '', `${import.meta.env.BASE_URL.replace(/\/$/, '')}/read#${q}`);
    const hash = (q ? `#${q}` : loc.hash).slice(1);
    if (hash) requestAnimationFrame(() => document.getElementById(hash)?.scrollIntoView());
  }, [loc.search, loc.hash]);

  // active section + progress
  useEffect(() => {
    const els = bodySections.map((s) => document.getElementById(s.id)).filter((e): e is HTMLElement => !!e);
    const io = new IntersectionObserver((entries) => {
      const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
      if (visible[0]) setActive(visible[0].target.id);
    }, { rootMargin: '-15% 0px -70% 0px', threshold: 0 });
    els.forEach((e) => io.observe(e));
    const onScroll = () => {
      const h = document.documentElement;
      const max = h.scrollHeight - h.clientHeight;
      setProgress(max > 0 ? Math.min(1, h.scrollTop / max) : 0);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => { io.disconnect(); window.removeEventListener('scroll', onScroll); };
  }, []);

  // text selection → "Add note"
  const onSelect = useCallback(() => {
    const s = window.getSelection();
    const text = s?.toString().trim();
    if (!s || !text || s.rangeCount === 0 || !articleRef.current) { setSel(null); return; }
    const range = s.getRangeAt(0);
    if (!articleRef.current.contains(range.commonAncestorContainer)) { setSel(null); return; }
    const sec = (range.commonAncestorContainer instanceof Element ? range.commonAncestorContainer : range.commonAncestorContainer.parentElement)?.closest('section[data-section]');
    const rect = range.getBoundingClientRect();
    setSel({ x: rect.left + rect.width / 2 + window.scrollX, y: rect.top + window.scrollY - 8, text, section: sec?.getAttribute('data-section') ?? bodySections[0].id });
  }, []);
  const addNote = () => {
    if (!sel) return;
    notepad.addNote({ type: 'section', id: sel.section }, sel.text);
    notepad.setOpen(true);
    setSel(null);
    window.getSelection()?.removeAllRanges();
  };

  return (
    <div className="relative">
      <div className="bx-progress fixed left-0 top-0 z-50 h-0.5 bg-[color:var(--bx-accent)]" style={{ width: `${progress * 100}%` }} aria-hidden="true" />
      <div className="mx-auto max-w-7xl px-4 py-8 xl:grid xl:gap-8" style={wide ? { gridTemplateColumns: notepad.open ? '220px minmax(0,1fr) 360px' : '220px minmax(0,1fr)' } : undefined}>
        <aside className="hidden xl:block"><div className="sticky top-32 max-h-[calc(100vh-9rem)] overflow-y-auto pr-2"><SectionRail active={active} variant="rail" /></div></aside>
        <div className="min-w-0">
          <div className="xl:hidden mb-4"><SectionRail active={active} variant="select" /></div>
          <article ref={articleRef} className="bx-reader mx-auto" onMouseUp={onSelect} onKeyUp={(e) => { if (e.shiftKey) onSelect(); }} aria-label="The commissioned review">
            <header>
              <p className="flex flex-wrap items-center gap-2 no-print">
                <span className="bx-chip border border-[color:var(--bx-line)] bx-muted">COMMISSIONED REVIEW — NOT PEER REVIEWED</span>
                <span className="bx-asof">Current as of {AS_OF}</span>
              </p>
              <h1 className="text-3xl sm:text-4xl leading-tight mt-3">The primer: what every plant shares</h1>
              <p className="mt-2 text-sm bx-muted no-print">
                {manifest.authors.join(', ')} · {provenance.words.toLocaleString('en')} words. Dotted terms open the glossary; bracketed numbers open the reference that supports the claim. Select any text to add a note.
              </p>
              <Banner />
            </header>
            {sections.map((s) => (
              <section key={s.id} id={s.id} data-section={s.id} className="scroll-mt-36" aria-labelledby={`h-${s.id}`}>
                <SectionHeading depth={s.depth} number={s.number} title={s.title} id={s.id} />
                {s.chunks.map((c, i) => {
                  if (c.kind === 'figure') return <ReaderFigure key={i} id={c.id} />;
                  if (c.marker === 'synthesis' && c.id) {
                    return (
                      <div key={i} id={c.id} className="bx-synthesis scroll-mt-36" data-testid="synthesis-block">
                        <span className="bx-synthesis-label">synthesis — a conclusion the cited works do not individually state</span>
                        <Markdown md={c.md} math={c.hasMath} />
                      </div>
                    );
                  }
                  return <Fragment key={i}><Markdown md={c.md} math={c.hasMath} /></Fragment>;
                })}
              </section>
            ))}
            <p className="mt-10 text-sm bx-muted no-print">
              End of the primer. <Link className="underline" to="/plants">The plants →</Link> · <Link className="underline" to="/compounds">The compounds →</Link> · <Link className="underline" to="/tea">Tea Time →</Link> · <Link className="underline" to="/references">All {provenance.references.total} references →</Link> · <Link className="underline" to="/methods">How this was built and what it does not cover →</Link>
            </p>
          </article>
        </div>
        {/* Notepad: docked column on ≥1280px, drawer below (APP-SPEC §3.1) */}
        {notepad.open && wide && (
          <aside className="bx-notepad-dock" aria-label="Notepad">
            <div className="sticky top-32 h-[calc(100vh-9rem)] bx-card p-3"><Suspense fallback={null}><NotepadPanel section={active} onClose={() => notepad.setOpen(false)} /></Suspense></div>
          </aside>
        )}
      </div>
      {notepad.open && !wide && (
        <Drawer open onClose={() => notepad.setOpen(false)} label="Notepad" testId="notepad-drawer">
          <Suspense fallback={null}><NotepadPanel section={active} /></Suspense>
        </Drawer>
      )}
      {!notepad.open && (
        <button type="button" className="bx-btn-primary fixed bottom-4 right-4 z-40 shadow-lg no-print" onClick={() => notepad.setOpen(true)} aria-label="Open notepad" data-testid="open-notepad">✎ Notes</button>
      )}
      {sel && (
        <button type="button" className="bx-btn-primary absolute z-40 -translate-x-1/2 -translate-y-full shadow-lg no-print" style={{ left: sel.x, top: sel.y }} onMouseDown={(e) => e.preventDefault()} onClick={addNote} data-testid="add-note">Add note</button>
      )}
    </div>
  );
}
