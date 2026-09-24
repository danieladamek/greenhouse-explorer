import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { COLUMN_LABEL, familyColour, taxaIndex } from '@/lib/data';
import { DepthChip, FamilyChip, IdentityChip, TaxonName } from '@/components/catalogue/Chips';

const FAMILIES = [...new Set(taxaIndex.map((t) => t.family))].sort();
const COLUMNS = Object.keys(COLUMN_LABEL);
const STATUSES = ['confirmed', 'check', 'unresolved'];
const DEPTHS = ['deep', 'light', 'guest', 'stub'];

/**
 * /plants (KICKOFF §4c): all 47 taxon records grouped by family, with identity and profile-depth chips and the
 * number of plantings. Stubs are listed, never hidden. Filters live in the URL.
 */
export default function Plants() {
  const [params, setParams] = useSearchParams();
  const fam = params.get('family') ?? '';
  const col = params.get('column') ?? '';
  const status = params.get('status') ?? '';
  const depth = params.get('depth') ?? '';
  const q = (params.get('q') ?? '').toLowerCase();
  const set = (k: string, v: string) => { const p = new URLSearchParams(params); if (v) p.set(k, v); else p.delete(k); setParams(p, { replace: true }); };

  const list = useMemo(() => taxaIndex.filter((t) =>
    (!fam || t.family === fam) && (!col || t.columns.includes(col)) && (!status || t.identity_status === status) && (!depth || t.profile_depth === depth)
    && (!q || `${t.accepted_name} ${t.common_names.join(' ')}`.toLowerCase().includes(q))), [fam, col, status, depth, q]);
  const grouped = FAMILIES.map((f) => ({ f, taxa: list.filter((t) => t.family === f).sort((a, b) => a.accepted_name.localeCompare(b.accepted_name)) })).filter((g) => g.taxa.length);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-3xl sm:text-4xl">Plants</h1>
      <p className="bx-prose mt-2 max-w-3xl">
        Every taxon on the greenhouse inventory has a page — {taxaIndex.length} records for the inventory's species, including the unresolved skullcap entry and its two candidate species.
        {' '}{taxaIndex.filter((t) => t.profiled).length} are profiled; the other {taxaIndex.filter((t) => !t.profiled).length} show their identity and what is grown, with the profile still in progress.
        {' '}See what is on the benches now on <Link className="underline" to="/greenhouse">Greenhouse</Link>.
      </p>
      <form className="mt-5 grid gap-2 sm:grid-cols-5 text-sm" role="search" aria-label="Filter plants" onSubmit={(e) => e.preventDefault()}>
        <label className="sm:col-span-5 sm:max-w-md"><span className="sr-only">Search plants</span><input className="bx-input" type="search" placeholder="Search by name…" value={params.get('q') ?? ''} onChange={(e) => set('q', e.target.value)} /></label>
        <label><span className="block text-xs bx-muted mb-0.5">Family</span><select className="bx-input" value={fam} onChange={(e) => set('family', e.target.value)}><option value="">all families</option>{FAMILIES.map((f) => <option key={f}>{f}</option>)}</select></label>
        <label><span className="block text-xs bx-muted mb-0.5">Inventory column</span><select className="bx-input" value={col} onChange={(e) => set('column', e.target.value)}><option value="">all columns</option>{COLUMNS.map((c) => <option key={c} value={c}>{COLUMN_LABEL[c]}</option>)}</select></label>
        <label><span className="block text-xs bx-muted mb-0.5">Identity</span><select className="bx-input" value={status} onChange={(e) => set('status', e.target.value)}><option value="">any identity status</option>{STATUSES.map((c) => <option key={c}>{c}</option>)}</select></label>
        <label><span className="block text-xs bx-muted mb-0.5">Profile</span><select className="bx-input" value={depth} onChange={(e) => set('depth', e.target.value)}><option value="">any profile depth</option>{DEPTHS.map((c) => <option key={c} value={c}>{c === 'stub' ? 'in progress' : c}</option>)}</select></label>
        <p className="self-end text-sm bx-muted" role="status">{list.length} of {taxaIndex.length}</p>
      </form>
      <div className="mt-6 grid gap-8">
        {grouped.map(({ f, taxa }) => (
          <section key={f} aria-labelledby={`fam-${f}`}>
            <h2 id={`fam-${f}`} className="text-2xl flex items-center gap-2"><span className="inline-block h-3 w-3 rounded-full" style={{ background: familyColour(f) }} aria-hidden="true" />{f} <span className="text-sm bx-muted font-body">{taxa.length}</span></h2>
            <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {taxa.map((t) => (
                <li key={t.id} className="bx-card p-3 border-l-4" style={{ borderLeftColor: familyColour(t.family) }} data-testid={`plant-${t.id}`}>
                  <p className="text-[15px] leading-tight"><TaxonName id={t.id} /></p>
                  <p className="text-sm bx-muted">{t.common_names.join(', ')}</p>
                  <p className="mt-2 flex flex-wrap gap-1 text-xs">
                    <IdentityChip status={t.identity_status} />
                    <DepthChip depth={t.profile_depth} />
                    <span className="bx-status">{t.n_plantings ? `${t.n_plantings} planting${t.n_plantings === 1 ? '' : 's'}` : t.candidate_of ? 'candidate, not planted' : 'not planted'}</span>
                    {t.compounds.length > 0 && <span className="bx-status">{t.compounds.length} compounds</span>}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        ))}
        {!grouped.length && <p className="bx-muted">No plant matches these filters.</p>}
      </div>
      <p className="mt-8 text-sm bx-muted">Families: {FAMILIES.map((f, i) => <span key={f}>{i ? ' · ' : ''}<FamilyChip family={f} /></span>)}</p>
    </div>
  );
}
