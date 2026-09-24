import { Link } from 'react-router-dom';
import { figuresIndex as figures, getConcept } from '@/lib/data';

export default function Figures() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="text-3xl sm:text-4xl">Figures</h1>
      <p className="bx-prose mt-2 max-w-3xl">
        Every figure here was built by the reviewer, not reproduced: {figures.filter((f) => f.synthesis === 'data').length} are assembled from values published in the cited works,
        and {figures.filter((f) => f.synthesis === 'conceptual').length} are conceptual diagrams drawn from what those works report. No published figure image appears anywhere in this app.
        Each page names the references it was built from.
      </p>
      <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {figures.map((f) => (
          <li key={f.id} className="bx-card p-4 flex flex-col">
            <p className="text-[11px] font-semibold tracking-[0.15em] bx-muted">{f.label.toUpperCase()} · {f.kind.toUpperCase()}</p>
            <h2 className="text-xl mt-1"><Link className="underline decoration-dotted" to={`/figures/${f.id}`}>{f.title}</Link></h2>
            <p className="mt-3 h-24 rounded-md bg-paper-2 dark:bg-night-2 flex items-center justify-center text-sm bx-muted text-center px-2">
              {f.rows !== null ? `${f.rows} rows × ${f.fields} columns${f.has_chart ? ' + chart' : ''}` : 'diagram'}
            </p>
            <p className="mt-2 text-xs bx-muted">{f.provenance} · built from {f.refs.length} references</p>
            <p className="mt-2 text-xs flex flex-wrap gap-1">{f.concepts.map((c) => <Link key={c} className="bx-chip border border-[color:var(--bx-line)]" to={`/concepts/${c}`}>{getConcept(c)?.title.split(' — ')[0] ?? c}</Link>)}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
