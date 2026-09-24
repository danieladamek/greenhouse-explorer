import { Link } from 'react-router-dom';
import type { Reference } from '@/types';
import { doiUrl, getCompoundMeta, sectionTitle } from '@/lib/data';
import Todo from '@/components/ui/Todo';

const ROLE: Record<string, string> = {
  support: 'Supports a claim', method: 'Method source', contrast: 'Contrast / disagreement', 'prior-result': 'Prior result',
  'data-source': 'Data source', background: 'Background', guideline: 'Guideline', review: 'Review', consensus: 'Consensus statement',
};

const TIER_NOTE: Record<string, string> = {
  seminal: 'Seminal — the field is built on it',
  current: 'Current — published since the scope window opened',
  background: 'Background — textbook, method, guideline or definitional source',
};

/** Summary card used by the reader fold-outs and the /references page. Summaries come only from the pack. */
export default function ReferenceCard({ r, compact = false }: { r: Reference; compact?: boolean }) {
  const href = r.doi ? doiUrl(r.doi) : r.url;
  return (
    <div data-testid={`ref-card-${r.n}`}>
      <p className="text-sm"><span className="font-semibold">[{r.n}]</span> {r.citation} {href && <a className="underline break-all" href={href} target="_blank" rel="noreferrer">{r.doi ? `doi:${r.doi}` : 'link'}</a>}</p>
      <p className="mt-2 flex flex-wrap items-center gap-2 text-xs">
        {r.tier && <span className="bx-tier" title={TIER_NOTE[r.tier]}>{r.tier}</span>}
        {r.year && <span className="bx-chip bg-paper-2 dark:bg-night-2">{r.year}</span>}
        <span className="bx-chip bg-paper-2 dark:bg-night-2">{ROLE[r.role_here] ?? r.role_here}</span>
        {r.anchor && <span className="bx-chip border border-[color:var(--bx-line)]">anchor — named in the interview</span>}
        {!r.verified && <span className="bx-todo">not verified — summary from abstract/metadata only</span>}
      </p>
      {r.summary.trim() ? <p className={`mt-2 ${compact ? 'text-sm leading-6' : 'bx-prose'}`}>{r.summary}</p> : <p className="mt-2"><Todo>summary pending</Todo></p>}
      {r.why_it_mattered && (
        <p className="mt-2 text-sm"><span className="font-semibold">Why it mattered: </span>{r.why_it_mattered}</p>
      )}
      {r.role_note && <p className="mt-2 text-sm"><span className="font-semibold">Why this review cites it:</span> {r.role_note}</p>}
      {!compact && r.key_facts.length > 0 && (
        <details className="mt-2 text-sm">
          <summary className="cursor-pointer bx-muted">{r.key_facts.length} key facts recorded from this work</summary>
          <ul className="mt-1 list-disc pl-5 grid gap-1">{r.key_facts.map((k, i) => <li key={i}>{k}</li>)}</ul>
        </details>
      )}
      {r.gap && <p className="mt-2 text-xs"><span className="bx-todo">gap</span> <span className="ml-1">{r.gap}</span></p>}
      {r.notes && !compact && <p className="mt-2 text-xs bx-muted">Builder note: {r.notes}</p>}
      {r.cited_sections.length > 0 && (
        <p className="mt-2 text-xs bx-muted">Cited in: {r.cited_sections.map((s) => <Link key={s} className="underline mr-2" to={s.startsWith('fig') ? `/figures/${s}` : `/read#${s}`}>{sectionTitle(s)}</Link>)}</p>
      )}
      {r.cited_compounds.length > 0 && (
        <p className="mt-1 text-xs bx-muted">Sources a record in: {r.cited_compounds.map((c) => <Link key={c} className="underline mr-2" to={`/compounds/${c}`}>{getCompoundMeta(c)?.name ?? c}</Link>)}</p>
      )}
      {compact && <p className="mt-2 text-xs"><Link className="underline font-semibold" to={`/references#ref-${r.n}`}>Open in references →</Link></p>}
    </div>
  );
}
