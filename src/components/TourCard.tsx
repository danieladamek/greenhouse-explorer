import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { getTour } from '@/lib/data';
import type { Tour } from '@/types';
import { Prose } from '@/components/catalogue/Record';
import { citeLinks } from '@/components/catalogue/EvidenceTable';

/** URL for step i of a tour: the step's own route plus tour/step markers so the card overlay appears (Bioactive Explorer). */
export function tourStepUrl(tour: Tour, i: number): string {
  const step = tour.steps[i];
  const [path, hash] = step.route.split('#');
  const sep = path.includes('?') ? '&' : '?';
  return `${path}${sep}tour=${tour.id}&step=${i}${hash ? `#${hash}` : ''}`;
}

/** Floating step card shown on any route that carries ?tour=<id>&step=<n> (ported from Bioactive Explorer). */
export default function TourCard() {
  const [params] = useSearchParams();
  const loc = useLocation();
  const tour = getTour(params.get('tour'));
  const n = Number(params.get('step'));
  if (!tour || !Number.isInteger(n) || n < 0 || n >= tour.steps.length) return null;
  const step = tour.steps[n];
  const last = n === tour.steps.length - 1;
  const exit = (() => { const p = new URLSearchParams(loc.search); p.delete('tour'); p.delete('step'); const q = p.toString(); return `${loc.pathname}${q ? `?${q}` : ''}`; })();
  return (
    <aside aria-label={`Tour: ${tour.title}`} className="fixed bottom-3 left-3 right-3 sm:left-auto sm:right-4 sm:bottom-4 sm:w-[25rem] z-40 bx-card bg-paper dark:bg-night p-4 shadow-xl border-l-4 border-l-[color:var(--bx-accent)] max-h-[60vh] overflow-y-auto" data-testid="tour-card">
      <p className="text-[11px] font-semibold tracking-[0.15em] bx-muted">TOUR · {tour.title.toUpperCase()} · STEP {n + 1} OF {tour.steps.length}</p>
      <h2 className="text-lg mt-1">{step.title}</h2>
      <Prose md={citeLinks(step.text)} className="text-sm mt-1 leading-6" />
      <p className="mt-1 text-[11px] bx-muted">Paraphrased from {step.source}.</p>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
        {n > 0 ? <Link to={tourStepUrl(tour, n - 1)} className="bx-btn">← Back</Link> : <Link to={`/tours/${tour.id}`} className="bx-btn">← Intro</Link>}
        {last ? <Link to={`/tours/${tour.id}?step=quiz`} className="bx-btn-primary" data-testid="tour-next">Self-check →</Link> : <Link to={tourStepUrl(tour, n + 1)} className="bx-btn-primary" data-testid="tour-next">Next →</Link>}
        <Link to={exit} className="ml-auto underline text-xs" aria-label="Exit tour and stay on this page">Exit tour</Link>
      </div>
      <div className="mt-2 h-1 rounded bg-[color:var(--bx-line)]" aria-hidden="true"><div className="h-1 rounded bg-[color:var(--bx-accent)]" style={{ width: `${((n + 1) / tour.steps.length) * 100}%` }} /></div>
    </aside>
  );
}
