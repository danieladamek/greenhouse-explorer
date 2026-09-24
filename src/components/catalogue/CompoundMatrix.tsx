import { Link } from 'react-router-dom';
import { formatAmount } from '@/lib/basis';
import { getCompoundMeta } from '@/lib/data';
import { compoundMatrix } from '@/lib/models';
import type { OccurrenceRow } from '@/types';
import { BasisChip, ClassIcon, TaxonName } from './Chips';

/**
 * Compounds × plants, presence and amount (KICKOFF §4c skullcap showcase, §4b ?plants=). Every amount keeps its
 * unit, basis and plant part — the point of the skullcap matrix is to make "aerial parts" vs "root" visible — and
 * nothing is compared across cells numerically. A dash means "no row for this plant in the catalogue", which is
 * not the same as "absent from the plant".
 */
export default function CompoundMatrix({ taxa, rows, caption }: { taxa: string[]; rows: OccurrenceRow[]; caption?: string }) {
  const m = compoundMatrix(taxa, rows);
  if (!m.cells.length) return <p className="mt-2"><span className="bx-todo">No curated compounds recorded for these plants.</span></p>;
  return (
    <div className="mt-3" data-testid="compound-matrix">
      {caption && <p className="text-sm bx-muted mb-2">{caption}</p>}
      <div className="overflow-x-auto">
        <table className="bx-table min-w-[36rem]">
          <thead>
            <tr>
              <th scope="col">Compound</th>
              {taxa.map((t) => <th key={t} scope="col"><TaxonName id={t} withCommon /></th>)}
            </tr>
          </thead>
          <tbody>
            {m.cells.map((x) => {
              const meta = getCompoundMeta(x.compound_id);
              return (
                <tr key={x.compound_id} data-testid="matrix-row">
                  <th scope="row" className="font-normal">
                    <Link to={`/compounds/${x.compound_id}`} className="inline-flex items-center gap-1.5 underline decoration-dotted">{meta && <ClassIcon cls={meta.class} />}{x.compound}</Link>
                    {m.shared.includes(x.compound_id) && <span className="ml-1 bx-status !text-[10px]">shared</span>}
                  </th>
                  {taxa.map((t) => (
                    <td key={t}>
                      {!x.by[t].length ? <span className="bx-muted" aria-label="no row in the catalogue">—</span> : (
                        <ul className="grid gap-1.5">
                          {x.by[t].map((r) => {
                            const f = formatAmount(r);
                            return (
                              <li key={r.row} className="text-xs leading-5">
                                <span className="font-mono text-[12px]">{f.amount}</span> <BasisChip basis={r.basis} />
                                <span className="block bx-muted">{r.plant_part ?? 'part not stated'}{!r.verified && <span className="bx-todo ml-1">unverified</span>}</span>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs bx-muted">— = no row for that plant in this prototype's catalogue, not a finding of absence. Amounts are never converted between bases or units.</p>
    </div>
  );
}
