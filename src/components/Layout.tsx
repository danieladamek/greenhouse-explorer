import { lazy, Suspense, useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { useTheme } from '@/lib/theme';
import { useNotepad } from '@/lib/notepad-context';
import { AS_OF, manifest } from '@/lib/data';
import Drawer from '@/components/ui/Drawer';
import CompareTray from '@/components/catalogue/CompareTray';

const SearchModal = lazy(() => import('./SearchModal'));
const NotepadPanel = lazy(() => import('./notepad/NotepadPanel'));
// the tour card (and the Markdown renderer it uses) loads only on a URL that carries ?tour=
const TourCard = lazy(() => import('@/components/TourCard'));

const PRIMARY = [
  { to: '/read', label: 'Primer' },
  { to: '/plants', label: 'Plants' },
  { to: '/greenhouse', label: 'Greenhouse' },
  { to: '/compounds', label: 'Compounds' },
  { to: '/compare', label: 'Compare' },
  { to: '/tea', label: 'Tea Time' },
  { to: '/tours', label: 'Tours' },
];
const MORE = [
  { to: '/families', label: 'Families' },
  { to: '/heatmap', label: 'Heatmap' },
  { to: '/glossary', label: 'Glossary' },
  { to: '/concepts', label: 'Concepts' },
  { to: '/figures', label: 'Figures' },
  { to: '/references', label: 'References' },
  { to: '/notes', label: 'Notes' },
  { to: '/methods', label: 'Methods' },
  { to: '/about', label: 'About' },
];

/** The critique link (KICKOFF §4e): a prefilled GitHub issue whose title names the current route. */
export function critiqueHref(route: string, origin = typeof window !== 'undefined' ? window.location.origin : ''): string {
  const base = manifest.critique?.issues_url ?? '';
  const pageUrl = `${origin}${import.meta.env.BASE_URL.replace(/\/$/, '')}${route}`;
  const body = [
    `**Page:** ${pageUrl}`,
    '',
    '**What is wrong or unclear?**',
    '',
    '',
    '**What did you expect instead?**',
    '',
    '',
    '**Your role** (delete the others): public / student / researcher / greenhouse staff',
  ].join('\n');
  return `${base}?title=${encodeURIComponent(`Critique: ${route}`)}&body=${encodeURIComponent(body)}&labels=critique`;
}

/**
 * The prototype banner (KICKOFF §4e): on every route, under the header, never dismissable. It compacts to one line
 * on scroll and never disappears.
 */
function PrototypeBanner() {
  const loc = useLocation();
  const [compact, setCompact] = useState(false);
  useEffect(() => {
    // hysteresis, so the header shrinking by a line cannot bounce the page back across the threshold
    const on = () => setCompact((c) => (c ? window.scrollY > 40 : window.scrollY > 160));
    on();
    window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, []);
  const route = `${loc.pathname}${loc.search}`;
  return (
    <div className="bx-proto" role="note" aria-label="Prototype notice" data-testid="prototype-banner">
      <div className={`mx-auto flex max-w-7xl flex-wrap items-center gap-x-3 gap-y-1 px-3 sm:px-4 ${compact ? 'py-1' : 'py-2'}`}>
        <p className="flex-1 min-w-[14rem]">
          <strong>Prototype for critique</strong> · not peer reviewed · not an official UAH resource · content current as of {AS_OF}
          {!compact && manifest.banner && <span className="hidden sm:block text-xs bx-muted mt-0.5">{manifest.banner.text}</span>}
        </p>
        <a className="bx-btn !py-1 shrink-0" href={critiqueHref(route)} target="_blank" rel="noreferrer" data-testid="critique-link">
          {manifest.critique?.label ?? manifest.banner?.link_label ?? 'Critique this page'} <span aria-hidden="true">↗</span>
        </a>
      </div>
    </div>
  );
}

function MoreMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const loc = useLocation();
  useEffect(() => { setOpen(false); }, [loc.pathname]);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDoc); document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey); };
  }, [open]);
  const active = MORE.some((m) => loc.pathname.startsWith(m.to));
  return (
    <div className="relative" ref={ref}>
      <button type="button" className={`rounded-md px-2 py-1.5 hover:bg-paper-2 dark:hover:bg-night-2 ${active ? 'font-semibold underline underline-offset-4' : ''}`} aria-expanded={open} aria-controls="more-nav" onClick={() => setOpen((o) => !o)}>More ▾</button>
      {open && (
        <div id="more-nav" className="absolute right-0 top-full mt-1 z-50 bx-card bg-paper dark:bg-night p-1.5 grid w-44 shadow-lg">
          {MORE.map((n) => <NavLink key={n.to} to={n.to} className={({ isActive }) => `rounded-md px-2.5 py-1.5 hover:bg-paper-2 dark:hover:bg-night-2 ${isActive ? 'font-semibold underline underline-offset-4' : ''}`}>{n.label}</NavLink>)}
        </div>
      )}
    </div>
  );
}

export default function Layout({ children }: { children: ReactNode }) {
  const { theme, toggle } = useTheme();
  const notepad = useNotepad();
  const [open, setOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const loc = useLocation();
  const onRead = loc.pathname === '/read';
  const onNotes = loc.pathname === '/notes';
  useEffect(() => { setOpen(false); }, [loc.pathname]);
  useEffect(() => {
    // Move focus to main on route change for keyboard/screen-reader users; keep hash navigation intact.
    const main = document.getElementById('main');
    if (main && loc.key !== 'default' && !loc.hash) { main.focus({ preventScroll: true }); window.scrollTo({ top: 0 }); }
  }, [loc.pathname, loc.key, loc.hash]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setSearchOpen((o) => !o); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="min-h-screen flex flex-col">
      <a href="#main" className="sr-only-focusable fixed left-2 top-2 z-[80] rounded bg-ink px-3 py-2 text-paper">Skip to content</a>
      <header className="sticky top-0 z-40 bg-paper/95 dark:bg-night/95 backdrop-blur">
        <div className="border-b border-[color:var(--bx-line)]">
          <div className="mx-auto flex max-w-7xl items-center gap-2 px-3 sm:px-4 py-2.5">
            <Link to="/" className="font-display text-lg sm:text-xl font-semibold tracking-tight whitespace-nowrap">Greenhouse <span className="bx-muted font-normal">Explorer</span></Link>
            <nav aria-label="Primary" className="ml-auto hidden xl:flex items-center gap-0.5 text-sm">
              {PRIMARY.map((n) => (
                <NavLink key={n.to} to={n.to} className={({ isActive }) => `rounded-md px-2 py-1.5 hover:bg-paper-2 dark:hover:bg-night-2 ${isActive ? 'font-semibold underline underline-offset-4' : ''}`}>{n.label}</NavLink>
              ))}
              <MoreMenu />
            </nav>
            <div className="ml-auto xl:ml-1 flex items-center gap-1">
              <button type="button" className="bx-btn !px-2 sm:!px-2.5" onClick={() => setSearchOpen(true)} aria-label="Search (Command K)" title="Search ⌘K"><span aria-hidden="true">⌕</span><span className="hidden sm:inline">Search</span><kbd className="bx-kbd hidden md:inline" aria-hidden="true">⌘K</kbd></button>
              <button type="button" onClick={toggle} className="bx-btn !px-2 sm:!px-2.5" aria-pressed={theme === 'dark'} aria-label={`${theme === 'dark' ? 'Dark' : 'Light'} theme — switch to ${theme === 'dark' ? 'light' : 'dark'} theme`} title="Toggle light/dark theme" data-testid="theme-toggle">
                <span aria-hidden="true">{theme === 'dark' ? '☾' : '☼'}</span><span className="hidden sm:inline">{theme === 'dark' ? 'Dark' : 'Light'}</span>
              </button>
              {!onNotes && <button type="button" className={`bx-btn !px-2 sm:!px-2.5 ${notepad.open ? 'bx-btn-on' : ''}`} onClick={notepad.toggle} aria-pressed={notepad.open} aria-label="Notepad — toggle" title="Notepad" data-testid="notepad-toggle"><span aria-hidden="true">✎</span><span className="hidden sm:inline">Notepad</span></button>}
              <button type="button" className="bx-btn !px-2 xl:hidden" aria-expanded={open} aria-controls="mobile-nav" aria-label="Menu" onClick={() => setOpen((o) => !o)}><span aria-hidden="true">☰</span><span className="hidden sm:inline">Menu</span></button>
            </div>
          </div>
          {open && (
            <nav id="mobile-nav" aria-label="Primary mobile" className="xl:hidden border-t border-[color:var(--bx-line)] px-4 py-2 grid grid-cols-2 sm:grid-cols-4 gap-1 text-sm">
              {[...PRIMARY, ...MORE].map((n) => (
                <NavLink key={n.to} to={n.to} className={({ isActive }) => `rounded-md px-2.5 py-2 ${isActive ? 'font-semibold underline underline-offset-4' : ''}`}>{n.label}</NavLink>
              ))}
            </nav>
          )}
        </div>
        <PrototypeBanner />
      </header>
      <main id="main" tabIndex={-1} className="flex-1 outline-none">{children}</main>
      {searchOpen && <Suspense fallback={null}><SearchModal open onClose={() => setSearchOpen(false)} /></Suspense>}
      {/* the reader docks its own notepad on wide screens; everywhere else the notepad is a drawer */}
      {!onRead && !onNotes && (
        <Drawer open={notepad.open} onClose={() => notepad.setOpen(false)} label="Notepad" testId="notepad-drawer">
          <Suspense fallback={<p className="bx-muted">Loading…</p>}><NotepadPanel /></Suspense>
        </Drawer>
      )}
      {new URLSearchParams(loc.search).has('tour') && <Suspense fallback={null}><TourCard /></Suspense>}
      <CompareTray />
      <footer className="border-t border-[color:var(--bx-line)] mt-12">
        <div className="mx-auto max-w-7xl px-4 py-6 text-sm bx-muted flex flex-wrap gap-x-6 gap-y-2">
          <span>
            Greenhouse Explorer — a <strong>prototype for critique</strong>: a plant catalogue and a commissioned primer written by the {manifest.builder.name} ({manifest.builder.version}).
            <strong> Not peer reviewed; not an official UAH resource.</strong> Content current as of {AS_OF}.
            Scientific content comes only from the content pack; see <Link className="underline" to="/methods">Methods</Link> and <Link className="underline" to="/about">About</Link>.
          </span>
          <span>Preparation appears only as extraction chemistry. This site gives no dosing and is not medical advice — see <Link className="underline" to="/methods#content-line">the content line</Link>.</span>
        </div>
      </footer>
    </div>
  );
}
