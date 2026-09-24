import { Link } from 'react-router-dom';
import { COLUMN_LABEL, INVENTORY_DATE, familyColour, getTaxonMeta } from '@/lib/data';
import { loadPlantings, useAsync } from '@/lib/heavy';
import { DepthChip, FamilyChip, IdentityChip, TaxonName } from '@/components/catalogue/Chips';
import type { Planting } from '@/types';


/**
 * /greenhouse (KICKOFF §4c): the inventory as the greenhouse keeps it. Every row links to its taxon page; the
 * inventory's own note column is shown (typos corrected, duplicates, "check packet"). All 91 rows are current: the
 * inventory is dated 2025-10-25 and has no history yet, so "past plantings" says it is empty.
 */
export default function Greenhouse() {
  const data = useAsync(loadPlantings);
  if (!data) return <div className="mx-auto max-w-6xl px-4 py-8"><h1 className="text-3xl sm:text-4xl">What's growing</h1><p className="mt-4 bx-muted" role="status">Loading the inventory…</p></div>;
  const current = data.rows.filter((r) => r.status === 'current');
  const past = data.rows.filter((r) => r.status === 'past');
  const byFamily = [...new Set(current.map((r) => r.family))].map((f) => ({ f, rows: current.filter((r) => r.family === f) })).sort((a, b) => b.rows.length - a.rows.length || a.f.localeCompare(b.f));
  const byColumn = Object.entries(current.reduce<Record<string, number>>((a, r) => { a[r.list_category] = (a[r.list_category] ?? 0) + 1; return a; }, {}));
  const species = new Set(current.map((r) => r.taxon_id)).size;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-3xl sm:text-4xl">What's growing</h1>
      <p className="bx-prose mt-2 max-w-3xl">
        The greenhouse inventory dated <strong>{data.inventory_date ?? INVENTORY_DATE}</strong>: {current.length} plantings of {species} taxa in {byFamily.length} families.
        Each row is shown as the inventory wrote it, with the cleaned name, the identity status and the inventory's own notes; each links to its plant page.
        History begins when the greenhouse manager's next list arrives.
      </p>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <section className="bx-card p-4" aria-labelledby="byfam-h">
          <h2 id="byfam-h" className="text-lg">Plantings by family</h2>
          <ul className="mt-2 grid gap-1 text-sm">
            {byFamily.map(({ f, rows }) => (
              <li key={f} className="flex items-center gap-2">
                <a href={`#fam-${f}`} className="w-32 underline">{f}</a>
                <span className="h-3 rounded" style={{ width: `${rows.length * 6}px`, background: familyColour(f) }} aria-hidden="true" />
                <span className="tabular-nums">{rows.length}</span>
              </li>
            ))}
          </ul>
        </section>
        <section className="bx-card p-4" aria-labelledby="bycol-h">
          <h2 id="bycol-h" className="text-lg">Plantings by inventory column</h2>
          <ul className="mt-2 grid gap-1 text-sm">{byColumn.map(([c, n]) => <li key={c} className="flex justify-between max-w-xs"><span>{c}</span><span className="tabular-nums">{n}</span></li>)}</ul>
          <p className="mt-3 text-xs bx-muted">Columns as the inventory uses them ({Object.values(COLUMN_LABEL).join(', ')}). A species can sit in more than one.</p>
        </section>
      </div>

      <h2 className="text-2xl mt-10">Current plantings</h2>
      <div className="mt-2 grid gap-8">
        {byFamily.map(({ f, rows }) => (
          <section key={f} id={`fam-${f}`} aria-labelledby={`h-fam-${f}`} className="scroll-mt-36">
            <h3 id={`h-fam-${f}`} className="text-xl flex items-center gap-2"><FamilyChip family={f} /> <span className="text-sm bx-muted font-body">{rows.length} plantings</span></h3>
            <InventoryTable rows={rows} />
          </section>
        ))}
      </div>

      <section className="mt-10" aria-labelledby="past-h">
        <h2 id="past-h" className="text-2xl">Past plantings</h2>
        {past.length ? <InventoryTable rows={past} /> : (
          <p className="mt-2 bx-prose" data-testid="past-empty">Empty in the prototype. The only inventory so far is the one dated {data.inventory_date ?? INVENTORY_DATE}, so every row above is current; a planting moves here when a later list no longer carries it.</p>
        )}
      </section>
    </div>
  );
}

function InventoryTable({ rows }: { rows: Planting[] }) {
  return (
    <>
      <div className="hidden md:block overflow-x-auto mt-2">
        <table className="bx-table">
          <thead><tr><th scope="col">Id</th><th scope="col">As the inventory wrote it</th><th scope="col">Plant</th><th scope="col">Cultivar · type</th><th scope="col">Identity</th><th scope="col">Inventory note</th></tr></thead>
          <tbody>
            {rows.map((r) => {
              const t = getTaxonMeta(r.taxon_id);
              return (
                <tr key={r.id} data-testid="planting-row">
                  <td className="font-mono text-xs">{r.id}</td>
                  <td>{r.original_entry}<span className="block text-xs bx-muted">{r.list_category}</span></td>
                  <td><TaxonName id={r.taxon_id} /><span className="block text-xs bx-muted">{r.common_name}</span>{t && <span className="block mt-0.5"><DepthChip depth={t.profile_depth} /></span>}</td>
                  <td className="text-xs">{r.cultivar || '—'}{r.crop_type && <span className="block bx-muted">{r.crop_type}</span>}</td>
                  <td>{r.identity_status ? <IdentityChip status={r.identity_status} /> : <span className="bx-todo">no cultivar record</span>}<span className="block text-[11px] bx-muted mt-0.5">inventory confidence: {r.confidence}</span></td>
                  <td className="text-xs max-w-[22rem]">{r.note || <span className="bx-muted">—</span>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <ul className="md:hidden mt-2 grid gap-2">
        {rows.map((r) => (
          <li key={r.id} className="bx-card p-3 text-sm">
            <div className="flex flex-wrap items-baseline gap-2"><Link to={`/plants/${r.taxon_id}`} className="font-semibold underline">{r.original_entry}</Link><span className="font-mono text-xs bx-muted">{r.id}</span></div>
            <p className="text-xs mt-0.5"><TaxonName id={r.taxon_id} link={false} /> · {r.cultivar || 'cultivar not given'}</p>
            <p className="mt-1">{r.identity_status ? <IdentityChip status={r.identity_status} /> : <span className="bx-todo">no cultivar record</span>}</p>
            {r.note && <p className="text-xs mt-1">{r.note}</p>}
          </li>
        ))}
      </ul>
    </>
  );
}
