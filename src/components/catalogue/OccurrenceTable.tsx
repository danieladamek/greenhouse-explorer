import { Link } from 'react-router-dom';
import { formatAmount } from '@/lib/basis';
import { doiUrl, getCompoundMeta } from '@/lib/data';
import type { OccurrenceRow } from '@/types';
import { BasisChip, ClassIcon, TaxonName } from './Chips';

/** Everything a rendered occurrence row shows, computed once — the unit test runs every row through this. */
export function occurrenceCells(r: OccurrenceRow) {
  const f = formatAmount(r);
  return {
    amount: f.amount,
    basis: f.basis,
    quantitative: f.quantitative,
    level: r.level === 'cultivar' ? `cultivar ${r.cultivar ?? '(unnamed)'} — the study's plant, not the greenhouse's` : 'species-level (not measured on the greenhouse plants)',
    part: r.plant_part ?? 'plant part not stated',
  };
}

function SourceCell({ r }: { r: OccurrenceRow }) {
  const url = r.source_doi_or_url ? doiUrl(r.source_doi_or_url) : null;
  return (
    <span className="text-xs leading-5">
      {r.source_citation}
      {url && <> <a className="underline" href={url} target="_blank" rel="noreferrer">source</a></>}
      {r.database && <span className="bx-muted"> · via {r.database_url ? <a className="underline" href={r.database_url} target="_blank" rel="noreferrer">{r.database}</a> : r.database}</span>}
      {r.refs.length > 0 && <> · {r.refs.map((n) => <Link key={n} className="underline" to={`/references#ref-${n}`}>[{n}]</Link>)}</>}
    </span>
  );
}

function Subject({ r, by }: { r: OccurrenceRow; by: 'taxon' | 'compound' }) {
  if (by === 'compound') {
    const c = getCompoundMeta(r.compound_id);
    return <Link to={`/compounds/${r.compound_id}`} className="inline-flex items-center gap-1.5 underline decoration-dotted font-semibold">{c && <ClassIcon cls={c.class} />}{r.compound}</Link>;
  }
  if (!r.taxon_known) return <span><i>{r.taxon_id}</i> <span className="bx-todo">no taxa.yaml record — see Methods</span></span>;
  return <TaxonName id={r.taxon_id} withCommon />;
}

/**
 * The occurrence table (KICKOFF §4b "Where it's found"; §4c "Curated compounds"). Every row renders with its amount,
 * unit, basis, level and source; `unstated` says "basis not stated in source"; `presence_only` says "reported
 * present" (or the qualitative statement as written) and shows no number. Rows are never averaged or converted.
 */
export default function OccurrenceTable({ rows, by, caption }: { rows: OccurrenceRow[]; by: 'taxon' | 'compound'; caption?: string }) {
  if (!rows.length) return <p className="mt-2"><span className="bx-todo">No occurrence rows in this record.</span></p>;
  return (
    <div className="mt-3" data-testid="occurrence-table">
      {caption && <p className="text-sm bx-muted mb-2">{caption}</p>}
      {/* wide screens: a table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="bx-table">
          <thead>
            <tr>
              <th scope="col">{by === 'taxon' ? 'Plant' : 'Compound'}</th><th scope="col">Part</th><th scope="col">Amount</th><th scope="col">Basis</th><th scope="col">Level</th><th scope="col">Source</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const c = occurrenceCells(r);
              return (
                <tr key={r.row} data-testid="occurrence-row" data-basis={r.basis}>
                  <td><Subject r={r} by={by} />{!r.verified && <div className="mt-1"><span className="bx-todo">unverified row</span></div>}</td>
                  <td className="text-xs">{c.part}</td>
                  <td className="whitespace-nowrap font-mono text-[13px]" data-testid="amount">{c.amount}</td>
                  <td><BasisChip basis={r.basis} /></td>
                  <td className="text-xs">{c.level}</td>
                  <td className="max-w-[26rem]"><SourceCell r={r} />{r.note && <details className="mt-1 text-xs"><summary className="cursor-pointer bx-muted">Extraction note</summary><p className="mt-1 whitespace-pre-line">{r.note}</p></details>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {/* narrow screens: one card per row, same fields */}
      <ul className="md:hidden grid gap-2">
        {rows.map((r) => {
          const c = occurrenceCells(r);
          return (
            <li key={r.row} className="bx-card p-3 text-sm" data-basis={r.basis}>
              <div className="flex flex-wrap items-center gap-2"><Subject r={r} by={by} />{!r.verified && <span className="bx-todo">unverified row</span>}</div>
              <p className="mt-1"><span className="font-mono">{c.amount}</span> <BasisChip basis={r.basis} /></p>
              <p className="mt-1 text-xs bx-muted">{c.part} · {c.level}</p>
              <p className="mt-1"><SourceCell r={r} /></p>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
