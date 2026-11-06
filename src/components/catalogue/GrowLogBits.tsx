import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { forTaxa, loadGrowLog, methodLabel, type GrowLog } from '@/lib/growlog';

function useGrowLog() {
  const [g, setG] = useState<GrowLog | null>(null);
  useEffect(() => { let live = true; loadGrowLog().then((x) => { if (live) setG(x); }); return () => { live = false; }; }, []);
  return g;
}

export function MethodChip({ method }: { method: string | null }) {
  const cls = method === 'hydroponic' ? '!bg-sky-100 text-sky-900 dark:!bg-sky-900/40 dark:text-sky-100' : method === 'soil' ? '!bg-amber-100 text-amber-900 dark:!bg-amber-900/40 dark:text-amber-100' : 'bx-muted';
  return <span className={`bx-chip ${cls}`}>{methodLabel(method)}</span>;
}

/** Plant pages: what the greenhouse's own grow log records for this plant (or, on the skullcap page, its candidates). */
export function InGrowLog({ ids, unresolvedNote }: { ids: string[]; unresolvedNote?: boolean }) {
  const g = useGrowLog();
  if (!g) return null;
  const mine = forTaxa(g, ids);
  if (!mine.plantings.length && !mine.harvests.length && !mine.seeds.length) return null;
  return (
    <section aria-labelledby="growlog-h" className="mt-8" id="in-the-grow-log" data-testid="in-grow-log">
      <h2 id="growlog-h" className="text-2xl">In the grow log</h2>
      <p className="mt-1 text-sm bx-muted">
        What the greenhouse records about this plant: where it grows, how, and what has been harvested. Greenhouse records, not scientific claims ·{' '}
        <Link className="underline" to="/grow-log">the full grow log →</Link>
      </p>
      {unresolvedNote && mine.plantings.length > 0 && (
        <p className="mt-2 text-sm bx-card p-3 border-l-4 border-l-amber-600" data-testid="growlog-identity-hint">
          The grow log names {mine.plantings.map((p) => <i key={p.id}>{p.accepted_name}</i>)} for the skullcap on the bench ({mine.plantings.map((p) => p.id).join(', ')}).
          If that comes from the label or seed packet, it resolves this entry.
        </p>
      )}
      {mine.plantings.length > 0 && (
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {mine.plantings.map((p) => {
            const obs = mine.observations.filter((o) => o.planting_id === p.id).sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''))[0];
            return (
              <li key={p.id} className="bx-card p-3 text-sm" data-testid="growlog-planting">
                <div className="flex flex-wrap items-center gap-2">
                  <Link to={`/grow-log#${p.id}`} className="font-mono text-xs underline">{p.id}</Link>
                  <span className="font-semibold">{p.crop}</span>
                  <MethodChip method={p.method} />
                </div>
                <p className="mt-1 text-xs">
                  {p.location ? <>Location <strong>{p.location}</strong>{p.location_note && ` (${p.location_note})`}</> : <span className="bx-todo">location not recorded</span>}
                  {' · '}planted {p.date_planted ?? <span className="bx-muted">date not recorded</span>}{p.date_inventoried && <> · inventoried {p.date_inventoried}</>}
                </p>
                {obs && <p className="mt-1 text-xs"><span className="font-semibold">Last check ({obs.date}{obs.observer ? `, ${obs.observer}` : ''}): </span>{obs.condition}{obs.pest_disease && <> · {obs.pest_disease}</>}</p>}
              </li>
            );
          })}
        </ul>
      )}
      {mine.harvests.length > 0 && (
        <div className="mt-3 overflow-x-auto">
          <table className="bx-table text-xs">
            <caption className="text-left text-sm font-semibold mb-1">Harvest and drying lots</caption>
            <thead><tr><th scope="col">Lot</th><th scope="col">Date</th><th scope="col">Part</th><th scope="col">Fresh</th><th scope="col">Dry</th><th scope="col">Drying</th><th scope="col">From</th></tr></thead>
            <tbody>
              {mine.harvests.map((h) => (
                <tr key={h.id}>
                  <td className="font-mono"><Link className="underline" to={`/grow-log#${h.id}`}>{h.id}</Link></td><td>{h.date}</td><td>{h.part}</td>
                  <td>{h.fresh_g != null ? `${h.fresh_g} g` : <span className="bx-muted">—</span>}</td><td>{h.dry_g != null ? `${h.dry_g} g` : '—'}</td>
                  <td>{h.drying}</td><td>{h.planting_id ? <>{h.planting_id} · {methodLabel(h.method)}</> : <span className="bx-todo">planting not recorded</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {mine.seeds.length > 0 && <p className="mt-2 text-xs"><span className="font-semibold">Seed on hand: </span>{mine.seeds.map((s, i) => <span key={s.id}>{i ? '; ' : ''}{s.cultivar ?? s.plant} ({s.supplier})</span>)}</p>}
    </section>
  );
}

/** Tea Time cards: the latest harvest lots of the plants a preparation uses, from the greenhouse's own benches. */
export function FromOurBenches({ plants }: { plants: string[] }) {
  const g = useGrowLog();
  if (!g) return null;
  const lots = forTaxa(g, plants).harvests.sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''));
  if (!lots.length) return null;
  const latest = lots.filter((l) => l.date === lots[0].date);
  const dry = Math.round(latest.reduce((a, l) => a + (l.dry_g ?? 0), 0) * 10) / 10;
  return (
    <p className="mt-3 text-sm bx-card p-2.5 border-l-4 border-l-[color:var(--bx-accent)]" data-testid="from-our-benches">
      <span className="font-semibold">From our benches: </span>
      harvested {latest[0].date} — {latest.map((l) => l.plant).filter((v, i, a) => a.indexOf(v) === i).join(', ')}, {latest.map((l) => l.part).filter((v, i, a) => a.indexOf(v) === i).join(' / ')},
      {' '}{dry} g dried ({latest.map((l) => l.drying).filter((v, i, a) => v && a.indexOf(v) === i).join(', ').toLowerCase() || 'method not recorded'}) in {latest.length} lot{latest.length > 1 ? 's' : ''}{' '}
      ({latest.map((l, i) => <span key={l.id}>{i ? ', ' : ''}<Link className="underline" to={`/grow-log#${l.id}`}>{l.id}</Link></span>)}).
      <span className="bx-muted"> A greenhouse record of what was harvested, not a preparation instruction.</span>
    </p>
  );
}
