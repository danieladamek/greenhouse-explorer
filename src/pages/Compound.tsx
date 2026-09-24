import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import type { Compound as CompoundT, StructureDetail } from '@/types';
import { colourForGroup, compoundsIndex, getCompoundMeta } from '@/lib/data';
import { loadCompoundRecord, loadStructureDetail, loadStructureSummary, useAsync, type CompoundRecordFile } from '@/lib/heavy';
import { applyFilters, paramsToFilters } from '@/lib/filters';
import { useTray } from '@/lib/tray';
import { hasWebGL } from '@/lib/webgl';
import { useInView } from '@/lib/inview';
import { highlightsFor } from '@/components/viewer/groups';
import { measure, type Measurement } from '@/components/viewer/measure';
import type { MolViewerHandle } from '@/components/viewer/MolViewer';
import type { StyleName, ViewerOptions } from '@/components/viewer/options';
import { DEFAULT_VIEWER_OPTIONS } from '@/components/viewer/options';
import Structure2D from '@/components/viewer/Structure2D';
import ViewerControls from '@/components/viewer/ViewerControls';
import FunctionalGroupChips from '@/components/viewer/FunctionalGroupChips';
import AtomInfoPanel from '@/components/viewer/AtomInfoPanel';
import { AsOf, ClassChip } from '@/components/catalogue/Chips';
import { AddNoteButton, Field, Prose, Sources } from '@/components/catalogue/Record';
import EvidenceTable, { citeLinks } from '@/components/catalogue/EvidenceTable';
import OccurrenceTable from '@/components/catalogue/OccurrenceTable';
import { SafetyFlags } from '@/components/catalogue/Safety';
import NotFound from './NotFound';

const MolViewer = lazy(() => import('@/components/viewer/MolViewer'));

const DESCRIPTOR_ROWS: { key: keyof NonNullable<CompoundT['structure']>['descriptors']; label: string }[] = [
  { key: 'heavyAtoms', label: 'Heavy atoms' }, { key: 'rings', label: 'Rings' }, { key: 'aromaticRings', label: 'Aromatic rings' },
  { key: 'hbd', label: 'H-bond donors' }, { key: 'hba', label: 'H-bond acceptors' }, { key: 'rotatableBonds', label: 'Rotatable bonds' },
  { key: 'logP', label: 'Crippen logP (computed)' }, { key: 'tpsa', label: 'TPSA, Å² (computed)' }, { key: 'fsp3', label: 'Fsp³' }, { key: 'stereocenters', label: 'Stereocentres' },
];

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return <section id={id} aria-labelledby={`${id}-h`} className="mt-10 scroll-mt-36"><h2 id={`${id}-h`} className="text-2xl">{title}</h2>{children}</section>;
}

/** The viewer column (features C2–C7), ported from Bioactive Explorer's CompoundDetail. Viewer state lives in the URL. */
function StructureBlock({ c }: { c: CompoundT }) {
  const [params, setParams] = useSearchParams();
  const structure = c.structure;
  const webgl = useMemo(() => hasWebGL(), []);
  const viewerRef = useRef<MolViewerHandle>(null);
  const [frameRef, inView] = useInView<HTMLDivElement>();
  const summary = useAsync(loadStructureSummary);
  const [detail, setDetail] = useState<StructureDetail | null>(null);
  const [picked, setPicked] = useState<number[]>([]);
  const [measurement, setMeasurement] = useState<Measurement | null>(null);
  const groups = (params.get('groups') ?? '').split(',').filter(Boolean);
  const options: ViewerOptions = {
    ...DEFAULT_VIEWER_OPTIONS,
    style: (params.get('style') as StyleName) || DEFAULT_VIEWER_OPTIONS.style,
    labels: params.get('labels') === '1', hydrogens: params.get('h') !== '0', cip: params.get('cip') === '1',
    spin: params.get('spin') === '1',
    surface: (params.get('surface') as ViewerOptions['surface']) || 'none',
  };
  const setUrl = (patch: Record<string, string | null>) => {
    const p = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) { if (v === null || v === '') p.delete(k); else p.set(k, v); }
    setParams(p, { replace: true });
  };
  const setOptions = (o: ViewerOptions) => setUrl({
    style: o.style === DEFAULT_VIEWER_OPTIONS.style ? null : o.style, labels: o.labels ? '1' : null, h: o.hydrogens ? null : '0',
    cip: o.cip ? '1' : null, spin: o.spin ? '1' : null, surface: o.surface === 'none' ? null : o.surface,
  });
  useEffect(() => { let live = true; setDetail(null); setPicked([]); if (structure) loadStructureDetail(structure.detail).then((d) => { if (live) setDetail(d); }).catch(() => {}); return () => { live = false; }; }, [structure]);
  useEffect(() => {
    const pos = viewerRef.current?.getAtomPositions();
    setMeasurement(pos && picked.length >= 2 ? measure(picked.map((i) => pos[i]).filter(Boolean)) : null);
  }, [picked]);
  const onAtomClick = useCallback((i: number) => setPicked((p) => (p.includes(i) ? p.filter((x) => x !== i) : p.length >= 4 ? [i] : [...p, i])), []);
  const highlights = useMemo(() => (structure ? highlightsFor(structure, groups) : []), [structure, groups.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!structure) {
    return (
      <Section id="structure" title="Structure">
        <div className="bx-card p-5 mt-3" data-testid="no-structure">
          <h3 className="text-xl">No single structure</h3>
          <p className="bx-prose mt-2">This record carries no SMILES string, so there is no structure to draw or model. {c.identity.note ?? ''}</p>
        </div>
      </Section>
    );
  }
  const downloadPng = () => { const uri = viewerRef.current?.pngURI(); if (!uri) return; const a = document.createElement('a'); a.href = uri; a.download = `${c.id}.png`; a.click(); };
  return (
    <Section id="structure" title="Structure">
      <div className="mt-3 grid gap-4 lg:grid-cols-2">
        <div className="flex flex-col gap-3">
          <div ref={frameRef} className="bx-card overflow-hidden h-[48vh] min-h-[300px] relative" data-testid="viewer-frame">
            {!inView ? <p className="p-4 text-sm bx-muted">The 3D model loads when this frame is on screen.</p> : webgl ? (
              <Suspense fallback={<p className="p-4 text-sm bx-muted" role="status">Loading the 3D viewer…</p>}>
                <MolViewer ref={viewerRef} sdfUrl={`${import.meta.env.BASE_URL.replace(/\/$/, '')}/${structure.sdf}`} structure={structure} atoms={detail?.atoms} options={options} highlights={highlights} picked={picked} onAtomClick={onAtomClick} label={`3D model of ${c.name}`} testKey="detail" />
              </Suspense>
            ) : <p className="p-4 text-sm bx-muted">WebGL is not available in this browser, so only the 2D depiction is shown.</p>}
          </div>
          <p className="text-xs bx-muted -mt-1">3D conformer: {structure.conformerSource === 'pubchem' ? 'PubChem 3D record, re-checked by InChIKey at build' : 'generated with RDKit (ETKDGv3 + MMFF94); PubChem has no 3D record'}. Drag to rotate; click atoms to inspect and measure.</p>
          <ViewerControls options={options} onChange={setOptions} onReset={() => viewerRef.current?.resetView()} onFullscreen={() => viewerRef.current?.requestFullscreen()} onDownload={downloadPng}
            onClearMeasurements={() => setPicked([])} hasMeasurements={picked.length > 0}
            groupsOn={groups.length > 0} onToggleGroups={() => setUrl({ groups: groups.length ? null : structure.functionalGroups.map((g) => g.id).join(',') })}
            hasStereo={structure.descriptors.stereocenters > 0} />
          {groups.length > 0 && <FunctionalGroupChips structure={structure} active={groups} onChange={(ids) => setUrl({ groups: ids.join(',') || null })} />}
          <AtomInfoPanel structure={structure} atoms={detail?.atoms ?? null} picked={picked} measurement={measurement} onClear={() => setPicked([])} />
        </div>
        <div className="bx-card p-3 self-start" data-testid="structure-2d">
          <h3 className="text-lg">2D depiction</h3>
          <Structure2D structure={structure} atomCoords={detail?.atomCoords} alt={`2D structure of ${c.name}`} highlights={highlights} picked={picked} onAtomClick={onAtomClick} className="max-w-md mx-auto" />
          <p className="text-xs bx-muted mt-1">Drawn by RDKit from the record's SMILES at build time. Hydrogens implicit. Atoms picked in 3D are ringed here too; click an atom here to pick it in 3D.</p>
          <h3 className="text-lg mt-4">Computed from the structure <span className="text-xs bx-muted font-body">(RDKit {summary?.rdkitVersion ?? ''})</span></h3>
          <dl className="mt-2 grid grid-cols-2 gap-1.5 text-sm">
            {DESCRIPTOR_ROWS.map((r) => (
              <div key={r.key} className="rounded-md border border-[color:var(--bx-line)] p-1.5" title={summary?.descriptorHelp?.[r.key as keyof typeof summary.descriptorHelp]}>
                <dt className="bx-muted text-[11px]">{r.label}</dt><dd className="font-semibold tabular-nums">{structure.descriptors[r.key]}</dd>
              </div>
            ))}
          </dl>
          <p className="text-xs bx-muted mt-2">Computed descriptors are properties of the drawn structure, not measurements. Measured logP and pKa are in the identity block below.</p>
        </div>
      </div>
    </Section>
  );
}

export default function Compound() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const meta = getCompoundMeta(id);
  const [rec, setRec] = useState<CompoundRecordFile | null | undefined>(undefined);
  useEffect(() => { let live = true; setRec(undefined); if (id) loadCompoundRecord(id).then((r) => { if (live) setRec(r); }); return () => { live = false; }; }, [id]);
  const tray = useTray();
  const c = rec?.compound;
  useEffect(() => { if (meta) document.title = `${meta.name} · Greenhouse Explorer`; }, [meta]);

  // prev / next within the browser's current filter (feature B4); the filter travels as ?f=
  const f = params.get('f') ?? '';
  const nav = useMemo(() => {
    const list = applyFilters(compoundsIndex, { ...paramsToFilters(new URLSearchParams(f)), aux: meta?.auxiliary || paramsToFilters(new URLSearchParams(f)).aux });
    const i = list.findIndex((x) => x.id === id);
    return { prev: i > 0 ? list[i - 1] : null, next: i >= 0 && i < list.length - 1 ? list[i + 1] : null, i, n: list.length };
  }, [f, id, meta]);

  if (!meta) return <NotFound />;
  if (!c || !rec) {
    // the header is drawn from the slim index at once, so the page has its title and summary before the record arrives
    return (
      <div className="mx-auto max-w-6xl px-4 py-8 min-h-[150vh]">
        <p className="text-[11px] font-semibold tracking-[0.2em] bx-muted mt-10">COMPOUND RECORD</p>
        <h1 className="text-3xl sm:text-4xl leading-tight mt-1">{meta.name}</h1>
        <p className="mt-3 text-lg">{meta.one_liner}</p>
        <p className="mt-4 bx-muted" role="status">Loading the record…</p>
      </div>
    );
  }

  const rows = rec.rows;
  const ps = c.processing_stability;
  const prepsHere = rec.preparations;
  const inTray = tray.has('compounds', c.id);
  const fq = f ? `?f=${encodeURIComponent(f)}` : '';
  const mwRdkit = c.structure?.averageMass ?? null;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <nav aria-label="Compound navigation" className="flex flex-wrap items-center gap-2 text-sm">
        <Link to={`/compounds${f ? `?${f}` : ''}`} className="underline">← Compounds</Link>
        <span className="bx-muted">{nav.i >= 0 ? `${nav.i + 1} of ${nav.n}` : ''}</span>
        <span className="ml-auto flex gap-2">
          <button type="button" className="bx-btn" disabled={!nav.prev} onClick={() => nav.prev && navigate(`/compounds/${nav.prev.id}${fq}`)}>← {nav.prev?.name ?? 'Previous'}</button>
          <button type="button" className="bx-btn" disabled={!nav.next} onClick={() => nav.next && navigate(`/compounds/${nav.next.id}${fq}`)}>{nav.next?.name ?? 'Next'} →</button>
        </span>
      </nav>

      <header className="mt-4">
        <p className="text-[11px] font-semibold tracking-[0.2em] bx-muted">COMPOUND RECORD{c.auxiliary ? ' · AUXILIARY (NOT A GREENHOUSE CONSTITUENT)' : ''}</p>
        <h1 className="text-3xl sm:text-4xl leading-tight mt-1">{c.name}</h1>
        {c.synonyms.length > 0 && <p className="mt-1 text-sm bx-muted">Also: {c.synonyms.join(' · ')}</p>}
        <div className="mt-3 flex flex-wrap items-center gap-1.5 text-sm">
          <ClassChip cls={c.class} />
          {c.subclass && <span className="bx-status">{c.subclass}</span>}
          <span className="bx-chip border font-medium" style={{ borderColor: colourForGroup(c.palette_group) }}><span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: colourForGroup(c.palette_group) }} aria-hidden="true" />{c.palette_group === 'shared' ? 'shared across families' : c.palette_group}</span>
          {ps.formed_during && <span className="bx-status">formed during {ps.formed_during}</span>}
          <AsOf date={c.as_of} />
        </div>
        <Prose md={c.md.one_liner} className="mt-3 text-lg" />
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" className={`bx-btn ${inTray ? 'bx-btn-on' : ''}`} aria-pressed={inTray} disabled={!inTray && tray.full('compounds')} onClick={() => tray.toggle('compounds', c.id)} data-testid="tray-compound">{inTray ? '✓ In the compound comparison' : 'Compare with…'}</button>
          <AddNoteButton anchor={{ type: 'compound', id: c.id }} label={c.name} />
        </div>
      </header>

      <StructureBlock c={c} />

      <Section id="identity" title="Identity">
        <dl className="mt-2">
          <Field label="IUPAC name" value={c.identity.iupac} missing="IUPAC name not recorded" />
          <Field label="Formula" value={c.identity.formula} missing="formula not recorded" />
          <Field label="Molecular weight" value={c.identity.mw !== null ? `${c.identity.mw} g/mol (${c.identity.mw_source ?? 'source not stated'})${mwRdkit !== null ? ` · RDKit recomputes ${mwRdkit.toFixed(2)} g/mol from the SMILES` : ''}` : null} missing="molecular weight not recorded" />
          <Field label="SMILES" value={c.identity.smiles} missing="no SMILES — no single structure" />
          <Field label="InChIKey" value={c.identity.inchikey} missing="InChIKey not recorded" />
          <Field label="CAS" value={c.identity.cas} missing="CAS number not recorded" />
          <Field label="PubChem CID" value={c.identity.pubchem_cid ? String(c.identity.pubchem_cid) : null} missing="no PubChem CID" />
          <Field label="ChEBI" value={c.identity.chebi_id} missing="no ChEBI id" />
          <Field label="logP (measured)" value={c.physchem.logp !== null ? String(c.physchem.logp) : null} missing="TODO(author): logP not sourced" />
          <Field label="pKa" value={c.physchem.pka !== null ? String(c.physchem.pka) : null} missing="TODO(author): pKa not sourced" />
        </dl>
        <p className="mt-2 text-xs bx-muted" data-testid="identity-provenance">
          Provenance: identity from {c.identity.source ? <a className="underline" href={c.identity.source} target="_blank" rel="noreferrer">{new URL(c.identity.source).hostname}</a> : <span className="bx-todo">source not recorded</span>}
          {' '}· cross-checked against a second source: {c.identity.cross_checked ? 'yes' : 'no'}
          {c.structure && ' · formula and InChIKey recomputed by RDKit from the SMILES at build and matched'}
          {c.identity.pubchem_cid && <> · <a className="underline" href={`https://pubchem.ncbi.nlm.nih.gov/compound/${c.identity.pubchem_cid}`} target="_blank" rel="noreferrer">PubChem</a></>}
          {c.identity.chebi_id && <> · <a className="underline" href={`https://www.ebi.ac.uk/chebi/searchId.do?chebiId=${c.identity.chebi_id}`} target="_blank" rel="noreferrer">ChEBI</a></>}
          {c.identity.note && <><br />Note: {c.identity.note}</>}
        </p>
      </Section>

      <Section id="found" title="Where it's found">
        <OccurrenceTable rows={rows} by="taxon" caption="Each row is one published value with its plant part, unit, basis, level and source. Values for a species are not measurements of the greenhouse's plants, and rows with different bases cannot be set against each other." />
        {rows.length > 1 && <p className="mt-2 text-sm"><Link className="underline" to={`/compare?ids=${c.id}`}>See these amounts in Compare, one basis at a time →</Link></p>}
      </Section>

      <Section id="biosynthesis" title="Biosynthesis">
        <dl className="mt-2">
          <Field label="Pathway" value={c.biosynthesis.pathway} missing="pathway not recorded" />
          {c.biosynthesis.note && <Field label="Note" md={c.md.biosynthesis_note} missing="" />}
        </dl>
        <p className="mt-2 text-sm"><Link className="underline" to={`/figures/fig-pathways?compound=${c.id}`}>Find it on Figure 1, the three pathways →</Link></p>
      </Section>

      <Section id="pharmacology" title="Pharmacology">
        <dl className="mt-2">
          <Field label="Primary targets" md={c.md.primary_targets} missing="not researched in this pass" />
          <Field label="Mechanism" md={c.md.mechanism} missing="not researched in this pass" />
          <Field label="Functional notes" md={c.md.functional_notes} missing="not researched in this pass" />
        </dl>
      </Section>

      <Section id="absorption" title="Absorption and bioavailability">
        {c.md.absorption_bioavailability ? <Prose md={c.md.absorption_bioavailability} className="mt-2" /> : <p className="mt-2"><span className="bx-todo" data-todo="author">not researched in this pass</span></p>}
      </Section>

      <EvidenceTable rows={c.evidence.map((e, i) => ({ ...e, md: c.md.evidence[i] }))} empty="No graded evidence rows in this record. That records what this pass did not research — it is not a finding of no effect." />

      <Section id="processing" title="Processing and preparation">
        {ps.formed_during === 'distillation' && (
          <div className="mt-3 bx-card p-4 border-l-4 border-l-[color:var(--bx-accent)]" data-testid="formed-callout">
            <p className="font-semibold">Formed during distillation</p>
            <p className="text-sm mt-1">The record marks this compound as formed during steam distillation rather than stored as such in the plant — see the processing note below and Figure 1.</p>
          </div>
        )}
        {ps.formed_during && ps.formed_during !== 'distillation' && <p className="mt-3 bx-card p-3 text-sm"><span className="font-semibold">Formed during {ps.formed_during}</span> — see the note below.</p>}
        <dl className="mt-2">
          <Field label="Heat" value={ps.heat} missing="not sourced in this pass" />
          <Field label="Water solubility" value={ps.water_solubility} missing="not sourced in this pass" />
          <Field label="Ethanol solubility" value={ps.ethanol_solubility} missing="not sourced in this pass" />
          <Field label="Volatility" value={ps.volatility} missing="not sourced in this pass" />
          <Field label="Enzyme dependence" value={ps.enzyme_dependence} missing="not sourced in this pass" />
          {ps.note && <Field label="Note" md={c.md.processing_note ?? citeLinks(ps.note)} missing="" />}
        </dl>
        {prepsHere.length > 0 && (
          <p className="mt-3 text-sm">On Tea Time: {prepsHere.map((p, i) => <span key={p.id}>{i ? ' · ' : ''}<Link className="underline" to={`/tea#${p.id}`}>{p.name}</Link></span>)}</p>
        )}
      </Section>

      <SafetyFlags flags={c.safety_flags} detailsMd={c.md.safety_flags} />

      <Section id="teaching" title="Teaching note">
        {c.md.teaching_note ? <Prose md={c.md.teaching_note} className="mt-2" /> : <p className="mt-2"><span className="bx-todo">no teaching note in this record</span></p>}
      </Section>

      <Section id="gaps" title="What this record does not know">
        {!c.gaps.length ? <p className="mt-2 text-sm bx-muted">No gaps recorded.</p> : (
          <ul className="mt-2 grid gap-1.5 text-sm" data-testid="gaps">{c.gaps.map((g, i) => <li key={i}><span className="bx-todo" data-todo="author">gap</span> {g}</li>)}</ul>
        )}
      </Section>

      <Sources refs={c.cited_refs} />
      {c.primer_sections.length > 0 && <p className="mt-6 text-sm">In the primer: {c.primer_sections.map((s, i) => <span key={s}>{i ? ' · ' : ''}<Link className="underline" to={`/read#${s}`}>§{s.split('-')[0]}</Link></span>)}</p>}
    </div>
  );
}
