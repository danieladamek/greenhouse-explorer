import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AS_OF, asOfLong, assetUrl, getCompoundMeta, getTerm, manifest, provenance, sectionTitle } from '@/lib/data';
import { loadBuildErrors, loadScope, loadStructureSummary, loadSynthesis, loadTodo, useAsync } from '@/lib/heavy';
import { BASIS_LABEL, type Basis } from '@/lib/basis';
import { GradeLegend, TEST_ARTICLE_LABEL } from '@/components/catalogue/Chips';
import type { TestArticle } from '@/types';

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return <div className="bx-card p-3"><p className="text-[11px] font-semibold tracking-[0.15em] bx-muted">{label}</p><p className="text-lg font-display mt-0.5 leading-snug">{value}</p></div>;
}
function H2({ id, children }: { id: string; children: React.ReactNode }) {
  return <h2 id={id} className="text-2xl mt-12 text-ink dark:text-night-ink scroll-mt-36">{children}</h2>;
}
const kv = (o: Record<string, number>) => Object.entries(o).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(' · ');

/** /methods — scope, content line, search strategy, corpus, grades, basis rule, synthesis, catalogue counts, structures, todo. */
export default function Methods() {
  const scope = useAsync(loadScope);
  const todo = useAsync(loadTodo);
  const buildErrors = useAsync(loadBuildErrors);
  const synthesis = useAsync(loadSynthesis);
  const structures = useAsync(loadStructureSummary);
  const [queryFilter, setQueryFilter] = useState('');
  const [showAll, setShowAll] = useState(false);
  const cat = provenance.catalogue;

  const queries = useMemo(() => {
    const qs = scope?.search_strategy.queries ?? [];
    const n = queryFilter.trim().toLowerCase();
    return n ? qs.filter((q) => `${q.q} ${q.source ?? ''} ${q.lane ?? ''} ${q.note ?? ''}`.toLowerCase().includes(n)) : qs;
  }, [scope, queryFilter]);
  const shown = showAll || queryFilter ? queries : queries.slice(0, 25);
  const lanes = useMemo(() => {
    const m = new Map<string, { n: number; kept: number }>();
    for (const q of scope?.search_strategy.queries ?? []) { const k = q.lane ?? '—'; const e = m.get(k) ?? { n: 0, kept: 0 }; e.n++; e.kept += q.kept ?? 0; m.set(k, e); }
    return [...m.entries()].sort((a, b) => b[1].n - a[1].n);
  }, [scope]);
  const todoGroups = useMemo(() => (todo ?? []).reduce<Record<string, typeof todo>>((acc, t) => { const k = t!.where; (acc[k] ??= []).push(t!); return acc; }, {}), [todo]);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 bx-prose text-ink dark:text-night-ink">
      <h1 className="text-3xl sm:text-4xl text-ink dark:text-night-ink">Methods &amp; provenance</h1>
      <p className="mt-2 flex flex-wrap items-center gap-2">
        <span className="bx-chip border border-[color:var(--bx-line)] font-semibold">PROTOTYPE FOR CRITIQUE</span>
        <span className="bx-chip border border-[color:var(--bx-line)] bx-muted">COMMISSIONED REVIEW — NOT PEER REVIEWED</span>
        <span className="bx-asof">Content current as of {AS_OF}</span>
      </p>
      <p className="mt-3 text-[17px] leading-8 font-semibold">This is a scope-bounded commissioned review and catalogue, not a systematic review — and it is a prototype built for critique.</p>
      <p className="mt-2">
        It has had no external scientific review of any kind and is not an official UAH resource. What it offers is traceability: every claim in the primer carries a
        citation, every inference is marked, every amount carries its basis, every health statement carries a grade and its test article, and the scope, the interview and the
        search log are published below. Built {provenance.built} by Claude Code from a content pack written by {manifest.builder.name} ({manifest.builder.version}).
      </p>
      <nav className="mt-3 text-sm" aria-label="On this page">
        On this page: {[['prototype', 'the prototype and its thin places'], ['content-line', 'content line'], ['scope', 'scope'], ['interview', 'interview'], ['search', 'search strategy'], ['corpus', 'corpus profile'], ['grades', 'evidence grades'], ['basis', 'the basis rule'], ['synthesis', 'synthesis passages'], ['catalogue', 'catalogue counts'], ['structures', 'structure build'], ['terms', 'term linking'], ['todo', 'every open item']].map(([id, l], i) => <span key={id}>{i ? ' · ' : ''}<a className="underline" href={`#${id}`}>{l}</a></span>)}
      </nav>

      {buildErrors && buildErrors.length > 0 && (
        <section className="mt-6 bx-card p-4 border-l-4 border-l-amber-600" aria-labelledby="errors-h" data-testid="build-errors">
          <h2 id="errors-h" className="text-2xl text-ink dark:text-night-ink">Content-build errors ({buildErrors.length})</h2>
          <p className="mt-1 text-sm">The content build found these problems in the pack. The app was built with everything that validated; the list is also in <code className="font-mono text-xs">content-pack/BUILD-ERRORS.md</code>. An unknown id is never re-pointed and uncited prose is never repaired by adding a citation.</p>
          <ul className="mt-2 grid gap-1 text-sm">{buildErrors.map((e, i) => <li key={i}><span className="bx-todo">{e.where}</span> {e.message}</li>)}</ul>
        </section>
      )}

      <H2 id="counts">Provenance counts</H2>
      <p className="mt-1 text-sm">Written at build time to <a className="underline" href={assetUrl('provenance.json')} target="_blank" rel="noreferrer">provenance.json</a>.</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-3 text-sm">
        <Stat label="PRIMER · WORDS" value={`${provenance.sections} sections · ${provenance.words.toLocaleString('en')}`} />
        <Stat label="BLOCKS · CITED · UNCITED" value={`${provenance.blocks.total} · ${provenance.blocks.cited} · ${provenance.blocks.uncited}`} />
        <Stat label="FRAMING · SYNTHESIS" value={`${provenance.blocks.framing} · ${provenance.synthesis_passages}`} />
        <Stat label="REFERENCES" value={`${provenance.references.total} (${kv(provenance.references.by_tier)})`} />
        <Stat label="VERIFIED · UNVERIFIED-BUT-CITED" value={`${provenance.references.verified} of ${provenance.references.total} · ${provenance.references.unverified_but_cited.length}`} />
        <Stat label="GLOSSARY · LINKED" value={`${provenance.terms.total} · ${provenance.terms.linked} of ${provenance.terms.occurring} occurring (${provenance.terms.linked_pct_of_occurring}%)`} />
        <Stat label="TAXA" value={`${provenance.taxa.total} (${kv(provenance.taxa.by_profile_depth)})`} />
        <Stat label="IDENTITY STATUS" value={kv(provenance.taxa.by_identity_status)} />
        <Stat label="PLANTINGS → TAXA" value={`${provenance.plantings.total} rows → ${provenance.plantings.collapsed_to_taxa} planted taxa (${provenance.plantings.taxon_records} records)`} />
        <Stat label="COMPOUNDS" value={`${cat.compounds} (${cat.auxiliary.length} auxiliary) · ${cat.compounds_with_empty_evidence.length} with no evidence rows`} />
        <Stat label="OCCURRENCE ROWS BY BASIS" value={kv(cat.occurrence_rows_by_basis)} />
        <Stat label="OCCURRENCE ROWS VERIFIED" value={`${cat.occurrence_rows_by_verified.true ?? 0} of ${cat.occurrence_rows}`} />
        <Stat label="EVIDENCE ROWS BY GRADE" value={`${cat.evidence_rows}: ${Object.entries(cat.evidence_by_grade).sort().map(([k, v]) => `${k} ${v}`).join(' · ')}`} />
        <Stat label="EVIDENCE BY TEST ARTICLE" value={Object.entries(cat.evidence_by_test_article).map(([k, v]) => `${TEST_ARTICLE_LABEL[k as TestArticle] ?? k} ${v}`).join(' · ')} />
        <Stat label="PREPARATIONS · WITH SAFETY BLOCK" value={`${provenance.preparations.total} · ${provenance.preparations.with_safety_block}`} />
        <Stat label="FORBIDDEN-KEY SCAN" value={`${provenance.forbidden_key_scan.hits} hits (${provenance.forbidden_key_scan.keys.join(', ')})`} />
        <Stat label="STRUCTURES · FORMULA MISMATCHES" value={provenance.structures ? `${provenance.structures.structures} · ${provenance.structures.formula_mismatches}` : 'not built'} />
        <Stat label="OPEN ITEMS (todo.yaml)" value={provenance.todo.count} />
      </div>

      <H2 id="prototype">The prototype, and where its thinness shows</H2>
      <p className="mt-2">
        This site exists so colleagues can critique a working version before the real catalogue is built. <strong>Thin where it says it is thin, honest everywhere</strong>:
        everything below is thin on purpose, shown on screen, and listed here so the critique can be read against it.
      </p>
      <ul className="mt-2 list-disc pl-5 grid gap-1 text-sm">
        <li>{provenance.taxa.by_profile_depth.stub} of {provenance.taxa.total} plant records are stubs: they show identity and what is grown, then “Profile in progress”.</li>
        <li>{cat.compounds_with_empty_evidence.length} of {cat.compounds} compound records have no evidence rows; each says so in amber rather than implying no effect.</li>
        <li>{cat.null_fields['physchem.logp'] ?? 0} of {cat.compounds} records have no measured logP and {cat.null_fields['physchem.pka'] ?? 0} no pKa — amber on every record. The descriptors shown beside each structure are computed by RDKit and labelled so.</li>
        <li>{cat.occurrence_rows_by_basis.unstated ?? 0} occurrence rows give no basis (“basis not stated in source”) and {cat.occurrence_rows_by_basis.presence_only ?? 0} report presence only; none of them is ever charted.</li>
        <li>Pharmacology and absorption are null on {cat.null_fields['pharmacology.mechanism'] ?? 0} and {cat.null_fields.absorption_bioavailability ?? 0} records respectively.</li>
        <li>Every search-log entry has its hit count unrecorded (rendered “not logged in the prototype”, never a number).</li>
        <li>The extraction was single-pass: {scope?.extraction_rule ?? '…'}.</li>
        <li>No history of plantings yet: all {provenance.plantings.total} inventory rows are current.</li>
      </ul>

      <H2 id="content-line">The content line</H2>
      {!scope ? <p className="mt-2 bx-muted" role="status">Loading…</p> : (
        <>
          <p className="mt-2">Preparation is in, as extraction chemistry; dosing is out. This is a ruling, and the app enforces it: <code className="font-mono text-xs">preparations.yaml</code> has a closed schema with no dose, dosage, indication, serving or frequency key, the build scans the whole pack for those keys ({provenance.forbidden_key_scan.hits} found), and no label on any page offers use guidance.</p>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <div className="bx-card p-3"><p className="text-[11px] font-semibold tracking-[0.15em] bx-muted">IN</p><ul className="mt-1 list-disc pl-5 text-sm grid gap-1">{scope.content_line.in.map((x, i) => <li key={i}>{x}</li>)}</ul></div>
            <div className="bx-card p-3 border-l-4 border-l-[color:var(--bx-accent)]"><p className="text-[11px] font-semibold tracking-[0.15em] bx-muted">OUT</p><ul className="mt-1 list-disc pl-5 text-sm grid gap-1">{scope.content_line.out.map((x, i) => <li key={i}>{x}</li>)}</ul></div>
          </div>
          <p className="mt-3"><span className="font-semibold">The extraction rule: </span>{scope.extraction_rule}.</p>

          <H2 id="scope">Scope — what is in, and what is deliberately out</H2>
          <p className="mt-2"><span className="font-semibold">Topic: </span>{scope.topic}</p>
          <p className="mt-2"><span className="font-semibold">Question: </span>{scope.question}</p>
          <p className="mt-2 text-sm bx-muted">Purpose: {scope.purpose} · level: {scope.level} · stance: {scope.stance} · depth: {scope.depth} · current from {scope.time_window.current_from}, seminal: {scope.time_window.seminal} · interview assumed: {String(scope.assumed)}.</p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="bx-card p-3"><p className="text-[11px] font-semibold tracking-[0.15em] bx-muted">IN SCOPE ({scope.boundary.in.length})</p><ul className="mt-1 list-disc pl-5 text-sm grid gap-1">{scope.boundary.in.map((x, i) => <li key={i}>{x}</li>)}</ul></div>
            <div className="bx-card p-3 border-l-4 border-l-[color:var(--bx-accent)]"><p className="text-[11px] font-semibold tracking-[0.15em] bx-muted">OUT OF SCOPE ({scope.boundary.out.length})</p><ul className="mt-1 list-disc pl-5 text-sm grid gap-1">{scope.boundary.out.map((x, i) => <li key={i}>{x}</li>)}</ul></div>
          </div>
          <p className="mt-3"><span className="font-semibold">Why this boundary: </span>{scope.boundary.rationale}</p>
          <div className="bx-card mt-4 p-3"><p className="text-[11px] font-semibold tracking-[0.15em] bx-muted">LEFT OUT, AND WHY</p><ul className="mt-1 grid gap-2 text-sm">{scope.excluded.map((x, i) => <li key={i}><span className="font-semibold">{x.what}</span> — {x.why}</li>)}</ul></div>
          <p className="mt-4 font-semibold">Anchors</p>
          <ul className="mt-1 grid gap-2 text-sm">{scope.anchors.map((a, i) => <li key={i}>{a.citation} {a.refs.length > 0 && <>({a.refs.map((n) => <Link key={n} className="underline mr-1" to={`/references#ref-${n}`}>[{n}]</Link>)})</>}<span className="block bx-muted">{a.why}</span></li>)}</ul>

          <H2 id="interview">The scoping interview, as asked and answered</H2>
          <ol className="mt-3 grid gap-3">{scope.interview.map((qa, i) => <li key={i} className="bx-card p-3 text-sm"><p className="font-semibold">Q. {qa.q}</p><p className="mt-1">A. {qa.answer}</p>{qa.asked && <p className="mt-1 text-xs bx-muted">asked {String(qa.asked).slice(0, 10)}</p>}</li>)}</ol>

          <H2 id="search">Search strategy — every endpoint and query</H2>
          <p className="mt-2">Run on {scope.search_strategy.run_on} across {scope.search_strategy.sources.length} sources: {scope.search_strategy.sources.join(' · ')}. <strong>{scope.search_strategy.queries.length} entries</strong> are logged. <strong>Hit counts were not logged in the prototype</strong>, so every entry below says so instead of showing a number.</p>
          {scope.search_strategy.queries_note && <p className="mt-2 text-sm bx-muted">{scope.search_strategy.queries_note}</p>}
          <div className="mt-3 overflow-x-auto">
            <table className="bx-table"><caption className="sr-only">Entries per lane</caption>
              <thead><tr><th scope="col">Lane</th><th scope="col">Entries</th><th scope="col">Hits</th></tr></thead>
              <tbody>{lanes.map(([lane, s]) => <tr key={lane}><th scope="row" className="font-normal">{lane}</th><td>{s.n}</td><td className="bx-muted">not logged in the prototype</td></tr>)}</tbody>
            </table>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2 no-print">
            <label className="sr-only" htmlFor="query-filter">Filter the search log</label>
            <input id="query-filter" className="bx-input max-w-xs" placeholder="Filter the search log…" value={queryFilter} onChange={(e) => setQueryFilter(e.target.value)} />
            <span className="text-xs bx-muted">{queries.length} of {scope.search_strategy.queries.length}</span>
            {!queryFilter && <button type="button" className="bx-btn" onClick={() => setShowAll((s) => !s)}>{showAll ? 'Show first 25' : `Show all ${queries.length}`}</button>}
          </div>
          <div className="mt-2 overflow-x-auto">
            <table className="bx-table" data-testid="query-log"><caption className="sr-only">Every logged search endpoint or query, with its source and lane</caption>
              <thead><tr><th scope="col">#</th><th scope="col">Query or endpoint</th><th scope="col">Source</th><th scope="col">Lane</th><th scope="col">Hits</th></tr></thead>
              <tbody>{shown.map((q) => (
                <tr key={scope.search_strategy.queries.indexOf(q)}>
                  <td className="tabular-nums bx-muted">{scope.search_strategy.queries.indexOf(q) + 1}</td>
                  <td className="break-all text-xs">{q.q}{q.note && <span className="block bx-muted break-normal">{q.note}</span>}</td>
                  <td className="whitespace-nowrap text-xs">{q.source}</td>
                  <td className="whitespace-nowrap text-xs bx-muted">{q.lane}</td>
                  <td className="text-xs">{q.hits === null ? <span className="bx-muted">not logged in the prototype</span> : q.hits}{q.kept !== undefined && <span className="block">kept {q.kept}</span>}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div className="bx-card p-3"><p className="text-[11px] font-semibold tracking-[0.15em] bx-muted">INCLUSION</p><ul className="mt-1 list-disc pl-5 text-sm grid gap-1">{scope.search_strategy.inclusion.map((x, i) => <li key={i}>{x}</li>)}</ul></div>
            <div className="bx-card p-3"><p className="text-[11px] font-semibold tracking-[0.15em] bx-muted">EXCLUSION</p><ul className="mt-1 list-disc pl-5 text-sm grid gap-1">{scope.search_strategy.exclusion.map((x, i) => <li key={i}>{x}</li>)}</ul></div>
          </div>
          <div className="bx-card mt-4 p-3"><p className="text-[11px] font-semibold tracking-[0.15em] bx-muted">SNOWBALLING</p><ul className="mt-1 list-disc pl-5 text-sm grid gap-1">{scope.search_strategy.snowball.map((x, i) => <li key={i}>{x}</li>)}</ul></div>
          <div className="bx-card mt-4 p-3 border-l-4 border-l-amber-600"><p className="text-[11px] font-semibold tracking-[0.15em] bx-muted">KNOWN GAPS IN THE SWEEP ITSELF</p><ul className="mt-1 list-disc pl-5 text-sm grid gap-1">{scope.search_strategy.known_gaps.map((x, i) => <li key={i}>{x}</li>)}</ul></div>

          <H2 id="corpus">Corpus profile — the honesty check</H2>
          <div className="mt-2 grid gap-2 sm:grid-cols-3 text-sm">
            <Stat label="BY TIER" value={kv(scope.corpus_profile.by_tier)} />
            <Stat label="YEAR RANGE" value={(scope.corpus_profile.year_range ?? []).join('–')} />
            <Stat label="VERIFIED" value={`${scope.corpus_profile.verified ?? provenance.references.verified} of ${scope.corpus_profile.total ?? provenance.references.total}`} />
          </div>
          <p className="mt-3"><span className="font-semibold">Concentration. </span>{scope.corpus_profile.concentration}</p>
          <p className="mt-2"><span className="font-semibold">Is dissent represented? </span>{scope.corpus_profile.dissent_represented ? 'Yes.' : 'No.'} {scope.corpus_profile.dissent_note}</p>
          {scope.corpus_profile.dissent_examples.length > 0 && <ul className="mt-1 list-disc pl-5 text-sm grid gap-1">{scope.corpus_profile.dissent_examples.map((x, i) => <li key={i}>{x}</li>)}</ul>}
          {scope.corpus_profile.note && <p className="mt-2 text-sm bx-muted">{scope.corpus_profile.note}</p>}

          <H2 id="grades">Evidence grades and the test-article rule</H2>
          <div className="mt-3 bx-card p-3"><GradeLegend /></div>
          {scope.evidence_grades.example && <p className="mt-3"><span className="font-semibold">Example. </span>{scope.evidence_grades.example}</p>}
          <p className="mt-2 text-sm">In the app, every evidence row shows its grade badge and its test article together, and says its population; the heading is always “Evidence”. Drug-interaction statements carry a grade in the pack but no test article, so the app shows “test article not recorded” beside the grade.</p>
        </>
      )}

      <H2 id="basis">The basis rule</H2>
      <p className="mt-2">An amount never loses its basis. Every occurrence value is shown with its unit and basis; “basis not stated in source” is labelled; “presence only” shows no number. Values are never averaged and never converted — not between bases, and not between units within a basis (ppm is not turned into %). <Link className="underline" to="/compare">Compare</Link> refuses to chart rows on different bases, and rows with no stated basis or presence only never reach a chart.</p>
      <div className="mt-3 overflow-x-auto">
        <table className="bx-table"><thead><tr><th scope="col">Basis</th><th scope="col">Rows</th><th scope="col">In charts?</th></tr></thead>
          <tbody>{Object.entries(cat.occurrence_rows_by_basis).map(([b, n]) => <tr key={b}><th scope="row" className="font-normal">{BASIS_LABEL[b as Basis] ?? b}</th><td>{n}</td><td>{b === 'unstated' || b === 'presence_only' ? 'never' : 'only with rows of the same basis and unit'}</td></tr>)}</tbody>
        </table>
      </div>

      <H2 id="synthesis">Every synthesis passage ({synthesis?.length ?? provenance.synthesis_passages})</H2>
      <p className="mt-2">A <em>synthesis</em> passage states a conclusion the cited works do not individually state. It is marked in the reader with a quiet left rule and the word <em>synthesis</em>. The primer also has {provenance.blocks.framing} <em>framing</em> blocks (transitions that carry no claim of fact) and {provenance.blocks.uncited} uncited blocks.</p>
      <ol className="mt-3 grid gap-2 text-sm">{(synthesis ?? []).map((s) => <li key={s.id} className="bx-card p-3"><p className="text-[11px] font-semibold tracking-[0.15em] bx-muted">{sectionTitle(s.section)}</p><p className="mt-1 leading-6">{s.excerpt}…</p><p className="mt-1"><Link className="underline text-xs font-semibold" to={`/read#${s.id}`} data-testid="synthesis-link">Read it in context →</Link></p></li>)}</ol>
      <p className="mt-2 text-sm">No claim rests on an unverified reference: {provenance.references.unverified.length} reference{provenance.references.unverified.length === 1 ? ' is' : 's are'} unverified ({provenance.references.unverified.map((n) => <Link key={n} className="underline mr-1" to={`/references#ref-${n}`}>[{n}]</Link>)}) and {provenance.references.unverified_but_cited.length} of them is cited in the primer.</p>

      <H2 id="catalogue">The catalogue</H2>
      <p className="mt-2">Compounds with no evidence rows ({cat.compounds_with_empty_evidence.length}): {cat.compounds_with_empty_evidence.map((id, i) => <span key={id}>{i ? ', ' : ''}<Link className="underline" to={`/compounds/${id}`}>{getCompoundMeta(id)?.name ?? id}</Link></span>)}.</p>
      <p className="mt-2"><span className="font-semibold">Null fields, by field. </span>Each is a recorded decision; nothing was estimated or filled.</p>
      <div className="mt-2 overflow-x-auto"><table className="bx-table"><thead><tr><th scope="col">Field</th><th scope="col">Records with no value</th></tr></thead><tbody>{Object.entries(cat.null_fields).sort((a, b) => b[1] - a[1]).map(([k, v]) => <tr key={k}><th scope="row" className="font-mono text-xs font-normal">{k}</th><td>{v} of {cat.compounds}</td></tr>)}</tbody></table></div>
      {cat.occurrence_rows_unknown_taxon.length > 0 && <p className="mt-2 text-sm"><span className="bx-todo">occurrence rows naming a taxon with no taxa.yaml record</span> {cat.occurrence_rows_unknown_taxon.join(', ')} — shown on the compound page with that label.</p>}

      <H2 id="structures">Structure build</H2>
      {!structures ? <p className="mt-2 bx-muted">Loading…</p> : (
        <>
          <p className="mt-2"><code className="font-mono text-xs">scripts/build-data.py</code> (ported from Bioactive Explorer) parsed every SMILES with RDKit {structures.rdkitVersion}, recomputed formula and InChIKey and compared them with the pack, fetched a PubChem 3D conformer for each by InChIKey (re-checked by InChIKey), and drew the 2D depictions. The app never calls PubChem: everything is a file in this site.</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-3 text-sm">
            <Stat label="STRUCTURES" value={`${structures.structures} of ${structures.compounds}`} />
            <Stat label="FORMULA · INCHIKEY MISMATCHES" value={`${structures.formulaMismatches.length} · ${structures.inchikeyMismatches.length}`} />
            <Stat label="CONFORMERS" value={`PubChem ${structures.pubchemConformers.length} · RDKit fallback ${structures.rdkitConformers.length}`} />
          </div>
          <p className="mt-2 text-sm">No single structure: {structures.noSingleStructure.map((id) => <Link key={id} className="underline mr-1" to={`/compounds/${id}`}>{getCompoundMeta(id)?.name ?? id}</Link>)}. RDKit conformer fallbacks: {structures.rdkitConformers.length ? structures.rdkitConformers.join(', ') : 'none'}. Molecular weights differing from the pack by more than 0.05 g/mol: {structures.mwDifferences.length || 'none'}.</p>
          {structures.warnings.length > 0 && <details className="mt-2 text-sm"><summary className="cursor-pointer">Identifier warnings ({structures.warnings.length})</summary><ul className="mt-1 list-disc pl-5 grid gap-1">{structures.warnings.map((w, i) => <li key={i}>{w}</li>)}</ul></details>}
        </>
      )}

      <H2 id="terms">How terms were linked</H2>
      <p className="mt-2">A matcher built from every glossary term and its variants ({provenance.terms.variants} strings) walks the primer and the catalogue's prose — compound records, preparation methods and safety statements: whole word, longest match, first occurrence per section, skipping headings, code, maths and links. {provenance.terms.ambiguous_variants.length} variants were ambiguous; the build fails on any.</p>
      <p className="mt-2 text-sm">{provenance.terms.only_in_catalogue.length} terms occur only in catalogue prose: {provenance.terms.only_in_catalogue.map((id) => <Link key={id} className="underline mr-2" to={`/glossary#${id}`}>{getTerm(id)?.term ?? id}</Link>)}</p>
      <p className="mt-2 text-sm">{provenance.terms.unmatched.length} occur in no rendered prose and are reachable from the glossary, the 101s and search: {provenance.terms.unmatched.map((id) => <Link key={id} className="underline mr-2" to={`/glossary#${id}`}>{getTerm(id)?.term ?? id}</Link>)}</p>

      <H2 id="written">What was written by whom</H2>
      <ul className="list-disc pl-5 mt-2">
        <li><strong>Written by the content-pack builder</strong> ({manifest.builder.name} {manifest.builder.version}): the primer, the plain-language abstract, every glossary entry, the {provenance.concepts} concept pages, both figures, every reference summary, every plant, compound, safety and preparation record. It is the only source of scientific content here.</li>
        <li><strong>Rendered as written by this build</strong> (Claude Code): structured, linked and rendered, never rephrased; no fact, number, definition or summary was added and no gap filled.</li>
        <li><strong>Written by this build</strong>: page labels and explanations of how the site works, and the two tours, whose every step paraphrases a named pack field and keeps its citations.</li>
      </ul>

      <H2 id="todo">Every open item — todo.yaml ({todo?.length ?? provenance.todo.count})</H2>
      <p className="mt-2">Grouped by where they apply. These are decisions recorded by the pack, not oversights; they show in amber where they apply.</p>
      <div className="mt-2 grid gap-2" data-testid="todo-list">
        {Object.entries(todoGroups).map(([g, items]) => (
          <details key={g} className="bx-card p-3" open={(items?.length ?? 0) < 3}>
            <summary className="cursor-pointer font-semibold text-sm">{g} <span className="bx-muted font-normal">({items?.length})</span></summary>
            <ul className="mt-2 grid gap-1 text-sm">{items?.map((t, i) => <li key={i}><span className="bx-todo">TODO(author)</span> {t.what}</li>)}</ul>
          </details>
        ))}
      </div>

      <H2 id="verified">How this was checked</H2>
      <ul className="list-disc pl-5 mt-2 text-sm">
        <li>The content build re-implements the pack rules as zod schemas plus the catalogue spec (closed preparation schema, basis and grade enums, taxon and compound cross-references, the forbidden-key scan) and fails loudly.</li>
        <li>Unit tests: a fixture pack with one deliberate error per rule; the term matcher; the parser; the notepad; and the catalogue rules — no amount rendered without unit and basis, mixed bases refused, unstated and presence-only rows never charted, every evidence row with grade and test article, all taxa yielding a page.</li>
        <li>Playwright: every route with its heading and the prototype banner, the critique link, a term popover by keyboard, a citation fold-out, the notepad, dark mode, 375 px, the stub and unresolved plant pages, the 3D viewer with atom picking and a distance, the comparison refusal or chart as the data implies, the SVG downloads and both tours.</li>
      </ul>
      <p className="mt-6 text-sm">Content current as of {asOfLong()}. <Link className="underline" to="/about">About this site and how to report an error →</Link></p>
    </div>
  );
}
