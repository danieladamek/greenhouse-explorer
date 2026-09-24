import { Link } from 'react-router-dom';
import { getCompoundMeta } from '@/lib/data';
import type { SafetyFlag, TaxonSafety } from '@/types';
import { GradeBadge } from './Chips';
import { citeLinks, citeMd } from './EvidenceTable';
import { Prose } from './Record';

const LIMIT_LABEL = 'regulatory / toxicological limit';

/** Compound safety flags (KICKOFF §4b): prominent; thresholds verbatim and labelled — never serving guidance. */
export function SafetyFlags({ flags, detailsMd = [] }: { flags: SafetyFlag[]; detailsMd?: (string | null)[] }) {
  return (
    <section aria-labelledby="safety-h" className="mt-8" id="safety">
      <h2 id="safety-h" className="text-2xl">Safety</h2>
      {!flags.length ? (
        <p className="mt-2 text-sm"><span className="bx-todo" data-todo="author">No safety flag recorded for this compound in this pass — which is not the same as a finding that it is safe.</span></p>
      ) : (
        <ul className="mt-3 grid gap-3">
          {flags.map((f, i) => (
            <li key={i} className="bx-safety" data-testid="safety-flag">
              <p className="font-semibold text-[15px]">{f.flag}</p>
              {f.detail && <Prose md={detailsMd[i] ?? citeLinks(f.detail)} className="text-sm mt-1" />}
              {f.threshold_or_limit && (
                <p className="mt-2 text-sm"><span className="text-[11px] uppercase tracking-wider font-semibold">{LIMIT_LABEL}: </span><span data-testid="limit">{f.threshold_or_limit}</span></p>
              )}
              <p className="mt-2 text-xs bx-muted">Source: {f.source_citation} <Prose md={citeMd(f.refs)} className="bx-inline" /></p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Stmt({ label, s }: { label: string; s: { statement: string | null; md: string | null; refs: number[] } }) {
  return (
    <div className="py-2 border-b border-rose-900/15 dark:border-rose-200/15">
      <dt className="text-sm font-semibold">{label}</dt>
      <dd className="text-sm leading-6 mt-0.5">
        {s.md ? <><Prose md={s.md} className="bx-inline" /> <Prose md={citeMd(s.refs.filter((n) => !(s.statement ?? '').includes(`${n}]`)))} className="bx-inline" /></> : <span className="bx-todo" data-todo="author">not researched in this pass</span>}
      </dd>
    </div>
  );
}

/** The whole-plant safety block (KICKOFF §4c): always expanded, constituents of concern link to their compounds. */
export function TaxonSafetyBlock({ s }: { s: TaxonSafety }) {
  const sf = s.safety;
  return (
    <section aria-labelledby="tsafety-h" className="mt-8 bx-safety" id="safety" data-testid="safety-block">
      <h2 id="tsafety-h" className="text-2xl">Safety</h2>
      {s.plant_part_used && <p className="text-sm bx-muted mt-1">Plant part considered: {s.plant_part_used}</p>}
      <dl className="mt-2">
        <div className="py-2 border-b border-rose-900/15 dark:border-rose-200/15">
          <dt className="text-sm font-semibold">Constituents of concern</dt>
          <dd className="mt-1">
            {!sf.constituents_of_concern.length ? <span className="bx-todo text-sm">none recorded in this pass</span> : (
              <ul className="grid gap-2 text-sm">
                {sf.constituents_of_concern.map((c) => (
                  <li key={c.compound_id}>
                    <Link to={`/compounds/${c.compound_id}`} className="font-semibold underline">{getCompoundMeta(c.compound_id)?.name ?? c.compound_id}</Link>: <Prose md={c.md} className="bx-inline" /> <Prose md={citeMd(c.refs)} className="bx-inline" />
                    {c.threshold_or_limit && <div className="text-xs mt-0.5"><span className="uppercase tracking-wider font-semibold text-[10px]">{LIMIT_LABEL}: </span>{c.threshold_or_limit}</div>}
                  </li>
                ))}
              </ul>
            )}
          </dd>
        </div>
        <div className="py-2 border-b border-rose-900/15 dark:border-rose-200/15">
          <dt className="text-sm font-semibold">Drug interactions</dt>
          <dd className="mt-1">
            {!sf.drug_interactions.length ? <span className="bx-todo text-sm">none recorded in this pass</span> : (
              <ul className="grid gap-2 text-sm">
                {sf.drug_interactions.map((d, i) => (
                  <li key={i} className="flex gap-2 items-start">
                    {/* an interaction grade travels with the fact that the pack records no test article for it */}
                    {d.evidence_grade ? <span className="inline-flex items-center gap-1 shrink-0"><GradeBadge grade={d.evidence_grade} /><span className="bx-todo !text-[10px]">test article not recorded</span></span> : <span className="bx-todo !text-[10px] shrink-0">ungraded</span>}
                    <span><span className="font-semibold">With {d.with}: </span><Prose md={d.md} className="bx-inline" /> <Prose md={citeMd(d.refs)} className="bx-inline" /></span>
                  </li>
                ))}
              </ul>
            )}
          </dd>
        </div>
        <Stmt label="Pregnancy and lactation" s={sf.pregnancy_lactation} />
        <Stmt label="Allergy" s={sf.allergy} />
        <Stmt label="Adverse-event history" s={sf.adverse_event_history} />
        <div className="py-2">
          <dt className="text-sm font-semibold">Contraindications</dt>
          <dd className="mt-1">
            {!sf.contraindications.length ? <span className="bx-todo text-sm">none recorded in this pass</span> : (
              <ul className="list-disc pl-5 text-sm grid gap-1">{sf.contraindications.map((c, i) => <li key={i}><Prose md={c.md} className="bx-inline" /></li>)}</ul>
            )}
          </dd>
        </div>
      </dl>
      <p className="mt-2 text-xs bx-muted">Monograph status — EMA HMPC: {mono(s.monograph_status.ema_hmpc)} · ESCOP: {mono(s.monograph_status.escop)} · WHO: {mono(s.monograph_status.who)}</p>
      <p className="mt-2 text-xs bx-muted">Thresholds are regulatory or toxicological limits from the cited sources, not guidance for use. This site gives no dosing and is not medical advice.</p>
    </section>
  );
}

function mono(m: { exists: boolean | null; url: string | null }) {
  if (m.exists === null) return <span className="bx-todo !text-[10px]">not checked</span>;
  if (!m.exists) return 'none';
  return m.url ? <a className="underline" href={m.url} target="_blank" rel="noreferrer">yes</a> : 'yes';
}
