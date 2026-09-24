import { Link } from 'react-router-dom';
import { conceptsIndex, getFigure, getTerm } from '@/lib/data';

export default function Concepts() {
  const ordered = [...conceptsIndex].sort((a, b) => a.prerequisites.length - b.prerequisites.length || a.title.localeCompare(b.title));
  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-3xl sm:text-4xl">Concepts (101s)</h1>
      <p className="bx-prose mt-2">
        {conceptsIndex.length} short introductions to what this review presumes you know, written at intro-textbook level by the content-pack builder.
        Each says why the review needs it, shows the key idea, and ends with a self-check. Start with the ones that have no prerequisites.
      </p>
      <ol className="mt-6 grid gap-3">
        {ordered.map((c) => (
          <li key={c.id} className="bx-card p-4">
            <h2 className="text-xl"><Link className="underline decoration-dotted" to={`/concepts/${c.id}`}>{c.title}</Link></h2>
            <p className="bx-prose mt-1">{c.one_liner}</p>
            <p className="mt-2 text-xs bx-muted flex flex-wrap gap-x-4 gap-y-1">
              {c.prerequisites.length > 0
                ? <span>After: {c.prerequisites.map((p) => <Link key={p} className="underline mr-1.5" to={`/concepts/${p}`}>{conceptsIndex.find((x) => x.id === p)?.title ?? p}</Link>)}</span>
                : <span>No prerequisites</span>}
              {c.figures.length > 0 && <span>Figures: {c.figures.map((f) => <Link key={f} className="underline mr-1.5" to={`/figures/${f}`}>{getFigure(f)?.label ?? f}</Link>)}</span>}
              <span>{c.terms.length} terms · e.g. {c.terms.slice(0, 3).map((t) => getTerm(t)?.term.split(' (')[0] ?? t).join(', ')}</span>
            </p>
          </li>
        ))}
      </ol>
    </div>
  );
}
