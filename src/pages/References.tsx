import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import referencesJson from '@/data/references.json';
import type { Reference } from '@/types';
import { doiUrl, provenance } from '@/lib/data';
import ReferenceCard from '@/components/reader/ReferenceCard';

const references = referencesJson as unknown as Reference[];
const ROLES = ['all', 'support', 'method', 'contrast', 'prior-result', 'data-source', 'background', 'guideline', 'review', 'consensus'];

const TIERS: { id: 'seminal' | 'classic' | 'current' | 'background'; title: string; blurb: string; order: 'asc' | 'desc' }[] = [
  { id: 'seminal', title: 'Seminal', blurb: 'The works the field is built on, at any age. Each carries a full summary and a note on what changed because of it. Oldest first, so the history reads forward.', order: 'asc' },
  { id: 'classic', title: 'Classic', blurb: 'Primary studies from before the scope window (2021) that later work leans on without being founded on them. Oldest first.', order: 'asc' },
  { id: 'current', title: 'Current', blurb: 'Published since the scope window opened (2021). Newest first.', order: 'desc' },
  { id: 'background', title: 'Background', blurb: 'Textbooks, methods papers, guidelines, regulatory documents and definitional sources. Newest first.', order: 'desc' },
];

export default function References() {
  const loc = useLocation();
  const [q, setQ] = useState('');
  const [role, setRole] = useState('all');
  const [anchorsOnly, setAnchorsOnly] = useState(false);
  const [open, setOpen] = useState<Set<number>>(() => new Set());
  useEffect(() => {
    if (!loc.hash) return;
    const n = Number(loc.hash.replace('#ref-', ''));
    if (Number.isInteger(n)) setOpen((o) => new Set(o).add(n));
    requestAnimationFrame(() => document.getElementById(loc.hash.slice(1))?.scrollIntoView());
  }, [loc.hash]);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return references.filter((r) =>
      (role === 'all' || r.role_here === role) &&
      (!anchorsOnly || r.anchor) &&
      (!needle || `${r.n} ${r.citation} ${r.summary} ${r.role_note} ${r.why_it_mattered}`.toLowerCase().includes(needle)));
  }, [q, role, anchorsOnly]);

  const toggle = (n: number) => setOpen((o) => { const s = new Set(o); if (s.has(n)) s.delete(n); else s.add(n); return s; });

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-3xl sm:text-4xl">References</h1>
      <p className="bx-prose mt-2">
        {references.length} works, grouped by tier and sorted by year within each. {provenance.references.verified} were verified against the source;
        {' '}{provenance.references.unverified.length === 1 ? 'one was not, and it supports no claim anywhere in this app' : `${provenance.references.unverified.length} were not`}.
        Summaries come from the content pack and are never invented. Each card lists the primer sections and catalogue records it supports.
      </p>
      <div className="mt-4 flex flex-wrap gap-2 no-print">
        <label className="sr-only" htmlFor="ref-q">Search references</label>
        <input id="ref-q" className="bx-input max-w-xs" placeholder="Search citations and summaries…" value={q} onChange={(e) => setQ(e.target.value)} />
        <label className="text-sm inline-flex items-center gap-1">Role
          <select className="bx-input !w-auto" value={role} onChange={(e) => setRole(e.target.value)}>{ROLES.map((r) => <option key={r} value={r}>{r}</option>)}</select>
        </label>
        <button type="button" className={`bx-btn ${anchorsOnly ? 'bx-btn-on' : ''}`} aria-pressed={anchorsOnly} onClick={() => setAnchorsOnly((a) => !a)}>Anchors only</button>
        <button type="button" className="bx-btn" onClick={() => setOpen(open.size ? new Set() : new Set(shown.map((r) => r.n)))}>{open.size ? 'Collapse all' : 'Expand all'}</button>
      </div>
      <p className="mt-2 text-xs bx-muted" role="status">{shown.length} of {references.length}</p>

      {TIERS.map((tier) => {
        const group = shown.filter((r) => r.tier === tier.id).sort((a, b) => (tier.order === 'asc' ? (a.year ?? 0) - (b.year ?? 0) : (b.year ?? 0) - (a.year ?? 0)) || a.n - b.n);
        if (!group.length) return null;
        return (
          <section key={tier.id} className="mt-8" aria-labelledby={`tier-${tier.id}`}>
            <h2 id={`tier-${tier.id}`} className="text-2xl flex flex-wrap items-baseline gap-2">{tier.title} <span className="bx-tier">{group.length}</span></h2>
            <p className="bx-prose mt-1">{tier.blurb}</p>
            <ol className="mt-3 grid gap-2 text-sm">
              {group.map((r) => {
                const href = r.doi ? doiUrl(r.doi) : r.url;
                const isOpen = open.has(r.n);
                return (
                  <li key={r.n} id={`ref-${r.n}`} className="scroll-mt-24 bx-card p-3 target:border-[color:var(--bx-accent)]">
                    <div className="flex gap-3">
                      <span className="tabular-nums bx-muted w-8 shrink-0 text-right">{r.n}.</span>
                      <div className="min-w-0 flex-1">
                        <p>{r.citation} {href && <a className="underline break-all" href={href} target="_blank" rel="noreferrer">{r.doi ? `doi:${r.doi}` : 'link'}</a>}</p>
                        <p className="mt-1 flex flex-wrap items-center gap-2">
                          <button type="button" className="bx-btn !py-0.5 !px-2 text-xs" aria-expanded={isOpen} aria-controls={`ref-body-${r.n}`} onClick={() => toggle(r.n)}>{isOpen ? 'Hide summary' : 'Show summary'}</button>
                          <span className="bx-chip bg-paper-2 dark:bg-night-2">{r.role_here}</span>
                          {r.year && <span className="bx-chip bg-paper-2 dark:bg-night-2">{r.year}</span>}
                          {r.anchor && <span className="bx-chip border border-[color:var(--bx-line)]">anchor</span>}
                          {!r.verified && <span className="bx-todo">not verified — summary from abstract/metadata only</span>}
                        </p>
                        {r.cited_in_catalogue.length > 0 && <p className="mt-1 text-xs bx-muted">Sources: {r.cited_in_catalogue.map((k) => { const [kind, id] = k.split(':'); const to = kind === 'compounds' ? `/compounds/${id}` : kind === 'taxa' ? `/plants/${id}` : `/tea#${id}`; return <Link key={k} className="underline mr-2" to={to}>{id}</Link>; })}</p>}
                        {tier.id === 'seminal' && !isOpen && r.why_it_mattered && (
                          <p className="mt-2 text-[13px] leading-6"><span className="font-semibold">Why it mattered: </span>{r.why_it_mattered}</p>
                        )}
                        {isOpen && <div id={`ref-body-${r.n}`} className="mt-2 border-t border-[color:var(--bx-line)] pt-2"><ReferenceCard r={r} /></div>}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
          </section>
        );
      })}
    </div>
  );
}
