import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CLASSES, colourForGroup, compoundsIndex, families, taxaIndex } from '@/lib/data';
import { applyFilters, filtersToParams, paramsToFilters, type CompoundFilters } from '@/lib/filters';
import { BASIS_LABEL, BASES } from '@/lib/basis';
import { useTray } from '@/lib/tray';
import type { CompoundMeta } from '@/types';
import { ClassIcon, TaxonName } from '@/components/catalogue/Chips';
import StructureThumb from '@/components/viewer/StructureThumb';

const PROFILED = taxaIndex.filter((t) => t.compounds.length > 0).sort((a, b) => a.accepted_name.localeCompare(b.accepted_name));
const PARTS = [...new Set(compoundsIndex.flatMap((c) => c.parts))].sort();
const FAMILY_IDS = families.filter((f) => f.compounds.length).map((f) => f.id);

function Card({ c, q }: { c: CompoundMeta; q: string }) {
  const tray = useTray();
  const inTray = tray.has('compounds', c.id);
  const colour = colourForGroup(c.palette_group);
  return (
    <li className="bx-card p-3 flex flex-col border-t-4" style={{ borderTopColor: colour }} data-testid={`compound-card-${c.id}`}>
      <div className="rounded-md bg-paper-card dark:bg-night-card border border-[color:var(--bx-line)]" data-testid={`thumb-${c.id}`}>
        {c.svg ? <StructureThumb svg={c.svg} name={c.name} /> : <div className="aspect-[4/3] grid place-items-center text-xs bx-muted">no single structure</div>}
      </div>
      <h2 className="mt-2 text-lg leading-tight"><Link className="underline decoration-dotted" to={`/compounds/${c.id}${q ? `?f=${encodeURIComponent(q)}` : ''}`}>{c.name}</Link></h2>
      <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs leading-5">
        <span className="inline-flex items-center gap-1 leading-5"><ClassIcon cls={c.class} />{CLASSES.find((x) => x.id === c.class)?.label ?? c.class}</span>
        {c.formula && <span className="bx-muted font-mono leading-5">{c.formula}</span>}
      </p>
      <p className="mt-2 text-sm leading-6 flex-1">{c.one_liner}</p>
      <p className="mt-2 text-xs"><span className="font-semibold">In {c.taxa.length} plant{c.taxa.length === 1 ? '' : 's'}: </span>{c.taxa.map((t, i) => <span key={t}>{i ? ', ' : ''}<TaxonName id={t} link={false} /></span>)}</p>
      <p className="mt-2 flex flex-wrap gap-1 text-[11px]">
        {c.evidence ? <span className="bx-status">{c.evidence} evidence row{c.evidence === 1 ? '' : 's'} ({c.grades.join(' ')})</span> : <span className="bx-todo">no evidence rows</span>}
        {c.safety_flags > 0 && <span className="bx-chip border border-rose-700/50 text-rose-900 dark:text-rose-200">safety flag</span>}
        {c.auxiliary && <span className="bx-status">auxiliary</span>}
      </p>
      <button type="button" className={`bx-btn mt-2 self-start !text-xs ${inTray ? 'bx-btn-on' : ''}`} aria-pressed={inTray} disabled={!inTray && tray.full('compounds')} onClick={() => tray.toggle('compounds', c.id)} aria-label={`${inTray ? 'Remove' : 'Add'} ${c.name} ${inTray ? 'from' : 'to'} the comparison`}>{inTray ? '✓ Comparing' : '+ Compare'}</button>
    </li>
  );
}

type MultiKey = 'classes' | 'families' | 'plants' | 'parts' | 'basis';
function Multi({ k, label, options, f, toggle }: { k: MultiKey; label: string; options: { v: string; l: React.ReactNode }[]; f: CompoundFilters; toggle: (k: MultiKey, v: string) => void }) {
  return (
    <details className="bx-card p-2 text-sm" open={f[k].length > 0 || undefined}>
      <summary className="cursor-pointer font-semibold">{label}{f[k].length > 0 && <span className="bx-muted font-normal"> ({f[k].length})</span>}</summary>
      <div className="mt-2 grid gap-1 max-h-56 overflow-y-auto">
        {options.map((o) => (
          <label key={o.v} className="flex items-center gap-2"><input type="checkbox" checked={f[k].includes(o.v)} onChange={() => toggle(k, o.v)} />{o.l}</label>
        ))}
      </div>
    </details>
  );
}

/** /compounds (KICKOFF §4b, feature A2): the curated compounds, filterable, every filter in the URL. */
export default function Compounds() {
  const [params, setParams] = useSearchParams();
  const f = paramsToFilters(params);
  const list = useMemo(() => applyFilters(compoundsIndex, f), [params]); // eslint-disable-line react-hooks/exhaustive-deps
  const update = (patch: Partial<CompoundFilters>) => setParams(filtersToParams({ ...f, ...patch }), { replace: true });
  const toggle = (k: 'classes' | 'families' | 'plants' | 'parts' | 'basis', v: string) => update({ [k]: f[k].includes(v) ? f[k].filter((x) => x !== v) : [...f[k], v] });
  const qs = params.toString();
  const shown = compoundsIndex.filter((c) => f.aux || !c.auxiliary).length;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="text-3xl sm:text-4xl">Compounds</h1>
      <p className="bx-prose mt-2 max-w-3xl">
        The curated constituents of the profiled plants: {compoundsIndex.filter((c) => !c.auxiliary).length} records{compoundsIndex.some((c) => c.auxiliary) ? ', plus one auxiliary record hidden unless you ask for it' : ''}.
        Each has its structure, where it has been found and in what amount — always with the basis of the measurement — and the graded evidence behind anything said about it.
        Filters are kept in the address bar, so a view can be shared.
      </p>
      <div className="mt-5 grid gap-6 lg:grid-cols-[16rem_minmax(0,1fr)]">
        <aside aria-label="Filters" className="flex flex-col gap-2">
          <label className="text-sm"><span className="sr-only">Search compounds</span><input className="bx-input" type="search" placeholder="Name, synonym, formula, InChIKey…" value={f.q} onChange={(e) => update({ q: e.target.value })} data-testid="compound-search" /></label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.human} onChange={(e) => update({ human: e.target.checked })} /> Has evidence in people (A–C)</label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.safety} onChange={(e) => update({ safety: e.target.checked })} /> Has a safety flag</label>
          <Multi f={f} toggle={toggle} k="classes" label="Class" options={CLASSES.filter((c) => compoundsIndex.some((x) => x.class === c.id)).map((c) => ({ v: c.id, l: <span className="inline-flex items-center gap-1.5"><ClassIcon cls={c.id} />{c.label}</span> }))} />
          <Multi f={f} toggle={toggle} k="families" label="Plant family" options={FAMILY_IDS.map((id) => ({ v: id, l: families.find((x) => x.id === id)?.family ?? id }))} />
          <Multi f={f} toggle={toggle} k="plants" label="Plant" options={PROFILED.map((t) => ({ v: t.id, l: <span><i>{t.accepted_name}</i> <span className="bx-muted">{t.common_names[0]}</span></span> }))} />
          <Multi f={f} toggle={toggle} k="parts" label="Plant part" options={PARTS.map((p) => ({ v: p, l: p }))} />
          <Multi f={f} toggle={toggle} k="basis" label="Measurement basis" options={BASES.map((b) => ({ v: b, l: BASIS_LABEL[b] }))} />
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.aux} onChange={(e) => update({ aux: e.target.checked })} /> Show auxiliary records</label>
          <label className="text-sm"><span className="block text-xs bx-muted mb-0.5">Sort</span>
            <select className="bx-input" value={`${f.sort}:${f.dir}`} onChange={(e) => { const [s, d] = e.target.value.split(':'); update({ sort: s as CompoundFilters['sort'], dir: d as CompoundFilters['dir'] }); }}>
              <option value="name:asc">name A–Z</option><option value="name:desc">name Z–A</option><option value="class:asc">class</option><option value="plants:asc">most plants first</option>
            </select>
          </label>
          {qs && <button type="button" className="bx-btn self-start" onClick={() => setParams(new URLSearchParams(), { replace: true })}>Clear filters</button>}
        </aside>
        <div>
          <p className="text-sm bx-muted" role="status" data-testid="compound-count">{list.length} of {shown} compounds</p>
          <ul className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {list.map((c) => <Card key={c.id} c={c} q={qs} />)}
          </ul>
          {!list.length && <p className="mt-6 bx-muted">No compound matches these filters.</p>}
        </div>
      </div>
    </div>
  );
}
