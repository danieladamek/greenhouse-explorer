import { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { getCompoundMeta } from '@/lib/data';
import { loadPreparations, useAsync } from '@/lib/heavy';
import type { Preparation } from '@/types';
import { ClassIcon, TaxonName } from '@/components/catalogue/Chips';
import { AddNoteButton, Prose, Sources } from '@/components/catalogue/Record';
import { citeMd } from '@/components/catalogue/EvidenceTable';

const range = (r: [number, number] | null, unit: string) => (!r ? null : r[0] === r[1] ? `${r[0]} ${unit}` : `${r[0]}–${r[1]} ${unit}`);

function CompoundLinks({ ids }: { ids: string[] }) {
  if (!ids.length) return <span className="bx-muted">none listed</span>;
  return <>{ids.map((id, i) => { const c = getCompoundMeta(id); return <span key={id}>{i ? ', ' : ''}<Link to={`/compounds/${id}`} className="underline decoration-dotted inline-flex items-center gap-1">{c && <ClassIcon cls={c.class} size={10} />}{c?.name ?? id}</Link></span>; })}</>;
}

/**
 * One preparation (KICKOFF §4d): the method is extraction chemistry, the conditions are the conditions of the cited
 * studies, and the safety block is always expanded. The schema has no dose, serving, frequency or indication key,
 * and nothing here adds one.
 */
function PrepCard({ p }: { p: Preparation }) {
  const t = range(p.temperature_c, '°C');
  const m = range(p.time_min, 'min');
  return (
    <article id={p.id} className="bx-card p-4 sm:p-6 scroll-mt-36" aria-labelledby={`${p.id}-h`} data-testid="preparation">
      <p className="text-[11px] font-semibold tracking-[0.2em] bx-muted">{p.kind.toUpperCase()} · {p.solvent.toUpperCase()}</p>
      <h2 id={`${p.id}-h`} className="text-2xl mt-1">{p.name}</h2>
      <p className="mt-1 text-sm">
        {p.plants.map((id, i) => <span key={id}>{i ? ' · ' : ''}<TaxonName id={id} withCommon /></span>)} <span className="bx-muted">· {p.plant_part}</span>
      </p>
      <Prose md={p.md.method_as_chemistry} className="mt-3 text-[15px]" />
      <p className="mt-3 text-sm bx-card p-2.5" data-testid="conditions">
        <span className="font-semibold">Conditions in the cited studies: </span>
        {t ?? <span className="bx-todo">temperature not stated in the sources</span>}, {m ?? <span className="bx-todo">time not stated in the sources</span>}.
        <span className="bx-muted"> These are the conditions under which the published values were measured, not instructions.</span>
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 text-sm">
        <div><h3 className="font-semibold">What comes through</h3><p className="mt-1"><CompoundLinks ids={p.what_it_extracts} /></p></div>
        <div><h3 className="font-semibold">What stays behind</h3><p className="mt-1"><CompoundLinks ids={p.what_it_leaves_behind} /></p></div>
      </div>
      {p.formed_or_lost.length > 0 && (
        <div className="mt-4 grid gap-2">
          <h3 className="font-semibold text-sm">Formed or lost</h3>
          {p.formed_or_lost.map((f, i) => (
            <div key={i} className="bx-card p-3 border-l-4 border-l-[color:var(--bx-accent)] text-sm" data-testid="formed-or-lost">
              <Link to={`/compounds/${f.compound_id}`} className="font-semibold underline">{getCompoundMeta(f.compound_id)?.name ?? f.compound_id}</Link>: <Prose md={p.md.formed_or_lost[i]?.change ?? f.change} className="bx-inline" />
              <p className="mt-1 text-xs bx-muted"><span className="font-semibold">Why: </span><Prose md={p.md.formed_or_lost[i]?.why ?? f.why} className="bx-inline" /></p>
            </div>
          ))}
        </div>
      )}
      <section className="mt-5 bx-safety" aria-labelledby={`${p.id}-safety`} data-testid="prep-safety">
        <h3 id={`${p.id}-safety`} className="text-lg">Safety</h3>
        <Prose md={p.md.safety_summary} className="text-sm mt-1" /> <Prose md={citeMd(p.safety_block.refs)} className="bx-inline text-sm" />
        {p.safety_block.constituents_of_concern.length > 0 && (
          <ul className="mt-2 grid gap-2 text-sm">
            {p.safety_block.constituents_of_concern.map((c, i) => (
              <li key={c.compound_id}>
                <Link to={`/compounds/${c.compound_id}`} className="font-semibold underline">{getCompoundMeta(c.compound_id)?.name ?? c.compound_id}</Link>: <Prose md={p.md.constituents_of_concern[i] ?? c.concern} className="bx-inline" /> <Prose md={citeMd(c.refs)} className="bx-inline" />
                {c.threshold_or_limit && <span className="block text-xs mt-0.5"><span className="uppercase text-[10px] font-semibold tracking-wider">regulatory / toxicological limit: </span>{c.threshold_or_limit}</span>}
              </li>
            ))}
          </ul>
        )}
      </section>
      <div className="mt-4 flex flex-wrap items-center gap-2 text-xs bx-muted">
        <span>Record as of {p.as_of}.</span>
        <AddNoteButton anchor={{ type: 'preparation', id: p.id }} label={p.name} />
      </div>
    </article>
  );
}

/** /tea — Tea Time (KICKOFF §4d). */
export default function Tea() {
  const preps = useAsync(loadPreparations);
  const loc = useLocation();
  useEffect(() => { if (preps && loc.hash) requestAnimationFrame(() => document.getElementById(loc.hash.slice(1))?.scrollIntoView()); }, [preps, loc.hash]);
  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-3xl sm:text-4xl">Tea Time</h1>
      <div className="mt-4 bx-card p-4 border-l-4 border-l-[color:var(--bx-accent)] text-sm" role="note" data-testid="tea-note">
        <p><strong>Preparation is presented here as extraction chemistry</strong>: what hot water or a water–ethanol mixture pulls out of a plant part, what it leaves behind, and what forms or is lost on the way.
          This site gives no dosing and is not medical advice. See <Link className="underline" to="/methods#content-line">Methods</Link> for the content line.</p>
      </div>
      <p className="bx-prose mt-4">The chemistry behind these records is introduced in the primer's section <Link className="underline" to="/read#7-from-leaf-to-cup">§7 From leaf to cup</Link>, with Figure 2 on how much of each fraction reaches the cup.</p>
      {!preps ? <p className="mt-6 bx-muted" role="status">Loading…</p> : (
        <>
          <nav aria-label="Preparations" className="mt-4 flex flex-wrap gap-2 text-sm">{preps.map((p) => <a key={p.id} className="bx-btn" href={`#${p.id}`}>{p.name}</a>)}</nav>
          <div className="mt-6 grid gap-6">{preps.map((p) => <PrepCard key={p.id} p={p} />)}</div>
          <Sources refs={[...new Set(preps.flatMap((p) => p.cited_refs))]} />
        </>
      )}
    </div>
  );
}
