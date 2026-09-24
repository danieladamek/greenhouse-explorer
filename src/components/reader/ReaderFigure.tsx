import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import figuresJson from '@/data/figures.json';
import type { Figure } from '@/types';

const figures = figuresJson as unknown as Figure[];
const FigureBody = lazy(() => import('@/components/figures/FigureBody'));

/**
 * Inline figure slot in the reader: the interactive component + caption + link to the figure page.
 *
 * The reader embeds all eleven figures, four of which are force-directed diagrams that run their simulation to
 * completion before first paint. Mounting them all at once cost the reader its Lighthouse performance budget, so
 * each figure is built only once it is near the viewport. The caption, the label and the link render immediately,
 * so the page reads the same and nothing is hidden from a reader who never reaches the figure.
 */
export default function ReaderFigure({ id }: { id: string }) {
  const f = figures.find((x) => x.id === id);
  const ref = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || near) return;
    if (typeof IntersectionObserver === 'undefined') { setNear(true); return; }
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) { setNear(true); io.disconnect(); }
    }, { rootMargin: '800px 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, [near]);

  if (!f) return <p><span className="bx-todo">figure {id} missing from the content pack</span></p>;

  return (
    <figure id={`fig-${f.id}`} className="bx-card my-6 p-3 sm:p-4 scroll-mt-24 max-w-none" data-testid={`reader-figure-${f.id}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm"><span className="font-semibold">{f.label}.</span> <span className="bx-muted">{f.title}</span></p>
        <span className="bx-chip bg-paper-2 dark:bg-night-2">{f.provenance}</span>
      </div>
      <div ref={ref} className="mt-3 no-print-interactive" style={{ minHeight: near ? undefined : 320 }}>
        {near ? (
          <Suspense fallback={<div className="bx-muted text-sm min-h-[20rem]" role="status">Loading figure…</div>}>
            <FigureBody figure={f} inline />
          </Suspense>
        ) : (
          <div className="min-h-[20rem] grid place-items-center rounded-md bg-paper-2/50 dark:bg-night-2/50 text-sm bx-muted" role="status">
            {f.label} builds as you reach it
          </div>
        )}
      </div>
      <figcaption className="mt-3 text-sm leading-6 bx-muted">{f.caption}</figcaption>
      <p className="mt-2 text-sm"><Link className="underline font-semibold" to={`/figures/${f.id}`}>Open {f.label} page → how to read it, what it is built from, download</Link></p>
    </figure>
  );
}
