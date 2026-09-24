import { Link } from 'react-router-dom';
import type { Figure } from '@/types';
import { getConcept, sectionTitle } from '@/lib/data';
import ExplainChips from './ExplainChips';
import FigureBody from './FigureBody';

const SYNTH_NOTE: Record<string, string> = {
  data: 'Assembled by the builder from values published in the cited works. Values are as published — nothing pooled, converted or re-analysed.',
  conceptual: 'Drawn by the builder from the mechanisms reported in the cited works. It is a diagram, not data.',
};

/** InfographicFrame pattern: title, the figure, caption, "How to read this", what it is made of. */
export default function FigureFrame({ figure }: { figure: Figure }) {
  return (
    <figure className="bx-card p-4 sm:p-6" aria-labelledby={`fig-title-${figure.id}`}>
      <div className="flex flex-wrap items-start gap-3">
        <div className="flex-1 min-w-[16rem]">
          <p className="text-[11px] font-semibold tracking-[0.15em] bx-muted">{figure.label.toUpperCase()} · {figure.kind.toUpperCase()}</p>
          <h1 id={`fig-title-${figure.id}`} className="text-2xl sm:text-3xl mt-1">{figure.title}</h1>
        </div>
        <span className="bx-chip border border-[color:var(--bx-line)]" title={figure.synthesis ? SYNTH_NOTE[figure.synthesis] : undefined}>{figure.provenance}</span>
      </div>
      <div className="mt-4"><FigureBody figure={figure} /></div>
      <figcaption className="mt-4 border-t border-[color:var(--bx-line)] pt-3">
        <p className="text-sm leading-6"><span className="font-semibold">Caption. </span>{figure.caption}</p>
        {figure.legend_text && <p className="mt-2 text-sm leading-6 bx-muted">{figure.legend_text}</p>}
      </figcaption>
      <div className="mt-4">
        <h2 className="text-lg">How to read this figure</h2>
        <p className="bx-prose mt-1">{figure.how_to_read}</p>
      </div>
      <ExplainChips items={figure.explain} figureId={figure.id} />
      <div className="mt-4 grid gap-3 sm:grid-cols-2 text-sm">
        <div>
          <p className="text-[11px] font-semibold tracking-[0.15em] bx-muted">BUILT FROM ({figure.refs.length} REFERENCES)</p>
          <p className="mt-1 flex flex-wrap gap-1">{figure.refs.map((n) => <Link key={n} className="underline inline-flex items-center justify-center min-w-[2.25rem] min-h-[1.75rem] px-1 rounded hover:bg-paper-2 dark:hover:bg-night-2" to={`/references#ref-${n}`}>[{n}]</Link>)}</p>
          {figure.concepts.length > 0 && (
            <>
              <p className="text-[11px] font-semibold tracking-[0.15em] bx-muted mt-3">CONCEPTS IN THIS FIGURE</p>
              <ul className="mt-1 flex flex-wrap gap-1.5">{figure.concepts.map((c) => <li key={c}><Link className="bx-chip border border-[color:var(--bx-line)] hover:bg-paper-2 dark:hover:bg-night-2" to={`/concepts/${c}`}>101 · {getConcept(c)?.title ?? c}</Link></li>)}</ul>
            </>
          )}
        </div>
        <div>
          <p className="text-[11px] font-semibold tracking-[0.15em] bx-muted">WHERE IT IS DISCUSSED</p>
          <ul className="mt-1 grid gap-0.5">{figure.discussed_in.map((s) => <li key={s}><Link className="underline" to={`/read#${s}`}>{sectionTitle(s)}</Link></li>)}</ul>
        </div>
      </div>
      <p className="mt-4 text-xs bx-muted"><span className="font-semibold">Source: </span>{figure.source}</p>
      <p className="mt-1 text-xs bx-muted">
        <span className="font-semibold">Synthesis: </span>
        {figure.synthesis === 'data' ? 'built from data across cited works' : 'a conceptual diagram drawn by the builder'} — no published figure image is reproduced anywhere in this app.
      </p>
    </figure>
  );
}
