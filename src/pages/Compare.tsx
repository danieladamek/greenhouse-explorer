import { lazy, Suspense, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { BASES, type Basis } from '@/lib/basis';
import { PREBUILT, assetUrl, compoundsIndex, getCompoundMeta, getTaxonMeta, primaryCompounds, taxaIndex } from '@/lib/data';
import { loadCompounds, loadOccurrences, loadTaxa, useAsync } from '@/lib/heavy';
import { compoundMatrix } from '@/lib/models';
import { useTray } from '@/lib/tray';
import { hasWebGL } from '@/lib/webgl';
import type { Compound, Grade, OccurrenceRow, Taxon } from '@/types';
import type { MolViewerHandle } from '@/components/viewer/MolViewer';
import StructureThumb from '@/components/viewer/StructureThumb';
import { DEFAULT_VIEWER_OPTIONS, type ViewerOptions } from '@/components/viewer/options';
import AmountChart from '@/components/catalogue/AmountChart';
import CompoundMatrix from '@/components/catalogue/CompoundMatrix';
import EvidenceTable from '@/components/catalogue/EvidenceTable';
import { ClassIcon, GradeBadge, TaxonName, TestArticleChip } from '@/components/catalogue/Chips';
import { Prose } from '@/components/catalogue/Record';
import { TaxonSafetyBlock } from '@/components/catalogue/Safety';
import { formatAmount } from '@/lib/basis';
import { BasisChip } from '@/components/catalogue/Chips';

const MolViewer = lazy(() => import('@/components/viewer/MolViewer'));


const GRADES: Grade[] = ['A', 'B', 'C', 'D', 'E', 'T'];
const parseList = (v: string | null) => (v ?? '').split(',').filter(Boolean);

/**
 * /compare (KICKOFF §4b): two directions, both URL-addressable. ?ids= puts 2–4 compounds side by side; ?plants= puts
 * 2–4 plants side by side. In both, a quantitative chart appears only for rows that share one basis (chosen
 * explicitly with ?basis=); a mixed selection is refused, and unstated / presence-only rows never reach it.
 */
export default function Compare() {
  const [params, setParams] = useSearchParams();
  const tray = useTray();
  const ids = parseList(params.get('ids')).filter((x) => getCompoundMeta(x)).slice(0, 4);
  const plants = parseList(params.get('plants')).filter((x) => getTaxonMeta(x)).slice(0, 4);
  const basisParam = params.get('basis');
  const basis = (BASES as readonly string[]).includes(basisParam ?? '') ? (basisParam as Basis) : null;
  const setBasis = (b: Basis | null) => { const p = new URLSearchParams(params); if (b) p.set('basis', b); else p.delete('basis'); setParams(p, { replace: true }); };
  const mode: 'ids' | 'plants' | 'none' = ids.length ? 'ids' : plants.length ? 'plants' : 'none';

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="text-3xl sm:text-4xl">Compare</h1>
      <div className="mt-3 flex flex-wrap gap-2" role="tablist" aria-label="Compare direction">
        <Link role="tab" aria-selected={mode === 'ids'} className={`bx-btn ${mode === 'ids' ? 'bx-btn-on' : ''}`} to={`/compare?ids=${(ids.length ? ids : tray.compounds.length >= 2 ? tray.compounds : ['thymol', 'carvacrol', 'linalool']).join(',')}`}>Compounds side by side</Link>
        <Link role="tab" aria-selected={mode === 'plants'} className={`bx-btn ${mode === 'plants' ? 'bx-btn-on' : ''}`} to={`/compare?plants=${(plants.length ? plants : tray.plants.length >= 2 ? tray.plants : ['scutellaria-lateriflora', 'scutellaria-baicalensis']).join(',')}`}>Plants side by side</Link>
      </div>
      {mode === 'none' && (
        <div className="mt-6">
          <p className="bx-prose max-w-3xl">Put two to four compounds, or two to four plants, side by side. Add them from any compound or plant page with “Compare with…”, or start from a ready-made comparison.</p>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">{PREBUILT.map((c) => <li key={c.to}><Link to={c.to} className="bx-card block p-4 hover:shadow-md"><span className="font-display text-lg">{c.title}</span><span className="block text-sm bx-muted mt-1">{c.blurb}</span></Link></li>)}</ul>
        </div>
      )}
      {mode === 'ids' && <CompareCompounds ids={ids} basis={basis} setBasis={setBasis} />}
      {mode === 'plants' && <ComparePlants ids={plants} basis={basis} setBasis={setBasis} />}
    </div>
  );
}

function Picker({ kind, ids }: { kind: 'ids' | 'plants'; ids: string[] }) {
  const [params, setParams] = useSearchParams();
  const options = kind === 'ids' ? primaryCompounds.map((c) => ({ id: c.id, label: c.name })) : taxaIndex.filter((t) => t.compounds.length).map((t) => ({ id: t.id, label: `${t.accepted_name} (${t.common_names[0]})` }));
  const set = (next: string[]) => { const p = new URLSearchParams(params); p.set(kind, next.join(',')); setParams(p, { replace: true }); };
  return (
    <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
      {ids.map((id) => (
        <span key={id} className="bx-chip border border-[color:var(--bx-line)] font-normal">
          {kind === 'ids' ? getCompoundMeta(id)?.name : <TaxonName id={id} link={false} />}
          <button type="button" className="ml-0.5 px-1 rounded hover:bg-paper-2 dark:hover:bg-night-2" aria-label={`Remove ${id}`} onClick={() => set(ids.filter((x) => x !== id))}>×</button>
        </span>
      ))}
      {ids.length < 4 && (
        <label><span className="sr-only">Add {kind === 'ids' ? 'a compound' : 'a plant'}</span>
          <select className="bx-input !w-auto" value="" onChange={(e) => e.target.value && set([...ids, e.target.value])}>
            <option value="">+ add {kind === 'ids' ? 'a compound' : 'a plant'}…</option>
            {options.filter((o) => !ids.includes(o.id)).map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
          </select>
        </label>
      )}
      {ids.length < 2 && <span className="bx-todo">add at least one more to compare</span>}
    </div>
  );
}

function CompareCompounds({ ids, basis, setBasis }: { ids: string[]; basis: Basis | null; setBasis: (b: Basis | null) => void }) {
  const all = useAsync(loadCompounds);
  const occ = useAsync(loadOccurrences);
  const [sync, setSync] = useState(true);
  const [opts, setOpts] = useState<ViewerOptions>({ ...DEFAULT_VIEWER_OPTIONS, hydrogens: false, style: 'stick' });
  const refs = useRef<(MolViewerHandle | null)[]>([]);
  const syncing = useRef(false);
  const webgl = useMemo(() => hasWebGL(), []);
  const onView = (from: number) => (view: number[]) => {
    if (!sync || syncing.current) return;
    syncing.current = true;
    refs.current.forEach((r, i) => { if (i !== from && r) r.setView(view); });
    syncing.current = false;
  };
  const list = ids.map((id) => all?.find((c) => c.id === id)).filter((x): x is Compound => !!x);
  const rows = (occ ?? []).filter((r) => ids.includes(r.compound_id));
  const taxa = [...new Set(rows.map((r) => r.taxon_id))];
  const cols = { gridTemplateColumns: `repeat(${Math.max(ids.length, 1)}, minmax(12rem, 1fr))` };

  return (
    <div>
      <p className="bx-prose mt-4 max-w-3xl">Compounds side by side: their structures (rotate one and the others follow), where each is found, the evidence aligned by grade, and the safety flags. Amounts are charted only on one basis at a time.</p>
      <Picker kind="ids" ids={ids} />
      {!all || !occ ? <p className="mt-6 bx-muted" role="status">Loading…</p> : (
        <>
          <section className="mt-6" aria-labelledby="structs-h">
            <div className="flex flex-wrap items-center gap-2">
              <h2 id="structs-h" className="text-2xl mr-auto">Structures</h2>
              <button type="button" className={`bx-btn ${sync ? 'bx-btn-on' : ''}`} aria-pressed={sync} onClick={() => setSync((s) => !s)}>Synchronise rotation</button>
              <button type="button" className={`bx-btn ${opts.hydrogens ? 'bx-btn-on' : ''}`} aria-pressed={opts.hydrogens} onClick={() => setOpts((o) => ({ ...o, hydrogens: !o.hydrogens }))}>Hydrogens</button>
              <button type="button" className="bx-btn" onClick={() => refs.current.forEach((r) => r?.resetView())}>Reset views</button>
            </div>
            <div className="mt-3 grid gap-3 overflow-x-auto" style={cols}>
              {list.map((c, i) => (
                <div key={c.id} className="flex flex-col gap-2 min-w-0">
                  <div className="bx-card h-60 overflow-hidden relative">
                    {c.structure ? (webgl ? (
                      <Suspense fallback={<p className="p-3 text-sm bx-muted">Loading 3D…</p>}>
                        <MolViewer ref={(r) => { refs.current[i] = r; }} sdfUrl={assetUrl(c.structure.sdf)} structure={c.structure} options={opts} onViewChange={onView(i)} label={`3D model of ${c.name}`} testKey={`compare-${i}`} />
                      </Suspense>
                    ) : <StructureThumb svg={c.structure.svg} name={c.name} className="h-full" />) : <p className="p-4 text-sm bx-muted">No single structure.</p>}
                  </div>
                  {c.structure && <div className="bx-card" data-testid={`compare-2d-${c.id}`}><StructureThumb svg={c.structure.svg} name={c.name} /></div>}
                  <h3 className="text-lg leading-tight"><Link to={`/compounds/${c.id}`} className="underline decoration-dotted inline-flex items-center gap-1.5"><ClassIcon cls={c.class} />{c.name}</Link></h3>
                  <p className="text-xs bx-muted font-mono">{c.identity.formula}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="mt-10" aria-labelledby="amounts-h">
            <h2 id="amounts-h" className="text-2xl">Amounts, one basis at a time</h2>
            <div className="mt-3"><AmountChart rows={rows} basis={basis} onBasis={setBasis} colourBy="compound" label={(r) => `${r.compound} · ${getTaxonMeta(r.taxon_id)?.common_names[0] ?? r.taxon_id}`} /></div>
          </section>

          <section className="mt-10" aria-labelledby="where-h">
            <h2 id="where-h" className="text-2xl">Where each is found, aligned by plant</h2>
            <div className="mt-3 overflow-x-auto">
              <table className="bx-table min-w-[40rem]">
                <thead><tr><th scope="col">Plant</th>{list.map((c) => <th key={c.id} scope="col">{c.name}</th>)}</tr></thead>
                <tbody>
                  {taxa.map((t) => (
                    <tr key={t}>
                      <th scope="row" className="font-normal">{getTaxonMeta(t) ? <TaxonName id={t} withCommon /> : <span><i>{t}</i> <span className="bx-todo">no taxa.yaml record</span></span>}</th>
                      {list.map((c) => {
                        const rs = rows.filter((r) => r.compound_id === c.id && r.taxon_id === t);
                        return <td key={c.id}>{!rs.length ? <span className="bx-muted">—</span> : <ul className="grid gap-1">{rs.map((r) => <li key={r.row} className="text-xs"><span className="font-mono">{formatAmount(r).amount}</span> <BasisChip basis={r.basis} /><span className="block bx-muted">{r.plant_part}</span></li>)}</ul>}</td>;
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="mt-10" aria-labelledby="ev-h">
            <h2 id="ev-h" className="text-2xl">Evidence, aligned by grade</h2>
            <p className="text-sm bx-muted mt-1">Each cell lists the record's evidence rows at that grade, with the test article each was measured on.</p>
            <div className="mt-3 overflow-x-auto">
              <table className="bx-table min-w-[40rem]">
                <thead><tr><th scope="col">Grade</th>{list.map((c) => <th key={c.id} scope="col">{c.name}</th>)}</tr></thead>
                <tbody>
                  {GRADES.filter((g) => list.some((c) => c.evidence.some((e) => e.grade === g))).map((g) => (
                    <tr key={g}>
                      <th scope="row"><GradeBadge grade={g} /></th>
                      {list.map((c) => {
                        const es = c.evidence.map((e, i) => ({ e, md: c.md.evidence[i] })).filter((x) => x.e.grade === g);
                        return <td key={c.id}>{!es.length ? <span className="bx-muted">—</span> : <ul className="grid gap-2">{es.map((x, i) => <li key={i} className="text-xs" data-testid="evidence-row"><span className="inline-flex gap-1 mb-0.5"><GradeBadge grade={x.e.grade} /><TestArticleChip article={x.e.test_article} detail={x.e.test_article_detail} /></span><Prose md={x.md.claim} className="bx-inline" /></li>)}</ul>}</td>;
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
              {!list.some((c) => c.evidence.length) && <p className="mt-2"><span className="bx-todo">None of these records has graded evidence rows.</span></p>}
            </div>
          </section>

          <section className="mt-10" aria-labelledby="sf-h">
            <h2 id="sf-h" className="text-2xl">Safety flags</h2>
            <div className="mt-3 grid gap-3" style={cols}>
              {list.map((c) => (
                <div key={c.id} className="min-w-0">
                  <h3 className="font-semibold">{c.name}</h3>
                  {!c.safety_flags.length ? <p className="text-sm mt-1"><span className="bx-todo">no safety flag recorded</span></p> : (
                    <ul className="mt-1 grid gap-2">{c.safety_flags.map((f, i) => <li key={i} className="bx-safety !p-2 text-sm"><span className="font-semibold">{f.flag}</span>{f.threshold_or_limit && <span className="block text-xs mt-1"><span className="uppercase text-[10px] font-semibold tracking-wider">regulatory / toxicological limit: </span>{f.threshold_or_limit}</span>}</li>)}</ul>
                  )}
                </div>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function ComparePlants({ ids, basis, setBasis }: { ids: string[]; basis: Basis | null; setBasis: (b: Basis | null) => void }) {
  const taxa = useAsync(loadTaxa);
  const occ = useAsync(loadOccurrences);
  const list = ids.map((id) => taxa?.find((t) => t.id === id)).filter((x): x is Taxon => !!x);
  const rows: OccurrenceRow[] = (occ ?? []).filter((r) => ids.includes(r.taxon_id));
  const m = occ ? compoundMatrix(ids, occ) : null;
  const cols = { gridTemplateColumns: `repeat(${Math.max(ids.length, 1)}, minmax(16rem, 1fr))` };
  return (
    <div>
      <p className="bx-prose mt-4 max-w-3xl">Plants side by side: the curated compounds of each, which they share and which are distinct, their safety blocks, and their evidence at grade B or above.</p>
      <Picker kind="plants" ids={ids} />
      {!taxa || !occ || !m ? <p className="mt-6 bx-muted" role="status">Loading…</p> : (
        <>
          <section className="mt-6" aria-labelledby="matrix-h">
            <h2 id="matrix-h" className="text-2xl">Compounds: presence and amount</h2>
            <CompoundMatrix taxa={ids} rows={occ} />
            <div className="mt-4 grid gap-3 sm:grid-cols-2" data-testid="shared-distinct">
              <div className="bx-card p-3 text-sm"><p className="font-semibold">Shared by all ({m.shared.length})</p><p className="mt-1">{m.shared.length ? m.shared.map((c, i) => <span key={c}>{i ? ', ' : ''}<Link className="underline" to={`/compounds/${c}`}>{getCompoundMeta(c)?.name}</Link></span>) : <span className="bx-muted">none in the catalogue</span>}</p></div>
              <div className="bx-card p-3 text-sm"><p className="font-semibold">Recorded for one only</p><ul className="mt-1 grid gap-1">{ids.map((t) => <li key={t}><TaxonName id={t} link={false} />: {m.distinct[t].length ? m.distinct[t].map((c, i) => <span key={c}>{i ? ', ' : ''}<Link className="underline" to={`/compounds/${c}`}>{getCompoundMeta(c)?.name}</Link></span>) : <span className="bx-muted">none</span>}</li>)}</ul></div>
            </div>
          </section>
          <section className="mt-10" aria-labelledby="pamounts-h">
            <h2 id="pamounts-h" className="text-2xl">Amounts, one basis at a time</h2>
            <div className="mt-3"><AmountChart rows={rows} basis={basis} onBasis={setBasis} colourBy="compound" label={(r) => `${r.compound} · ${getTaxonMeta(r.taxon_id)?.common_names[0] ?? r.taxon_id}`} /></div>
          </section>
          <section className="mt-10" aria-labelledby="psafety-h">
            <h2 id="psafety-h" className="text-2xl">Safety</h2>
            <div className="mt-3 grid gap-4 overflow-x-auto" style={cols}>
              {list.map((t) => (
                <div key={t.id} className="min-w-0">
                  <h3 className="text-lg"><TaxonName id={t.id} withCommon /></h3>
                  {t.safety_evidence ? <TaxonSafetyBlock s={t.safety_evidence} /> : <p className="mt-2"><span className="bx-todo">no safety block in this pass</span></p>}
                </div>
              ))}
            </div>
          </section>
          <section className="mt-10" aria-labelledby="pev-h">
            <h2 id="pev-h" className="text-2xl">Evidence at grade B or above</h2>
            <div className="mt-1 grid gap-4 overflow-x-auto" style={cols}>
              {list.map((t) => (
                <div key={t.id} className="min-w-0">
                  <h3 className="text-lg mt-4"><TaxonName id={t.id} withCommon /></h3>
                  <EvidenceTable id={`ev-${t.id}`} title="Evidence" rows={(t.safety_evidence?.evidence ?? []).filter((e) => e.grade === 'A' || e.grade === 'B')} empty="No whole-plant evidence at grade A or B in this record." />
                </div>
              ))}
            </div>
          </section>
          {list.some((t) => !t.profiled) && <p className="mt-6 text-sm"><span className="bx-todo">One or more of these plants is not profiled yet; its columns show only what the identity record holds.</span></p>}
        </>
      )}
      <p className="mt-8 text-sm"><Link className="underline" to="/plants">All plants →</Link> · <Link className="underline" to="/compounds">All compounds →</Link> · {compoundsIndex.length} compound records</p>
    </div>
  );
}
