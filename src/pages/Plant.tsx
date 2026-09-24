import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { DEPTH_LABEL, getCompoundMeta, getTaxonMeta, taxaIndex } from '@/lib/data';
import { loadTaxonRecord, type TaxonRecordFile } from '@/lib/heavy';
import { plantPageModel } from '@/lib/models';
import { useTray } from '@/lib/tray';
import type { Taxon } from '@/types';
import { AsOf, ClassIcon, DepthChip, FamilyChip, IdentityChip, TaxonName } from '@/components/catalogue/Chips';
import { AddNoteButton, Sources } from '@/components/catalogue/Record';
import EvidenceTable from '@/components/catalogue/EvidenceTable';
import OccurrenceTable from '@/components/catalogue/OccurrenceTable';
import { TaxonSafetyBlock } from '@/components/catalogue/Safety';
import { GrownHere, Identifiers, PrimerLinks } from '@/components/catalogue/PlantBits';
import CompoundMatrix from '@/components/catalogue/CompoundMatrix';
import NotFound from './NotFound';

function Header({ t }: { t: Taxon }) {
  const tray = useTray();
  const inTray = tray.has('plants', t.id);
  return (
    <header>
      <p className="text-[11px] font-semibold tracking-[0.2em] bx-muted">PLANT · {t.family.toUpperCase()}</p>
      <h1 className="text-3xl sm:text-4xl leading-tight mt-1"><TaxonName name={t.accepted_name} link={false} /> {t.authority && <span className="text-xl bx-muted font-body">{t.authority}</span>}</h1>
      <p className="mt-1 text-lg">{t.common_names.join(' · ')}</p>
      {t.synonyms.length > 0 && <p className="text-sm bx-muted mt-1">Synonyms: {t.synonyms.map((s, i) => <span key={s}>{i ? '; ' : ''}<i>{s}</i></span>)}</p>}
      <div className="mt-3 flex flex-wrap items-center gap-1.5 text-sm">
        <FamilyChip family={t.family} />
        <IdentityChip status={t.identity_status} />
        <DepthChip depth={t.profile_depth} />
        <AsOf date={t.as_of} />
      </div>
      <Identifiers t={t} />
      {t.taxonomy_note && <details className="mt-2 text-sm"><summary className="cursor-pointer bx-muted">Identity note ({t.identity_status})</summary><p className="mt-1 bx-prose">{t.taxonomy_note}</p></details>}
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" className={`bx-btn ${inTray ? 'bx-btn-on' : ''}`} aria-pressed={inTray} disabled={!inTray && tray.full('plants')} onClick={() => tray.toggle('plants', t.id)} data-testid="tray-plant">
          {inTray ? '✓ In the plant comparison' : 'Compare with another plant'}
        </button>
        <AddNoteButton anchor={{ type: 'taxon', id: t.id }} label={t.accepted_name} />
      </div>
    </header>
  );
}

function ProfileInProgress({ t }: { t: Taxon }) {
  return (
    <section aria-labelledby="pip-h" className="mt-8 bx-card p-5 border-dashed" data-testid="profile-in-progress">
      <h2 id="pip-h" className="text-2xl">Profile in progress</h2>
      <p className="bx-prose mt-2">This plant is on the greenhouse inventory and has an identity record, but it has not been profiled in this prototype. A profile will add:</p>
      <ul className="list-disc pl-5 bx-prose mt-1">
        <li>curated compounds, each with occurrence rows that give amount, unit, basis and source;</li>
        <li>whole-plant evidence, each statement graded A–E or T and naming its test article;</li>
        <li>a safety block — interactions, pregnancy and lactation, allergy, constituents of concern with their regulatory limits, adverse-event history;</li>
        <li>preparation records where the plant is steeped or tinctured, described as extraction chemistry.</li>
      </ul>
      {t.todo.length > 0 ? (
        <>
          <h3 className="text-lg mt-4">Open items for this plant (todo.yaml)</h3>
          <ul className="mt-1 grid gap-1 text-sm">{t.todo.map((x, i) => <li key={i}><span className="bx-todo">{x.where}</span> {x.what}</li>)}</ul>
        </>
      ) : <p className="text-sm bx-muted mt-3">No open todo.yaml items name this plant; its profile is scheduled with its family (see <Link className="underline" to="/methods#scope">scope</Link>).</p>}
    </section>
  );
}

function CuratedCompounds({ t, rows }: { t: Taxon; rows: ReturnType<typeof plantPageModel>['rows'] }) {
  return (
    <section aria-labelledby="cc-h" className="mt-8" id="compounds">
      <h2 id="cc-h" className="text-2xl">Curated compounds</h2>
      {!t.compounds.length ? <p className="mt-2"><span className="bx-todo">No curated compounds for this plant in this pass.</span></p> : (
        <>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {t.compounds.map((id) => {
              const c = getCompoundMeta(id);
              return (
                <li key={id}>
                  <Link to={`/compounds/${id}`} className="bx-card p-3 block hover:shadow-md h-full">
                    <span className="flex items-center gap-1.5 font-semibold">{c && <ClassIcon cls={c.class} />}{c?.name ?? id}</span>
                    <span className="block text-xs bx-muted mt-1">{c?.one_liner}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
          <h3 className="text-lg mt-6">Amounts, each with its basis</h3>
          <OccurrenceTable rows={rows} by="compound" caption="Published values for this species (or a named study cultivar), not measurements of the greenhouse's own plants. Different bases are not comparable and are never converted." />
        </>
      )}
    </section>
  );
}

function Preparations({ preps }: { preps: { id: string; name: string }[] }) {
  const ids = preps.map((p) => p.id);
  return (
    <section aria-labelledby="prep-h" className="mt-8">
      <h2 id="prep-h" className="text-2xl">Preparations</h2>
      {!ids.length ? <p className="mt-2 text-sm bx-muted">No preparation record names this plant.</p> : (
        <ul className="mt-2 grid gap-1 text-sm">{ids.map((id) => <li key={id}><Link className="underline" to={`/tea#${id}`}>{preps.find((p) => p.id === id)?.name ?? id}</Link> <span className="bx-muted">— as extraction chemistry on Tea Time</span></li>)}</ul>
      )}
    </section>
  );
}

function Gaps({ t }: { t: Taxon }) {
  const gaps = t.safety_evidence?.gaps ?? [];
  if (!gaps.length && !t.todo.length) return null;
  return (
    <section aria-labelledby="gaps-h" className="mt-8">
      <h2 id="gaps-h" className="text-2xl">What this record does not know</h2>
      <ul className="mt-2 grid gap-1.5 text-sm">
        {gaps.map((g, i) => <li key={`g${i}`}><span className="bx-todo" data-todo="author">gap</span> {g}</li>)}
        {t.todo.filter((x) => !gaps.includes(x.what)).map((x, i) => <li key={`t${i}`}><span className="bx-todo" data-todo="author">todo</span> {x.what}</li>)}
      </ul>
    </section>
  );
}

function CandidatePanel({ t, rows }: { t: Taxon; rows: ReturnType<typeof plantPageModel>['rows'] }) {
  const s = t.safety_evidence;
  const humanRows = (s?.evidence ?? []).filter((e) => ['A', 'B', 'C'].includes(e.grade)).length;
  return (
    <article className="bx-card p-4 flex flex-col" data-testid="candidate-panel" aria-labelledby={`cand-${t.id}`}>
      <p className="text-[11px] font-semibold tracking-[0.15em] bx-muted">CANDIDATE</p>
      <h3 id={`cand-${t.id}`} className="text-2xl mt-1"><TaxonName name={t.accepted_name} link={false} /> <span className="text-sm bx-muted font-body">{t.authority}</span></h3>
      <p className="text-sm">{t.common_names.join(' · ')}</p>
      <p className="mt-2 flex flex-wrap gap-1 text-xs"><DepthChip depth={t.profile_depth} />{s?.plant_part_used && <span className="bx-status">part: {s.plant_part_used}</span>}</p>
      <dl className="mt-3 text-sm grid gap-1">
        <div><dt className="inline font-semibold">Curated compounds: </dt><dd className="inline">{t.compounds.length} ({rows.length} occurrence rows)</dd></div>
        <div><dt className="inline font-semibold">Evidence rows: </dt><dd className="inline">{s?.evidence.length ?? 0} ({humanRows} in people, grades A–C)</dd></div>
        <div><dt className="inline font-semibold">Constituents of concern: </dt><dd className="inline">{s?.safety.constituents_of_concern.length ? s.safety.constituents_of_concern.map((c, i) => <span key={c.compound_id}>{i ? ', ' : ''}<Link className="underline" to={`/compounds/${c.compound_id}`}>{getCompoundMeta(c.compound_id)?.name ?? c.compound_id}</Link></span>) : 'none recorded'}</dd></div>
        <div><dt className="inline font-semibold">Adverse-event history: </dt><dd className="inline">{s?.safety.adverse_event_history.statement ?? <span className="bx-todo">not researched</span>}</dd></div>
      </dl>
      <Link to={`/plants/${t.id}`} className="bx-btn-primary mt-4 self-start">Full profile of <i className="ml-1">{t.accepted_name}</i> →</Link>
    </article>
  );
}

export default function Plant() {
  const { id } = useParams();
  const meta = getTaxonMeta(id);
  const [rec, setRec] = useState<TaxonRecordFile | null | undefined>(undefined);
  useEffect(() => { let live = true; setRec(undefined); if (id) loadTaxonRecord(id).then((r) => { if (live) setRec(r); }); return () => { live = false; }; }, [id]);
  useEffect(() => { if (meta) document.title = `${meta.accepted_name} · Greenhouse Explorer`; }, [meta]);
  if (!meta) return <NotFound />;
  const taxa = rec?.taxa;
  const t = taxa?.find((x) => x.id === id);
  if (!rec || !t || !taxa) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8 min-h-[150vh]">
        <p className="text-[11px] font-semibold tracking-[0.2em] bx-muted">PLANT · {meta.family.toUpperCase()}</p>
        <h1 className="text-3xl sm:text-4xl leading-tight mt-1"><i>{meta.accepted_name}</i> {meta.authority && <span className="text-xl bx-muted font-body">{meta.authority}</span>}</h1>
        <p className="mt-1 text-lg">{meta.common_names.join(' · ')}</p>
        <p className="mt-4 bx-muted" role="status">Loading the record…</p>
      </div>
    );
  }
  const rows = rec.rows;
  const plantings = { rows: rec.plantings };
  const model = plantPageModel(t, taxa, rows);
  const s = t.safety_evidence;
  const sourceRefs = [...(s?.cited_refs ?? []), ...model.rows.flatMap((r) => r.refs)];

  if (model.kind === 'unresolved') {
    const inv = plantings.rows.filter((p) => p.taxon_id === t.id);
    return (
      <div className="mx-auto max-w-6xl px-4 py-8">
        <Header t={t} />
        <section className="mt-6 bx-card p-4 border-l-4 border-l-amber-600" aria-labelledby="unres-h">
          <h2 id="unres-h" className="text-2xl">Which skullcap is on the bench?</h2>
          {inv.map((p) => (
            <p key={p.id} className="bx-prose mt-2">The inventory entry <strong>“{p.original_entry}”</strong> ({p.id}) names <i>{p.scientific_name}</i>. Its note reads: “{p.note}”</p>
          ))}
          <p className="bx-prose mt-2">Until the seed packet is checked, this page shows both candidate species side by side.</p>
        </section>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {model.candidates.map((c) => <CandidatePanel key={c.id} t={c} rows={rows.filter((r) => r.taxon_id === c.id)} />)}
        </div>
        <section className="mt-8" aria-labelledby="matrix-h">
          <h2 id="matrix-h" className="text-2xl">The two candidates, compound by compound</h2>
          <CompoundMatrix taxa={model.candidates.map((c) => c.id)} rows={rows} caption="Look at the plant part and the basis in each cell: aerial parts of one species and the root of the other are different materials, and values without a stated basis cannot be set against each other." />
          <p className="mt-2 text-sm"><Link className="underline" to={`/compare?plants=${model.candidates.map((c) => c.id).join(',')}`}>Open this pair in Compare →</Link> · <Link className="underline" to="/tours/two-skullcaps">Follow the “Two skullcaps” tour →</Link></p>
        </section>
        <section className="mt-8 bx-card p-4" aria-labelledby="resolve-h" data-testid="how-it-resolves">
          <h2 id="resolve-h" className="text-xl">How this entry resolves</h2>
          <p className="bx-prose mt-1">By setting <code>identity_status</code> and <code>candidates</code> on one record: when the packet names the species, <code>scutellaria-sp</code> becomes <code>confirmed</code> as that species (or points to it), the other candidate leaves the inventory, and this page becomes an ordinary plant page.</p>
        </section>
        <GrownHere t={t} plantings={plantings.rows} />
        <PrimerLinks sections={t.primer_sections} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <Header t={t} />
      <GrownHere t={t} plantings={plantings.rows} />
      {model.kind === 'stub' ? (
        <>
          <ProfileInProgress t={t} />
          {t.compounds.length > 0 && <CuratedCompounds t={t} rows={model.rows} />}
        </>
      ) : (
        <>
          {t.profile_depth === 'light' && (
            <p className="mt-6 text-sm bx-card p-3" data-testid="light-note">
              <span className="font-semibold">Profile depth: light</span> — this page carries curated compounds, their occurrence rows and a safety block from a single pass.
              A full profile adds whole-plant evidence read in depth, cultivar-level chemistry wherever a source names the cultivar, and double-extracted tables.
            </p>
          )}
          {t.profile_depth === 'guest' && <p className="mt-6 text-sm bx-card p-3"><span className="font-semibold">{DEPTH_LABEL.guest}</span> — the one plant outside the mint family with a profile in this prototype.</p>}
          <CuratedCompounds t={t} rows={model.rows} />
          <EvidenceTable rows={s?.evidence ?? []} empty="No whole-plant evidence rows in this record — see what this record does not know." />
          {s ? <TaxonSafetyBlock s={s} /> : <section className="mt-8"><h2 className="text-2xl">Safety</h2><p className="mt-2"><span className="bx-todo">No safety block for this plant in this pass.</span></p></section>}
          <Preparations preps={rec.preparations} />
          <PrimerLinks sections={t.primer_sections} />
          <Gaps t={t} />
          <Sources refs={sourceRefs} />
          {t.candidate_of && <p className="mt-6 text-sm">This species is a candidate identity for <Link className="underline" to={`/plants/${t.candidate_of}`}>{getTaxonMeta(t.candidate_of)?.common_names[0] ?? t.candidate_of}</Link> on the inventory.</p>}
        </>
      )}
      <p className="mt-8 text-sm bx-muted">Record as of {t.as_of}. <Link className="underline" to="/plants">All {taxaIndex.length} plants</Link></p>
    </div>
  );
}
