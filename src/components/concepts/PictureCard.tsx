import { Link } from 'react-router-dom';
import type { Concept } from '@/types';
import { getFigure } from '@/lib/data';
import Markdown from '@/components/reader/Markdown';

/** "The key idea in one picture": the pack's own description, plus the figures it points to. */
export default function PictureCard({ concept }: { concept: Concept }) {
  if (!concept.picture) return null;
  const figs = concept.figures.map((f) => getFigure(f)).filter(Boolean);
  return (
    <section className="mt-8" aria-labelledby="picture-h">
      <h2 id="picture-h" className="text-2xl">The key idea in one picture</h2>
      <div className="bx-card mt-3 p-4 border-l-4 border-l-[color:var(--bx-accent)]">
        <p className="text-[11px] font-semibold tracking-[0.15em] bx-muted">SKETCH (FROM THE CONTENT PACK)</p>
        <Markdown md={concept.picture} components={{}} className="bx-prose mt-1" />
      </div>
      {figs.length > 0 && (
        <p className="mt-3 text-sm">Interactive versions in this app: {figs.map((f) => <Link key={f!.id} className="bx-chip border border-[color:var(--bx-line)] mr-1.5 hover:bg-paper-2 dark:hover:bg-night-2" to={`/figures/${f!.id}`}>{f!.label}</Link>)}</p>
      )}
    </section>
  );
}
