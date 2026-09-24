/**
 * build-content.ts — validate the content pack, link terms, emit src/data/*.json + public/provenance.json.
 *
 * Topic mode (APP-SPEC §6.1): the body is review.md, the citation-coverage gate is enforced per block, every
 * `<!-- synthesis -->` block gets a stable id, scope.yaml is published content, and references are tiered.
 * Catalogue extension (KICKOFF §3–§4d): compounds.yaml, taxa.yaml, plantings.csv, preparations.yaml (closed
 * schema) and taxa_safety_evidence.yaml are validated; their prose is term-linked; occurrence rows are flattened
 * into one traceable table (unit + basis on every row); per-taxon, per-family and per-preparation page models are
 * built; the structure build's summary (public/structures/summary.json, from scripts/build-data.py) is merged.
 *
 * Fails loudly (exit 1) on any schema violation, unresolved [n], unknown term/concept/compound/taxon id, missing
 * data file, ambiguous term variant, uncited block, claim resting on an unverified reference, forbidden key, or
 * planting whose taxon is not in taxa.yaml. Errors are written to content-pack/BUILD-ERRORS.md and
 * src/data/build-errors.json so /methods can surface them; whatever validated is still emitted. Idempotent:
 * outputs are rewritten only when their content changed.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';
import {
  CompoundsSchema, ConceptFrontmatterSchema, FiguresSchema, GlossarySchema, ManifestSchema, PLANTING_COLUMNS,
  PREPARATION_KEYS, PlantingSchema, PreparationsSchema, QUANT_BASES, ReferencesSchema, ScopeSchema, TaxaFileSchema,
  TaxaSafetySchema, TodoSchema, scanForbiddenKeys, zodErrors,
  type BuildError, type ConceptFrontmatter, type Evidence, type FigureDef, type GlossaryEntry, type PackCompound,
  type PackTaxon, type Planting, type Preparation, type Reference, type TaxonSafety,
} from './lib/schemas';
import { buildMatcher, findAmbiguousVariants, linkCitations, linkTerms } from './lib/linker';
import { parseReview } from './lib/parse';
import { loadFigureData, parseCsvRaw, type LoadedFigure } from './lib/figures';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// Tests point the build at a mutated copy of the pack (BX_PACK_DIR) and a scratch output root (BX_OUT_ROOT), so a
// fixture with one deliberate error per rule runs through exactly the code that ships.
const PACK = process.env.BX_PACK_DIR ? path.resolve(process.env.BX_PACK_DIR) : path.join(ROOT, 'content-pack');
const OUT = process.env.BX_OUT_ROOT ? path.resolve(process.env.BX_OUT_ROOT) : ROOT;

const errors: BuildError[] = [];
const warnings: string[] = [];
const E = (where: string, message: string) => errors.push({ where, message });
const W = (m: string) => warnings.push(m);
const written: { file: string; status: 'written' | 'unchanged'; bytes: number }[] = [];

function readYaml(file: string): unknown {
  const p = path.join(PACK, file);
  if (!fs.existsSync(p)) { E(file, 'missing file'); return undefined; }
  try { return yaml.load(fs.readFileSync(p, 'utf8')); } catch (e) { E(file, `YAML parse error: ${(e as Error).message}`); return undefined; }
}

function emit(rel: string, content: string | Buffer) {
  const p = rel.startsWith('content-pack/') ? path.join(PACK, rel.slice('content-pack/'.length)) : path.join(OUT, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  const same = fs.existsSync(p) && Buffer.compare(fs.readFileSync(p), Buffer.isBuffer(content) ? content : Buffer.from(content)) === 0;
  if (!same) fs.writeFileSync(p, content);
  written.push({ file: rel, status: same ? 'unchanged' : 'written', bytes: Buffer.byteLength(content) });
}
const emitJson = (rel: string, data: unknown) => emit(rel, JSON.stringify(data, null, 1) + '\n');

// ───────────────────────── 1. load + validate every pack file
const manifestParsed = ManifestSchema.safeParse(readYaml('manifest.yaml'));
if (!manifestParsed.success) errors.push(...zodErrors('manifest', manifestParsed.error));
const manifestRaw = manifestParsed.success ? manifestParsed.data : undefined;
// builder is a string in this pack; the app reads {name, version}
const manifest = manifestRaw && {
  ...manifestRaw,
  builder: typeof manifestRaw.builder === 'string'
    ? { name: 'Manuscript Interrogator', version: manifestRaw.builder, date: manifestRaw.as_of ?? '' }
    : { date: manifestRaw.as_of ?? '', ...manifestRaw.builder },
};
const TOPIC = manifest?.mode === 'topic';
if (manifest && !manifest.plain_abstract.trim()) W('manifest: plain_abstract empty');

const glossaryParsed = GlossarySchema.safeParse(readYaml('glossary.yaml') ?? []);
if (!glossaryParsed.success) errors.push(...zodErrors('glossary', glossaryParsed.error));
const glossary: GlossaryEntry[] = glossaryParsed.success ? glossaryParsed.data : [];
const termIds = new Set(glossary.map((t) => t.id));
for (const [i, t] of glossary.entries()) if (glossary.findIndex((u) => u.id === t.id) !== i) E(`glossary/${t.id}`, 'duplicate id');
const ambiguous = findAmbiguousVariants(glossary);
for (const a of ambiguous) E('glossary', `variant collision ${JSON.stringify(a.variant)} between ${a.ids.join(' and ')}`);

const conceptFiles = fs.existsSync(path.join(PACK, 'concepts')) ? fs.readdirSync(path.join(PACK, 'concepts')).filter((f) => f.endsWith('.md')).sort() : [];
interface ConceptOut extends ConceptFrontmatter { body_before: string; picture: string | null; body_after: string; has_math: boolean; used_by_terms: string[]; used_by_figures: string[]; used_by_concepts: string[] }
const concepts: ConceptOut[] = [];
for (const f of conceptFiles) {
  const src = fs.readFileSync(path.join(PACK, 'concepts', f), 'utf8');
  const m = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/.exec(src);
  if (!m) { E(`concepts/${f}`, 'no frontmatter'); continue; }
  let fm: unknown;
  try { fm = yaml.load(m[1]); } catch (e) { E(`concepts/${f}`, `frontmatter YAML: ${(e as Error).message}`); continue; }
  const parsed = ConceptFrontmatterSchema.safeParse(fm);
  if (!parsed.success) { errors.push(...zodErrors(`concepts/${f}`, parsed.error)); continue; }
  const c = parsed.data;
  if (c.id !== f.replace(/\.md$/, '')) E(`concepts/${f}`, `id ${c.id} != filename`);
  const body = m[2].trim();
  for (const h of ['## What it is', '## How this paper uses it']) if (!body.includes(h)) W(`concept ${c.id}: missing section '${h}'`);
  const pic = /(^|\n)## The key idea in one picture\s*\n([\s\S]*?)(?=\n## |$)/.exec(body);
  let body_before = body, picture: string | null = null, body_after = '';
  if (pic) {
    body_before = body.slice(0, pic.index).trim();
    picture = pic[2].trim();
    body_after = body.slice(pic.index + pic[0].length).trim();
  }
  concepts.push({ ...c, body_before, picture, body_after, has_math: /\$/.test(body), used_by_terms: [], used_by_figures: [], used_by_concepts: [] });
}
const conceptIds = new Set(concepts.map((c) => c.id));
for (const c of concepts) {
  for (const p of c.prerequisites) if (!conceptIds.has(p)) E(`concepts/${c.id}`, `unknown prerequisite ${p}`);
  for (const t of c.terms) if (!termIds.has(t)) E(`concepts/${c.id}`, `unknown term ${t}`);
}
for (const t of glossary) {
  if (t.concept && !conceptIds.has(t.concept)) E(`glossary/${t.id}`, `concept -> unknown ${t.concept}`);
  for (const s of t.see) if (!termIds.has(s)) E(`glossary/${t.id}`, `see -> unknown ${s}`);
}

const figuresParsed = FiguresSchema.safeParse(readYaml('figures.yaml') ?? []);
if (!figuresParsed.success) errors.push(...zodErrors('figures', figuresParsed.error));
const figures: FigureDef[] = figuresParsed.success ? figuresParsed.data : [];
const figureIds = new Set(figures.map((f) => f.id));
for (const [i, f] of figures.entries()) if (figures.findIndex((u) => u.id === f.id) !== i) E(`figures/${f.id}`, 'duplicate id');
if (TOPIC) for (const f of figures) {
  if (!f.synthesis) E(`figures/${f.id}`, 'topic mode needs synthesis: data | conceptual');
  if (!f.refs.length) E(`figures/${f.id}`, 'topic mode needs refs: [n, …] — a figure with no references does not ship');
  if (f.kind === 'image' && !/permission/i.test(manifest?.permissions.figures ?? '')) {
    E(`figures/${f.id}`, 'kind image in topic mode needs explicit permission in manifest.permissions.figures');
  }
}

const referencesParsed = ReferencesSchema.safeParse(readYaml('references.yaml') ?? []);
if (!referencesParsed.success) errors.push(...zodErrors('references', referencesParsed.error));
const references: Reference[] = referencesParsed.success ? referencesParsed.data : [];
const refByN = new Map<number, Reference>();
for (const r of references) { if (refByN.has(r.n)) E(`references/${r.n}`, 'duplicate n'); refByN.set(r.n, r); }
if (TOPIC) for (const r of references) {
  if (!r.tier) E(`references/${r.n}`, 'topic mode needs tier: seminal | current | background');
  if (!r.year) E(`references/${r.n}`, 'topic mode needs year');
  if (r.tier === 'seminal') {
    if (r.summary.trim().split(/\s+/).length < 30) E(`references/${r.n}`, 'seminal tier needs a full summary (3–6 sentences)');
    if (!r.why_it_mattered.trim()) E(`references/${r.n}`, 'seminal tier needs why_it_mattered');
  }
}

const todoParsed = TodoSchema.safeParse(fs.existsSync(path.join(PACK, 'todo.yaml')) ? readYaml('todo.yaml') ?? [] : []);
if (!todoParsed.success) errors.push(...zodErrors('todo', todoParsed.error));
const todo = todoParsed.success ? todoParsed.data : [];

let scope = undefined as undefined | ReturnType<typeof ScopeSchema.parse>;
if (TOPIC) {
  const scopeParsed = ScopeSchema.safeParse(readYaml('scope.yaml'));
  if (!scopeParsed.success) errors.push(...zodErrors('scope', scopeParsed.error));
  else {
    scope = scopeParsed.data;
    // every query carries a hits key; null means "not logged" and is rendered as such, never as a number
    if (scope.assumed) W('scope: assumed=true — the interview went unanswered; defaults must be shown on /methods');
  }
}

// ───────────────────────── 2. review.md → sections, blocks, term links, citation tokens
const bodyFile = TOPIC ? 'review.md' : 'manuscript.md';
const bodyPath = path.join(PACK, bodyFile);
const body = fs.existsSync(bodyPath) ? fs.readFileSync(bodyPath, 'utf8') : (E(bodyFile, 'missing file'), '');
const matcher = buildMatcher(glossary);
const parsed = parseReview(body, matcher, { everyOccurrence: manifest?.link_every_occurrence ?? false });
for (const d of parsed.duplicateSections) E(bodyFile, `duplicate section id ${d}`);
const sectionIds = new Set(parsed.sections.map((s) => s.id));
for (const fm of parsed.figureMarkers) if (!figureIds.has(fm)) E(bodyFile, `figure marker ${fm} not in figures.yaml`);
for (const f of figures) if (!parsed.figureMarkers.includes(f.id)) W(`figure ${f.id} has no marker in ${bodyFile}`);

// APP-SPEC §6.1 rule 5 — uncited prose is a content-build error and is never repaired by adding a citation.
for (const u of parsed.uncited) E(`${bodyFile}/${u.section}`, `uncited block of ${u.words} words — cite it or mark it <!-- framing -->: ${JSON.stringify(u.excerpt)}`);

// quotations ≤ 25 words (CONTENT-PACK, topic mode)
if (TOPIC) {
  for (const q of body.match(/[“"]([^”"\n]{4,})[”"]/g) ?? []) {
    const inner = q.slice(1, -1);
    if (inner.split(/\s+/).length > 25) E(bodyFile, `quotation longer than 25 words: ${JSON.stringify(inner.slice(0, 60))}`);
  }
}

const citedAnywhere = new Set<number>(parsed.citations);
for (const f of figures) { for (const n of f.cites) citedAnywhere.add(n); for (const n of f.refs) citedAnywhere.add(n); }
const notCitedInText: number[] = []; // warned about after the catalogue is read (it may cite them)
const unresolvedCitations = [...citedAnywhere].filter((n) => !refByN.has(n)).sort((a, b) => a - b);
for (const n of unresolvedCitations) E(bodyFile, `cites [${n}] with no reference entry`);
for (const r of references) {
  if (!citedAnywhere.has(r.n)) notCitedInText.push(r.n);
  for (const s of r.cited_in) if (!sectionIds.has(s) && !figureIds.has(s)) E(`references/${r.n}`, `cited_in ${s} unknown`);
}
// APP-SPEC §6.1 rule 7 — no claim may rest on a verified: false reference.
const unverifiedButCited = references.filter((r) => !r.verified && parsed.citations.includes(r.n)).map((r) => r.n);
for (const n of unverifiedButCited) E(`references/${n}`, `cited in ${bodyFile} but verified: false — no claim may rest on an unverified reference`);
const todoWhere = new Set(todo.map((t) => t.where));
for (const r of references) if (!r.verified && !todoWhere.has(`references/${r.n}`)) W(`references/${r.n} unverified but not in todo.yaml`);

// ───────────────────────── 3. figure data + declared fields
const loaded = new Map<string, LoadedFigure>();
for (const f of figures) {
  const lf = loadFigureData(f, PACK, termIds, errors, TOPIC);
  // this pack's pathway JSON names node types `type` and edge styles `style`; the diagram reads kind/type
  if (lf.graph) {
    lf.graph = {
      ...lf.graph,
      nodes: lf.graph.nodes.map((n) => ({ ...n, kind: n.kind ?? n.type })),
      edges: lf.graph.edges.map((e) => ({ ...e, type: e.type ?? e.style })),
    };
    if (!f.data?.includes('pathway') && lf.graph.layout === 'force') lf.graph.layout = 'tree';
    for (const n of lf.graph.nodes) for (const r of n.refs) if (!refByN.has(r)) E(`figures/${f.id}`, `node ${n.id} refs [${r}] has no reference entry`);
    for (const e of lf.graph.edges) for (const r of e.refs) if (!refByN.has(r)) E(`figures/${f.id}`, `edge ${e.from}→${e.to} refs [${r}] has no reference entry`);
  }
  loaded.set(f.id, lf);
  for (const ex of f.explain) {
    if (ex.term && !termIds.has(ex.term)) E(`figures/${f.id}`, `explain term ${ex.term} unknown`);
    if (ex.concept && !conceptIds.has(ex.concept)) E(`figures/${f.id}`, `explain concept ${ex.concept} unknown`);
  }
  for (const h of f.hotspots) if (h.term && !termIds.has(h.term)) E(`figures/${f.id}`, `hotspot term ${h.term} unknown`);
  for (const c of f.concepts) if (!conceptIds.has(c)) E(`figures/${f.id}`, `concept ${c} unknown`);
  for (const s of f.discussed_in) if (!sectionIds.has(s)) E(`figures/${f.id}`, `discussed_in section ${s} unknown`);
  for (const n of f.refs) if (!refByN.has(n)) E(`figures/${f.id}`, `refs -> [${n}] has no reference entry`);
}
for (const c of concepts) for (const fg of c.figures) if (!figureIds.has(fg)) E(`concepts/${c.id}`, `unknown figure ${fg}`);

// ───────────────────────── 4. the catalogue (KICKOFF §3.3–§3.7, §4b–§4d)
const CAT = manifest?.catalogue;
const catFile = (k: 'file' | 'taxa_file' | 'plantings_file' | 'preparations_file' | 'taxa_evidence_file', fallback: string) => CAT?.[k] ?? fallback;

// forbidden-key scan over every YAML file in the pack (KICKOFF §4d) — must be 0
const forbiddenHits: string[] = [];
for (const f of fs.readdirSync(PACK).filter((x) => /\.ya?ml$/.test(x)).sort()) {
  let doc: unknown;
  try { doc = yaml.load(fs.readFileSync(path.join(PACK, f), 'utf8')); } catch { continue; }
  for (const hit of scanForbiddenKeys(doc, undefined, f)) forbiddenHits.push(hit);
}
for (const h of forbiddenHits) E('forbidden-key', `${h} — the pack may not carry dose, dosage, indication, serving or frequency keys`);

/** Link terms then citations in one prose field; records the terms and [n] found. */
function linkProse(text: string | null | undefined, seen: Set<string>, cites: Set<number>): string | null {
  if (!text) return null;
  const t = linkTerms(text, matcher, { seen }).text;
  const c = linkCitations(t);
  for (const n of c.cites) cites.add(n);
  return c.text;
}
const checkRefs = (where: string, ns: number[]) => { for (const n of ns) if (!refByN.has(n)) E(where, `[${n}] has no reference entry`); };

// taxa.yaml
const taxaParsed = TaxaFileSchema.safeParse(readYaml(catFile('taxa_file', 'taxa.yaml')));
if (!taxaParsed.success) errors.push(...zodErrors('taxa', taxaParsed.error));
const packTaxa: PackTaxon[] = taxaParsed.success ? taxaParsed.data.taxa : [];
const taxaMeta = taxaParsed.success ? taxaParsed.data.meta : null;
const taxonById = new Map(packTaxa.map((t) => [t.id, t]));
for (const [i, t] of packTaxa.entries()) if (packTaxa.findIndex((u) => u.id === t.id) !== i) E(`taxa/${t.id}`, 'duplicate id');
const candidateOf = new Map<string, string>();
for (const t of packTaxa) for (const c of t.candidates ?? []) {
  if (!taxonById.has(c)) E(`taxa/${t.id}`, `candidate ${c} is not a taxon record`);
  if (c !== t.id) candidateOf.set(c, t.id);
}
for (const t of packTaxa) if (!t.cultivars.length && !candidateOf.has(t.id)) E(`taxa/${t.id}`, 'no cultivars and not a candidate of an unresolved entry — why does this record exist?');
if (taxaMeta?.counts.taxa !== undefined && taxaMeta.counts.taxa !== packTaxa.length) E('taxa/meta', `meta.counts.taxa ${taxaMeta.counts.taxa} but ${packTaxa.length} records`);

// plantings.csv
const plantings: Planting[] = [];
{
  const f = catFile('plantings_file', 'plantings.csv');
  const p = path.join(PACK, f);
  if (!fs.existsSync(p)) E(f, 'missing file');
  else {
    const csv = parseCsvRaw(fs.readFileSync(p, 'utf8'));
    for (const e of csv.errors) E(f, e);
    const missing = PLANTING_COLUMNS.filter((c) => !csv.fields.includes(c));
    const extra = csv.fields.filter((c) => !(PLANTING_COLUMNS as readonly string[]).includes(c));
    if (missing.length) E(f, `missing columns ${missing.join(', ')}`);
    if (extra.length) E(f, `unknown columns ${extra.join(', ')}`);
    for (const [i, row] of csv.rows.entries()) {
      const parsed = PlantingSchema.safeParse(row);
      if (!parsed.success) { errors.push(...zodErrors(`plantings/${row.id ?? `row ${i + 2}`}`, parsed.error)); continue; }
      const pl = parsed.data;
      if (!taxonById.has(pl.taxon_id)) E(`plantings/${pl.id}`, `taxon_id ${pl.taxon_id} is not in taxa.yaml`);
      if (plantings.some((q) => q.id === pl.id)) E(`plantings/${pl.id}`, 'duplicate planting id');
      plantings.push(pl);
    }
  }
}
// every cultivar in taxa.yaml is a planting and vice versa
const plantingById = new Map(plantings.map((p) => [p.id, p]));
for (const t of packTaxa) for (const cv of t.cultivars) {
  const pl = plantingById.get(cv.crop_id);
  if (!pl) E(`taxa/${t.id}`, `cultivar ${cv.crop_id} has no row in plantings.csv`);
  else if (pl.taxon_id !== t.id) E(`taxa/${t.id}`, `cultivar ${cv.crop_id} is planted as ${pl.taxon_id} in plantings.csv`);
}
for (const pl of plantings) if (!packTaxa.some((t) => t.cultivars.some((c) => c.crop_id === pl.id))) W(`plantings/${pl.id}: not listed as a cultivar of ${pl.taxon_id} in taxa.yaml`);

// compounds.yaml
let packCompounds: PackCompound[] = [];
if (CAT?.enabled) {
  const compoundsParsed = CompoundsSchema.safeParse(readYaml(CAT.file) ?? []);
  if (!compoundsParsed.success) errors.push(...zodErrors('compounds', compoundsParsed.error));
  packCompounds = compoundsParsed.success ? compoundsParsed.data : [];
  if (CAT.count !== packCompounds.length) E('compounds', `manifest.catalogue.count is ${CAT.count} but ${CAT.file} holds ${packCompounds.length} records`);
}
const compoundIds = new Set(packCompounds.map((c) => c.id));

// preparations.yaml — closed schema: unknown keys are errors before anything else
let preparationsPack: Preparation[] = [];
{
  const f = catFile('preparations_file', 'preparations.yaml');
  const raw = readYaml(f);
  if (Array.isArray(raw)) for (const [i, r] of raw.entries()) {
    if (r && typeof r === 'object') for (const k of Object.keys(r)) {
      if (!(PREPARATION_KEYS as readonly string[]).includes(k)) E(`preparations/${(r as { id?: string }).id ?? i}`, `key "${k}" is not allowed — preparations.yaml has a closed schema (${PREPARATION_KEYS.join(', ')})`);
    }
  }
  const parsed = PreparationsSchema.safeParse(raw ?? []);
  if (!parsed.success) errors.push(...zodErrors('preparations', parsed.error));
  else preparationsPack = parsed.data;
}

// taxa_safety_evidence.yaml
let taxaSafety: TaxonSafety[] = [];
{
  const parsed = TaxaSafetySchema.safeParse(readYaml(catFile('taxa_evidence_file', 'taxa_safety_evidence.yaml')) ?? []);
  if (!parsed.success) errors.push(...zodErrors('taxa_safety_evidence', parsed.error));
  else taxaSafety = parsed.data;
}

for (const s of taxaSafety) {
  const where = `taxa_safety_evidence/${s.taxon_id}`;
  if (!taxonById.has(s.taxon_id)) E(where, `taxon_id ${s.taxon_id} is not in taxa.yaml`);
  else if (!taxonById.get(s.taxon_id)!.profiled) E(where, 'safety/evidence block for an unprofiled taxon');
  for (const c of s.safety.constituents_of_concern) if (!compoundIds.has(c.compound_id)) E(where, `constituent of concern ${c.compound_id} is not a compound record`);
}

// structures (scripts/build-data.py output) — read, never recomputed here
interface StructureRecord { id: string; structure: Record<string, unknown> | null; error?: string }
interface StructureSummary {
  generator: string; rdkitVersion: string; compounds: number; structures: number; noSingleStructure: string[];
  formulaMismatches: string[]; inchikeyMismatches: string[]; otherErrors: string[]; rdkitConformers: string[];
  pubchemConformers: string[]; mwDifferences: { id: string; pack: number; rdkit: number; mw_source: string | null }[];
  warnings: string[]; functionalGroups: { id: string; name: string }[]; descriptorHelp: Record<string, string>;
}
let structureSummary: StructureSummary | null = null;
let structureRecords: Record<string, StructureRecord> = {};
{
  const p = path.join(ROOT, 'public/structures/summary.json');
  if (!fs.existsSync(p)) E('structures', 'public/structures/summary.json missing — run `.venv/bin/python scripts/build-data.py`');
  else {
    const j = JSON.parse(fs.readFileSync(p, 'utf8')) as { summary: StructureSummary; records: Record<string, StructureRecord> };
    structureSummary = j.summary; structureRecords = j.records;
    for (const m of [...j.summary.formulaMismatches, ...j.summary.inchikeyMismatches, ...j.summary.otherErrors]) E('structures', m);
    for (const c of packCompounds) {
      const rec = structureRecords[c.id];
      if (!rec) E(`compounds/${c.id}`, 'no structure-build record — re-run scripts/build-data.py');
      else if (!!rec.structure !== !!c.identity.smiles) E(`compounds/${c.id}`, 'structure build is stale for this record (SMILES presence changed)');
      else if (rec.structure && (rec.structure as { inchikeyComputed?: string }).inchikeyComputed !== c.identity.inchikey) E(`compounds/${c.id}`, 'structure build is stale (InChIKey differs) — re-run scripts/build-data.py');
    }
  }
}

// compound records: cross-checks, linking, flattening
const DOI_RE = /10\.\d{4,9}\/[^\s,;)"']+/g;
const refByDoi = new Map<string, number>();
for (const r of references) if (r.doi) refByDoi.set(r.doi.toLowerCase().replace(/[.,;)]+$/, ''), r.n);
// a reference's URL identifies it too (EMA documents, LiverTox pages have no DOI)
const normUrl = (u: string) => u.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/[/.,;)]+$/, '');
const refByUrl = new Map<string, number>();
for (const r of references) if (r.url) refByUrl.set(normUrl(r.url), r.n);
const refsFromText = (text: string | null | undefined): number[] => {
  const out = new Set<number>();
  for (const u of (text ?? '').match(/https?:\/\/[^\s,;"')]+/g) ?? []) { const n = refByUrl.get(normUrl(u)); if (n !== undefined) out.add(n); }
  for (const d of (text ?? '').match(DOI_RE) ?? []) {
    const n = refByDoi.get(d.toLowerCase().replace(/[.,;)]+$/, ''));
    if (n !== undefined) out.add(n);
  }
  return [...out];
};

const compoundTerms = new Map<string, string[]>(); // term id → compound ids (and prep / taxon ids, prefixed)
const addTermUse = (seen: Set<string>, key: string) => { for (const t of seen) { if (!compoundTerms.has(t)) compoundTerms.set(t, []); compoundTerms.get(t)!.push(key); } };

interface OccurrenceRowOut {
  row: string; compound_id: string; compound: string; class: string; palette_group: string; auxiliary: boolean;
  taxon_id: string; taxon_known: boolean; taxon_name: string | null; family: string | null;
  plant_part: string | null; value: number | string | null; unit: string | null; basis: string; level: string; cultivar: string | null;
  source_citation: string; source_doi_or_url: string | null; database: string | null; database_url: string | null;
  verified: boolean; note: string | null; refs: number[];
}
const occurrenceRows: OccurrenceRowOut[] = [];
const compoundsOut: Record<string, unknown>[] = [];
const prose = (c: PackCompound, cites: Set<number>, seen: Set<string>) => ({
  one_liner: linkProse(c.one_liner, seen, cites) ?? '',
  mechanism: linkProse(c.pharmacology.mechanism, seen, cites),
  primary_targets: linkProse(c.pharmacology.primary_targets, seen, cites),
  functional_notes: linkProse(c.pharmacology.functional_notes, seen, cites),
  absorption_bioavailability: linkProse(c.absorption_bioavailability, seen, cites),
  teaching_note: linkProse(c.teaching_note, seen, cites),
  processing_note: linkProse(c.processing_stability.note, seen, cites),
  biosynthesis_note: linkProse(c.biosynthesis.note, seen, cites),
  evidence: c.evidence.map((e) => ({ claim: linkProse(e.claim, seen, cites) ?? '', outcome_summary: linkProse(e.outcome_summary, seen, cites) ?? '' })),
  safety_flags: c.safety_flags.map((f) => linkProse(f.detail, seen, cites)),
});

const paletteGroups = new Set(Object.keys(manifest?.palette.groups ?? {}));
for (const c of packCompounds) {
  const where = `compounds/${c.id}`;
  if (packCompounds.findIndex((u) => u.id === c.id) !== packCompounds.indexOf(c)) E(where, 'duplicate id');
  if (!paletteGroups.has(c.palette_group)) E(where, `palette_group ${c.palette_group} is not in manifest.palette.groups`);
  checkRefs(where, c.citations);
  for (const e of c.evidence) checkRefs(`${where}/evidence`, e.refs);
  for (const s of c.safety_flags) checkRefs(`${where}/safety_flags`, s.refs);
  checkRefs(`${where}/processing_stability`, c.processing_stability.refs);
  if (!c.identity.smiles && c.id !== 'cis-spiroether') W(`${where}: no SMILES — rendered as "No single structure"`);
  for (const [i, o] of c.occurrences.entries()) {
    const t = taxonById.get(o.taxon_id);
    if (!t) E(`${where}/occurrences/${i}`, `taxon_id ${o.taxon_id} is not in taxa.yaml`);
    if (!o.verified) W(`${where}: occurrence in ${o.taxon_id} is verified: false (rendered with an amber marker)`);
  }
  const seen = new Set<string>();
  const cites = new Set<number>(c.citations);
  const md = prose(c, cites, seen);
  addTermUse(seen, c.id);
  for (const n of cites) if (!refByN.has(n)) E(where, `prose cites [${n}] with no reference entry`);
  const rec = structureRecords[c.id];
  const occRefs = c.occurrences.map((o) => refsFromText(`${o.source_doi_or_url ?? ''} ${o.source_citation}`));
  c.occurrences.forEach((o, i) => {
    const t = taxonById.get(o.taxon_id);
    occurrenceRows.push({
      row: `${c.id}#${i}`, compound_id: c.id, compound: c.name, class: c.class, palette_group: c.palette_group, auxiliary: c.auxiliary,
      taxon_id: o.taxon_id, taxon_known: !!t, taxon_name: t?.accepted_name ?? null, family: t?.family ?? null,
      plant_part: o.plant_part, value: o.value, unit: o.unit, basis: o.basis, level: o.level, cultivar: o.cultivar,
      source_citation: o.source_citation, source_doi_or_url: o.source_doi_or_url, database: o.database, database_url: o.database_url ?? null,
      verified: o.verified, note: o.note, refs: occRefs[i],
    });
  });
  const humanEvidence = c.evidence.some((e) => ['A', 'B', 'C'].includes(e.grade));
  compoundsOut.push({
    ...c,
    md,
    terms: [...seen],
    cited_refs: [...new Set([...cites, ...occRefs.flat()])].sort((a, b) => a - b),
    taxa: [...new Set(c.occurrences.map((o) => o.taxon_id))],
    has_human_evidence: humanEvidence,
    structure: rec?.structure ?? null,
  });
}
compoundsOut.sort((a, b) => String(a.name).localeCompare(String(b.name)));

// preparations: cross-links and prose
const preparationsOut = preparationsPack.map((p) => {
  const where = `preparations/${p.id}`;
  for (const t of p.plants) if (!taxonById.has(t)) E(where, `plant ${t} is not in taxa.yaml`);
  for (const k of ['what_it_extracts', 'what_it_leaves_behind'] as const) for (const id of p[k]) if (!compoundIds.has(id)) E(where, `${k}: ${id} is not a compound record`);
  for (const f of p.formed_or_lost) if (!compoundIds.has(f.compound_id)) E(where, `formed_or_lost: ${f.compound_id} is not a compound record`);
  for (const c of p.safety_block.constituents_of_concern) { if (!compoundIds.has(c.compound_id)) E(where, `safety_block constituent ${c.compound_id} is not a compound record`); checkRefs(`${where}/safety_block`, c.refs); }
  checkRefs(where, p.refs); checkRefs(`${where}/safety_block`, p.safety_block.refs);
  const seen = new Set<string>(); const cites = new Set<number>(p.refs);
  const out = {
    ...p,
    md: {
      method_as_chemistry: linkProse(p.method_as_chemistry, seen, cites) ?? '',
      safety_summary: linkProse(p.safety_block.summary, seen, cites) ?? '',
      constituents_of_concern: p.safety_block.constituents_of_concern.map((c) => { c.refs.forEach((n) => cites.add(n)); return linkProse(c.concern, seen, cites) ?? ''; }),
      formed_or_lost: p.formed_or_lost.map((f) => ({ change: linkProse(f.change, seen, cites) ?? '', why: linkProse(f.why, seen, cites) ?? '' })),
    },
    terms: [...seen],
    cited_refs: [...cites].sort((a, b) => a - b),
  };
  for (const n of cites) if (!refByN.has(n)) E(where, `prose cites [${n}] with no reference entry`);
  addTermUse(seen, `prep:${p.id}`);
  return out;
});

// taxa safety/evidence: prose linking
const safetyOut = new Map<string, unknown>();
for (const s of taxaSafety) {
  const where = `taxa_safety_evidence/${s.taxon_id}`;
  const seen = new Set<string>(); const cites = new Set<number>(s.refs);
  const st = (x: { statement: string | null; refs: number[] }) => { checkRefs(where, x.refs); x.refs.forEach((n) => cites.add(n)); return { ...x, md: linkProse(x.statement, seen, cites) }; };
  const out = {
    ...s,
    safety: {
      drug_interactions: s.safety.drug_interactions.map((d) => { checkRefs(where, d.refs); d.refs.forEach((n) => cites.add(n)); return { ...d, md: linkProse(d.effect, seen, cites) }; }),
      pregnancy_lactation: st(s.safety.pregnancy_lactation),
      allergy: st(s.safety.allergy),
      adverse_event_history: st(s.safety.adverse_event_history),
      contraindications: s.safety.contraindications.map((d) => ({ statement: d, md: linkProse(d, seen, cites) })),
      constituents_of_concern: s.safety.constituents_of_concern.map((cc) => { checkRefs(where, cc.refs); cc.refs.forEach((n) => cites.add(n)); return { ...cc, md: linkProse(cc.concern, seen, cites) }; }),
    },
    evidence: s.evidence.map((e) => { checkRefs(`${where}/evidence`, e.refs); return { ...e, md: { claim: linkProse(e.claim, seen, cites) ?? '', outcome_summary: linkProse(e.outcome_summary, seen, cites) ?? '' } }; }),
    terms: [...seen],
    cited_refs: [...cites].sort((a, b) => a - b),
  };
  for (const n of cites) if (!refByN.has(n)) E(where, `prose cites [${n}] with no reference entry`);
  addTermUse(seen, `taxon:${s.taxon_id}`);
  safetyOut.set(s.taxon_id, out);
}

// reference ↔ catalogue cross-check (references.yaml cited_in_catalogue)
for (const r of references) for (const k of r.cited_in_catalogue) {
  const [kind, id] = k.split(':');
  const ok = kind === 'compounds' ? compoundIds.has(id) : kind === 'taxa' ? taxonById.has(id) : preparationsPack.some((p) => p.id === id);
  if (!ok) E(`references/${r.n}`, `cited_in_catalogue ${k} does not resolve`);
}
// figure nodes that name a compound must resolve
for (const [fid, lf] of loaded) for (const n of lf.graph?.nodes ?? []) if (n.compound_id && !compoundIds.has(n.compound_id)) E(`figures/${fid}`, `node ${n.id} compound_id ${n.compound_id} is not a compound record`);

// "In the primer": sections whose text names a taxon (accepted name, genus-abbreviated name or a common name) or a compound
const sectionPlain = new Map(parsed.sections.map((s) => [s.id, s.chunks.filter((c) => c.kind === 'md').map((c) => (c as { md: string }).md).join(' ').replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')]));
const wordRe = (w: string) => new RegExp(`(^|[^\\p{L}])${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+')}(?=$|[^\\p{L}])`, 'iu');
function sectionsNaming(names: string[]): string[] {
  const res = names.filter((n) => n && n.length >= 4).map(wordRe);
  return parsed.sections.filter((s) => res.some((re) => re.test(sectionPlain.get(s.id) ?? ''))).map((s) => s.id);
}
const genusAbbrev = (n: string) => { const [g, sp] = n.replace(/×\s*/, '× ').split(/\s+/); return sp ? `${g[0]}. ${n.slice(g.length + 1)}` : n; };
// a common name and its head noun ("Common sage" → "sage"), so the primer's plain "sage" is found
const commonNamesOf = (t: PackTaxon) => t.common_names.flatMap((c) => { const bare = c.replace(/\s*\(.*\)\s*/, ''); return [c, bare, bare.split(/\s+/).pop() ?? bare]; });

// per-taxon page models
const plantingsByTaxon = new Map<string, Planting[]>();
for (const p of plantings) { if (!plantingsByTaxon.has(p.taxon_id)) plantingsByTaxon.set(p.taxon_id, []); plantingsByTaxon.get(p.taxon_id)!.push(p); }
const todoFor = (prefixes: string[]) => todo.filter((t) => prefixes.some((p) => t.where === p || t.where.startsWith(`${p}/`)));
const taxaOut = packTaxa.map((t) => {
  const pls = plantingsByTaxon.get(t.id) ?? [];
  const rows = occurrenceRows.filter((r) => r.taxon_id === t.id);
  const compoundsHere = [...new Set(rows.map((r) => r.compound_id))];
  const preps = preparationsPack.filter((p) => p.plants.includes(t.id)).map((p) => p.id);
  const names = [t.accepted_name, genusAbbrev(t.accepted_name), ...(t.profiled ? commonNamesOf(t) : [])];
  return {
    ...t,
    plantings: pls.map((p) => p.id),
    n_plantings: pls.length,
    statuses: [...new Set(pls.map((p) => p.status))],
    candidate_of: candidateOf.get(t.id) ?? null,
    compounds: compoundsHere,
    occurrence_rows: rows.map((r) => r.row),
    safety_evidence: safetyOut.get(t.id) ?? null,
    preparations: preps,
    primer_sections: sectionsNaming(names),
    todo: todoFor([`taxa/${t.id}`, `taxa_safety_evidence/${t.id}`]),
  };
});
const taxaOutById = new Map(taxaOut.map((t) => [t.id, t]));

// the two candidate models for the unresolved entry (feature: /plants/scutellaria-sp)
for (const t of taxaOut) if (t.identity_status === 'unresolved') {
  for (const c of t.candidates ?? []) if (!taxaOutById.get(c)?.profiled) W(`taxa/${t.id}: candidate ${c} is not profiled`);
}

// per-family index
const familySlug = (f: string) => f.toLowerCase();
const familiesOut = [...new Set(packTaxa.map((t) => t.family))].sort().map((fam) => {
  const members = taxaOut.filter((t) => t.family === fam);
  const rows = occurrenceRows.filter((r) => r.family === fam);
  const byCompound = new Map<string, Set<string>>();
  for (const r of rows) { if (!byCompound.has(r.compound_id)) byCompound.set(r.compound_id, new Set()); byCompound.get(r.compound_id)!.add(r.taxon_id); }
  return {
    id: familySlug(fam),
    family: fam,
    colour: manifest?.palette.groups[familySlug(fam)] ?? null,
    taxa: members.map((t) => t.id),
    profiled: members.filter((t) => t.profiled).map((t) => t.id),
    plantings: members.reduce((a, t) => a + t.n_plantings, 0),
    compounds: [...byCompound.keys()].sort(),
    shared_compounds: [...byCompound.entries()].filter(([, s]) => s.size >= 2).map(([id, s]) => ({ id, taxa: [...s].sort() })),
    // family names as the primer writes them: "Lamiaceae", and the vernacular "mint family" / "daisy family" where used
    primer_sections: sectionsNaming([fam, ...({ Lamiaceae: ['mint family'], Asteraceae: ['daisy family'], Apiaceae: ['carrot family'], Brassicaceae: ['cabbage family', 'mustard family'] } as Record<string, string[]>)[fam] ?? []]),
  };
});

// compounds: primer sections
// a compound is "in the primer" where its name (without stereo prefix or parenthetical) or its glossary term appears
const stripName = (n: string) => n.replace(/\s*\(.*\)$/, '').replace(/^\([+\-−RS,]+\)-/, '');
for (const c of compoundsOut) {
  const byName = sectionsNaming([stripName(String(c.name)), ...((c.synonyms as string[]) ?? []).filter((s) => !/\d,\d/.test(s))]);
  const byTerm = parsed.sections.filter((s) => s.terms.includes(String(c.id))).map((s) => s.id);
  (c as { primer_sections?: string[] }).primer_sections = parsed.sections.map((s) => s.id).filter((id) => byName.includes(id) || byTerm.includes(id));
}

// tours (authored in src/tours/*.json from pack content; validated here so a tour cannot outlive its sources)
interface TourStep { title: string; route: string; text: string; refs?: number[]; source: string }
interface TourDef { id: string; title: string; subtitle: string; minutes: number; steps: TourStep[]; quiz_from: string }
const tours: TourDef[] = [];
{
  const dir = path.join(ROOT, 'src/tours');  // tours are app content, read from the real tree even under BX_PACK_DIR
  for (const f of fs.existsSync(dir) ? fs.readdirSync(dir).filter((x) => x.endsWith('.json')).sort() : []) {
    const t = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')) as TourDef;
    const where = `tours/${t.id}`;
    if (!conceptIds.has(t.quiz_from)) E(where, `quiz_from ${t.quiz_from} is not a concept`);
    for (const [i, s] of t.steps.entries()) {
      if (!s.source) E(`${where}/steps/${i}`, 'every tour step names the pack field it paraphrases (source)');
      const cites = [...s.text.matchAll(/\[(\d+(?:\s*[,–-]\s*\d+)*)\]/g)].flatMap((m) => m[1].split(',').map((x) => Number(x.trim())));
      for (const n of cites) if (!refByN.has(n)) E(`${where}/steps/${i}`, `[${n}] has no reference entry`);
      const [pathname, qs] = s.route.split('#')[0].split('?');
      const seg = pathname.split('/').filter(Boolean);
      if (seg[0] === 'compounds' && seg[1] && !compoundIds.has(seg[1])) E(`${where}/steps/${i}`, `route ${s.route}: unknown compound`);
      if (seg[0] === 'plants' && seg[1] && !taxonById.has(seg[1])) E(`${where}/steps/${i}`, `route ${s.route}: unknown taxon`);
      if (seg[0] === 'figures' && seg[1] && !figureIds.has(seg[1])) E(`${where}/steps/${i}`, `route ${s.route}: unknown figure`);
      const q = new URLSearchParams(qs ?? '');
      for (const id of (q.get('ids') ?? '').split(',').filter(Boolean)) if (!compoundIds.has(id)) E(`${where}/steps/${i}`, `route ${s.route}: unknown compound ${id}`);
      for (const id of (q.get('plants') ?? '').split(',').filter(Boolean)) if (!taxonById.has(id)) E(`${where}/steps/${i}`, `route ${s.route}: unknown taxon ${id}`);
    }
    tours.push(t);
  }
}

{
  const catalogueCites = new Set<number>([
    ...compoundsOut.flatMap((c) => c.cited_refs as number[]),
    ...preparationsOut.flatMap((p) => p.cited_refs),
    ...[...safetyOut.values()].flatMap((s) => (s as { cited_refs: number[] }).cited_refs),
  ]);
  for (const n of notCitedInText) if (!catalogueCites.has(n)) W(`reference ${n} is cited nowhere — not in the review, a figure or any catalogue record`);
}

// ───────────────────────── cross-links used by the app (reachability)
const appearsIn = new Map<string, string[]>();
for (const s of parsed.sections) for (const t of s.terms) { if (!appearsIn.has(t)) appearsIn.set(t, []); appearsIn.get(t)!.push(s.id); }
const termFigures = new Map<string, Set<string>>();
const addTF = (t: string | null | undefined, fid: string) => { if (!t) return; if (!termFigures.has(t)) termFigures.set(t, new Set()); termFigures.get(t)!.add(fid); };
for (const f of figures) {
  for (const ex of f.explain) addTF(ex.term, f.id);
  for (const h of f.hotspots) addTF(h.term, f.id);
  for (const n of loaded.get(f.id)?.graph?.nodes ?? []) addTF(n.term, f.id);
}
const termConcepts = new Map<string, Set<string>>();
for (const c of concepts) for (const t of c.terms) { if (!termConcepts.has(t)) termConcepts.set(t, new Set()); termConcepts.get(t)!.add(c.id); }
for (const c of concepts) {
  c.used_by_terms = glossary.filter((t) => t.concept === c.id).map((t) => t.id);
  c.used_by_figures = figures.filter((f) => f.concepts.includes(c.id) || f.explain.some((e) => e.concept === c.id)).map((f) => f.id);
  c.used_by_concepts = concepts.filter((o) => o.prerequisites.includes(c.id)).map((o) => o.id);
}
const refSections = new Map<number, string[]>();
for (const s of parsed.sections) for (const n of s.cites) { if (!refSections.has(n)) refSections.set(n, []); refSections.get(n)!.push(s.id); }
for (const f of figures) for (const n of [...f.cites, ...f.refs]) { if (!refSections.has(n)) refSections.set(n, []); if (!refSections.get(n)!.includes(f.id)) refSections.get(n)!.push(f.id); }
const refCompounds = new Map<number, string[]>();
for (const c of compoundsOut) for (const n of c.cited_refs as number[]) { if (!refCompounds.has(n)) refCompounds.set(n, []); refCompounds.get(n)!.push(String(c.id)); }

// ───────────────────────── 5. emit
const stamp = new Date().toISOString().slice(0, 10);
// the front door's featured plant and compound (KICKOFF §4): chosen from the deep profiles — sage and baicalin,
// falling back to the first deep profile / its best-evidenced compound if either ever stops being deep
const deep = taxaOut.filter((t) => t.profile_depth === 'deep' && t.identity_status === 'confirmed');
const featuredPlant = deep.find((t) => t.id === 'salvia-officinalis')?.id ?? deep[0]?.id ?? null;
const deepCompounds = new Set(deep.flatMap((t) => t.compounds));
const featuredCompound = deepCompounds.has('baicalin') ? 'baicalin' : [...deepCompounds].sort((a, b) => (packCompounds.find((c) => c.id === b)?.evidence.length ?? 0) - (packCompounds.find((c) => c.id === a)?.evidence.length ?? 0))[0] ?? null;
if (manifest) emitJson('src/data/manifest.json', { ...manifest, sections: parsed.sections.length, words: parsed.sections.reduce((a, s) => a + s.words, 0), featured: { plant: featuredPlant, compound: featuredCompound } });
emitJson('src/data/sections.json', parsed.sections);
emitJson('src/data/sections-index.json', parsed.sections.map((s) => ({ id: s.id, title: s.title, depth: s.depth, number: s.number, words: s.words, figures: s.figures, synthesis_blocks: s.synthesis_blocks })));
emitJson('src/data/glossary.json', glossary.map((t) => ({
  ...t,
  appears_in: appearsIn.get(t.id) ?? [],
  occurrences: parsed.occurrences[t.id] ?? 0,
  figures: [...(termFigures.get(t.id) ?? [])],
  concepts: [...(termConcepts.get(t.id) ?? [])],
  compounds: (compoundTerms.get(t.id) ?? []).filter((k) => !k.includes(':')),
  records: compoundTerms.get(t.id) ?? [],
})));
emitJson('src/data/glossary-short.json', glossary.map((t) => ({
  id: t.id, term: t.term, kind: t.kind, short: t.short,
  concept: t.concept ?? [...(termConcepts.get(t.id) ?? [])][0] ?? null,
})));
emitJson('src/data/concepts.json', concepts);
emitJson('src/data/concepts-index.json', concepts.map((c) => ({ id: c.id, title: c.title, one_liner: c.one_liner, prerequisites: c.prerequisites, figures: c.figures, terms: c.terms, self_check: c.self_check })));

const figuresOut = figures.map((f) => {
  const d = loaded.get(f.id);
  const imageUrl = (rel?: string) => (rel ? `figures/${path.basename(rel)}` : undefined);
  const seen = new Set<string>(); const cites = new Set<number>();
  return {
    ...f,
    image: imageUrl(f.image),
    panels: f.panels?.map((p) => ({ ...p, image: imageUrl(p.image)! })),
    table: d?.table,
    graph: d?.graph,
    chart_rows: d?.chartRows,
    caption_md: linkProse(f.caption, seen, cites),
    how_to_read_md: linkProse(f.how_to_read, seen, cites),
    provenance: f.kind === 'image' ? 'original image' : f.synthesis === 'conceptual' ? 'synthesised: conceptual diagram' : 'synthesised from cited data',
  };
});
emitJson('src/data/figures.json', figuresOut);
emitJson('src/data/figures-index.json', figuresOut.map((f) => ({
  id: f.id, label: f.label, title: f.title, kind: f.kind, synthesis: f.synthesis ?? null, image: f.image ?? null,
  provenance: f.provenance, concepts: f.concepts, refs: f.refs, rows: f.table?.rows.length ?? null,
  fields: f.table?.fields.length ?? null, has_chart: !!f.chart,
})));
emitJson('src/data/references.json', references.map((r) => ({ ...r, cited_sections: refSections.get(r.n) ?? [], cited_compounds: refCompounds.get(r.n) ?? [] })));
emitJson('src/data/todo.json', todo);
emitJson('src/data/synthesis.json', parsed.synthesis);
if (scope) emitJson('src/data/scope.json', scope);
// the grade legend is needed one click from every evidence table, so it rides in a tiny file of its own
emitJson('src/data/grades.json', scope ? { rule: scope.evidence_grades.rule, grades: scope.evidence_grades.grades, example: scope.evidence_grades.example } : null);

// catalogue
emitJson('src/data/compounds.json', compoundsOut);
emitJson('src/data/compounds-index.json', compoundsOut.map((c) => {
  const x = c as unknown as PackCompound & { taxa: string[]; has_human_evidence: boolean; structure: Record<string, unknown> | null; md: { one_liner: string } };
  const rows = occurrenceRows.filter((r) => r.compound_id === x.id);
  return {
    id: x.id, name: x.name, class: x.class, subclass: x.subclass, palette_group: x.palette_group, auxiliary: x.auxiliary,
    one_liner: x.one_liner, synonyms: x.synonyms, formula: x.identity.formula, inchikey: x.identity.inchikey, mw: x.identity.mw,
    taxa: x.taxa, parts: [...new Set(rows.map((r) => r.plant_part).filter(Boolean))], bases: [...new Set(rows.map((r) => r.basis))],
    has_human_evidence: x.has_human_evidence, evidence: x.evidence.length, safety_flags: x.safety_flags.length,
    grades: [...new Set(x.evidence.map((e) => e.grade))].sort(),
    has_structure: !!x.structure, svg: (x.structure?.svg as { light: string; dark: string } | undefined) ?? null,
    formed_during: x.processing_stability.formed_during,
  };
}));
emitJson('src/data/occurrence-rows.json', occurrenceRows);
emitJson('src/data/taxa.json', taxaOut);
emitJson('src/data/taxa-index.json', taxaOut.map((t) => ({
  id: t.id, accepted_name: t.accepted_name, authority: t.authority, family: t.family, common_names: t.common_names, columns: t.columns,
  identity_status: t.identity_status, profiled: t.profiled, profile_depth: t.profile_depth, n_plantings: t.n_plantings,
  compounds: t.compounds, candidates: t.candidates ?? [], candidate_of: t.candidate_of, preparations: t.preparations,
  has_safety: !!t.safety_evidence, statuses: t.statuses,
})));
// each planting carries the identity status taxa.yaml gives its cultivar (the crop-list confidence, cleaned)
const cvStatus = new Map(packTaxa.flatMap((t) => t.cultivars.map((c) => [c.crop_id, c.identity_status] as const)));
emitJson('src/data/plantings.json', { inventory_date: '2025-10-25', rows: plantings.map((p) => ({ ...p, identity_status: cvStatus.get(p.id) ?? null })) });
emitJson('src/data/families.json', familiesOut);
emitJson('src/data/preparations.json', preparationsOut);
emitJson('src/data/tours.json', tours);
// per-record files, so /compounds/:id and /plants/:id load one small file instead of the whole catalogue
{
  const prepName = (id: string) => ({ id, name: preparationsPack.find((p) => p.id === id)?.name ?? id });
  const dir = path.join(OUT, 'src/data/records');
  const keep = new Set<string>();
  for (const c of compoundsOut) {
    const id = String(c.id);
    const preps = preparationsPack.filter((p) => p.what_it_extracts.includes(id) || p.what_it_leaves_behind.includes(id) || p.formed_or_lost.some((x) => x.compound_id === id) || p.safety_block.constituents_of_concern.some((x) => x.compound_id === id)).map((p) => prepName(p.id));
    const rel = `src/data/records/compounds/${id}.json`; keep.add(rel);
    emitJson(rel, { compound: c, rows: occurrenceRows.filter((r) => r.compound_id === id), preparations: preps });
  }
  for (const t of taxaOut) {
    const ids = [t.id, ...(t.identity_status === 'unresolved' ? t.candidates ?? [] : [])];
    const rel = `src/data/records/taxa/${t.id}.json`; keep.add(rel);
    emitJson(rel, {
      taxa: ids.map((id) => taxaOutById.get(id)).filter(Boolean),
      rows: occurrenceRows.filter((r) => ids.includes(r.taxon_id)),
      plantings: plantings.filter((p) => ids.includes(p.taxon_id)),
      preparations: t.preparations.map(prepName),
    });
  }
  // a record that left the pack must not linger as a stale file
  for (const kind of ['compounds', 'taxa']) {
    const d = path.join(dir, kind);
    if (fs.existsSync(d)) for (const f of fs.readdirSync(d)) if (!keep.has(`src/data/records/${kind}/${f}`)) fs.unlinkSync(path.join(d, f));
  }
}
emitJson('src/data/structures.json', structureSummary ?? null);

emitJson('src/data/search.json', [
  ...glossary.map((t) => ({ kind: 'term', id: t.id, title: t.term, subtitle: t.short, to: `/glossary#${t.id}`, hay: `${t.term} ${t.variants.join(' ')} ${t.short}`.toLowerCase() })),
  ...concepts.map((c) => ({ kind: 'concept', id: c.id, title: c.title, subtitle: c.one_liner, to: `/concepts/${c.id}`, hay: `${c.title} ${c.one_liner}`.toLowerCase() })),
  ...packCompounds.map((c) => ({ kind: 'compound', id: c.id, title: c.name, subtitle: c.one_liner, to: `/compounds/${c.id}`, hay: `${c.name} ${c.synonyms.join(' ')} ${c.class} ${c.identity.formula ?? ''} ${c.identity.inchikey ?? ''}`.toLowerCase() })),
  ...taxaOut.map((t) => ({ kind: 'plant', id: t.id, title: t.accepted_name, subtitle: `${t.common_names.join(', ')} · ${t.family}${t.profiled ? '' : ' · profile in progress'}`, to: `/plants/${t.id}`, hay: `${t.accepted_name} ${t.common_names.join(' ')} ${t.synonyms.join(' ')} ${t.family} ${t.cultivars.map((c) => c.name ?? '').join(' ')}`.toLowerCase() })),
  ...preparationsPack.map((p) => ({ kind: 'preparation', id: p.id, title: p.name, subtitle: `${p.kind} · ${p.solvent}`, to: `/tea#${p.id}`, hay: `${p.name} ${p.kind} ${p.solvent} ${p.plant_part}`.toLowerCase() })),
  ...figures.map((f) => ({ kind: 'figure', id: f.id, title: `${f.label} · ${f.title}`, subtitle: f.kind, to: `/figures/${f.id}`, hay: `${f.label} ${f.title} ${f.kind}`.toLowerCase() })),
  ...parsed.sections.map((s) => ({ kind: 'section', id: s.id, title: s.title, subtitle: `Section · ${s.words} words`, to: `/read#${s.id}`, hay: `${s.title} ${s.number ?? ''}`.toLowerCase() })),
]);

// ───────────────────────── provenance
const occurring = glossary.filter((t) => (parsed.occurrences[t.id] ?? 0) > 0);
const linkedTerms = glossary.filter((t) => (appearsIn.get(t.id) ?? []).length > 0);
const onlyInCatalogue = glossary.filter((t) => (parsed.occurrences[t.id] ?? 0) === 0 && (compoundTerms.get(t.id) ?? []).length > 0).map((t) => t.id);
const unmatched = glossary.filter((t) => (parsed.occurrences[t.id] ?? 0) === 0 && !(compoundTerms.get(t.id) ?? []).length).map((t) => t.id);
const count = <T,>(xs: T[], key: (x: T) => string | null | undefined) => { const o: Record<string, number> = {}; for (const x of xs) { const k = String(key(x) ?? 'null'); o[k] = (o[k] ?? 0) + 1; } return o; };
const byKind = count(figures, (f) => f.kind);
const bySynthesis = count(figures.filter((f) => f.synthesis), (f) => f.synthesis);
const byTier = count(references.filter((r) => r.tier), (r) => r.tier);
const allEvidence: (Evidence & { where: string })[] = [
  ...packCompounds.flatMap((c) => c.evidence.map((e) => ({ ...e, where: `compounds/${c.id}` }))),
  ...taxaSafety.flatMap((s) => s.evidence.map((e) => ({ ...e, where: `taxa/${s.taxon_id}` }))),
];

const nullFields: Record<string, number> = {};
const bump = (k: string) => { nullFields[k] = (nullFields[k] ?? 0) + 1; };
for (const c of packCompounds) {
  for (const [k, v] of Object.entries(c.physchem)) if (v === null) bump(`physchem.${k}`);
  for (const [k, v] of Object.entries(c.pharmacology)) if (v === null) bump(`pharmacology.${k}`);
  if (c.absorption_bioavailability === null) bump('absorption_bioavailability');
  if (!c.evidence.length) bump('evidence (empty)');
  if (!c.safety_flags.length) bump('safety_flags (empty)');
  if (c.teaching_note === null) bump('teaching_note');
  if (c.biosynthesis.pathway === null) bump('biosynthesis.pathway');
}

const provenance = {
  slug: manifest?.slug ?? null,
  mode: manifest?.mode ?? 'manuscript',
  prototype: manifest?.prototype ?? false,
  as_of: manifest?.as_of ?? null,
  built: stamp,
  builder: manifest?.builder ?? null,
  sections: parsed.sections.length,
  words: parsed.sections.reduce((a, s) => a + s.words, 0),
  blocks: { ...parsed.blocks, uncited: parsed.uncited.length },
  synthesis_passages: parsed.synthesis.length,
  terms: {
    total: glossary.length,
    occurring: occurring.length,
    linked: linkedTerms.length,
    linked_pct_of_occurring: occurring.length ? Math.round((linkedTerms.length / occurring.length) * 1000) / 10 : 0,
    only_in_catalogue: onlyInCatalogue,
    unmatched,
    link_every_occurrence: manifest?.link_every_occurrence ?? false,
    variants: matcher.variants,
    ambiguous_variants: ambiguous,
  },
  references: {
    total: references.length,
    by_tier: byTier,
    anchors: references.filter((r) => r.anchor).map((r) => r.n),
    with_summary: references.filter((r) => r.summary.trim()).length,
    without_summary: references.filter((r) => !r.summary.trim()).map((r) => r.n),
    verified: references.filter((r) => r.verified).length,
    unverified: references.filter((r) => !r.verified).map((r) => r.n),
    unverified_but_cited: unverifiedButCited,
    cited_in_text: parsed.citations.length,
    unresolved_citations: unresolvedCitations,
  },
  figures: { total: figures.length, by_kind: byKind, by_synthesis: bySynthesis, original_image: figures.filter((f) => f.kind === 'image').length },
  concepts: concepts.length,
  catalogue: {
    compounds: packCompounds.length,
    auxiliary: packCompounds.filter((c) => c.auxiliary).map((c) => c.id),
    compounds_with_empty_evidence: packCompounds.filter((c) => !c.evidence.length).map((c) => c.id),
    compounds_with_safety_flags: packCompounds.filter((c) => c.safety_flags.length).length,
    null_fields: nullFields,
    occurrence_rows: occurrenceRows.length,
    occurrence_rows_by_basis: count(occurrenceRows, (r) => r.basis),
    occurrence_rows_by_verified: count(occurrenceRows, (r) => String(r.verified)),
    occurrence_rows_by_level: count(occurrenceRows, (r) => r.level),
    occurrence_rows_quantitative: occurrenceRows.filter((r) => (QUANT_BASES as readonly string[]).includes(r.basis)).length,
    occurrence_rows_unknown_taxon: occurrenceRows.filter((r) => !r.taxon_known).map((r) => r.row),
    evidence_rows: allEvidence.length,
    evidence_by_grade: count(allEvidence, (e) => e.grade),
    evidence_by_test_article: count(allEvidence, (e) => e.test_article),
    evidence_by_population: count(allEvidence, (e) => e.population),
    evidence_by_source: { compounds: packCompounds.reduce((a, c) => a + c.evidence.length, 0), taxa: taxaSafety.reduce((a, s) => a + s.evidence.length, 0) },
    terms_linked_in_catalogue_prose: compoundTerms.size,
  },
  taxa: {
    total: packTaxa.length,
    by_identity_status: count(packTaxa, (t) => t.identity_status),
    by_profile_depth: count(packTaxa, (t) => t.profile_depth),
    by_family: count(packTaxa, (t) => t.family),
    with_safety_block: taxaSafety.length,
  },
  plantings: {
    total: plantings.length,
    collapsed_to_taxa: new Set(plantings.map((p) => p.taxon_id)).size,
    taxon_records: packTaxa.length,
    by_status: count(plantings, (p) => p.status),
    by_confidence: count(plantings, (p) => p.confidence),
    by_list_category: count(plantings, (p) => p.list_category),
    inventory_date: '2025-10-25',
  },
  preparations: {
    total: preparationsPack.length,
    with_safety_block: preparationsPack.filter((p) => p.safety_block.summary.trim()).length,
    by_kind: count(preparationsPack, (p) => p.kind),
  },
  forbidden_key_scan: { keys: ['dose', 'dosage', 'indication', 'serving', 'frequency'], hits: forbiddenHits.length, where: forbiddenHits },
  structures: structureSummary ? {
    rdkit: structureSummary.rdkitVersion,
    structures: structureSummary.structures,
    no_single_structure: structureSummary.noSingleStructure,
    formula_mismatches: structureSummary.formulaMismatches.length,
    inchikey_mismatches: structureSummary.inchikeyMismatches.length,
    pubchem_conformers: structureSummary.pubchemConformers.length,
    rdkit_conformer_fallbacks: structureSummary.rdkitConformers,
    mw_differences: structureSummary.mwDifferences,
    warnings: structureSummary.warnings,
  } : null,
  tours: tours.map((t) => ({ id: t.id, steps: t.steps.length, quiz_from: t.quiz_from })),
  scope: scope ? {
    queries: scope.search_strategy.queries.length,
    queries_with_hits_logged: scope.search_strategy.queries.filter((q) => q.hits !== null).length,
    sources: scope.search_strategy.sources.length,
  } : null,
  todo: { count: todo.length },
  build_errors: errors.length,
  warnings,
};
emitJson('public/provenance.json', provenance);
emitJson('src/data/provenance.json', provenance);

// ───────────────────────── errors: BUILD-ERRORS.md + build-errors.json
const errFile = path.join(PACK, 'BUILD-ERRORS.md');
if (errors.length) {
  const md = [
    `# BUILD-ERRORS`, '',
    `\`scripts/build-content.ts\` found ${errors.length} error(s). The pack was not modified; fix these and re-run \`npm run build:content\`.`,
    'Uncited prose is never repaired by adding a citation, and an unknown id is never re-pointed — inventing provenance is worse than shipping the error (APP-SPEC §6.1).', '',
    ...errors.map((e) => `- **${e.where}** — ${e.message}`), '',
  ].join('\n');
  emit('content-pack/BUILD-ERRORS.md', md);
} else if (fs.existsSync(errFile)) fs.unlinkSync(errFile);
emitJson('src/data/build-errors.json', errors);

// ───────────────────────── 6. summary
console.log(`\ncontent build — ${manifest?.slug ?? '(no manifest)'} · mode ${manifest?.mode ?? '?'} · ${stamp}`);
console.table([
  { item: 'sections', value: parsed.sections.length },
  { item: 'words', value: provenance.words },
  { item: 'blocks (cited/framing/synthesis)', value: `${parsed.blocks.total} (${parsed.blocks.cited}/${parsed.blocks.framing}/${parsed.blocks.synthesis})` },
  { item: 'uncited blocks', value: parsed.uncited.length },
  { item: 'glossary terms', value: glossary.length },
  { item: '  occurring / linked', value: `${occurring.length} / ${linkedTerms.length} (${provenance.terms.linked_pct_of_occurring}%)` },
  { item: '  only in catalogue prose', value: onlyInCatalogue.length },
  { item: '  unmatched', value: unmatched.length },
  { item: 'concepts', value: concepts.length },
  { item: 'figures', value: `${figures.length} (${Object.entries(byKind).map(([k, v]) => `${k} ${v}`).join(', ')})` },
  { item: 'references', value: `${references.length} (${Object.entries(byTier).map(([k, v]) => `${k} ${v}`).join(', ')})` },
  { item: 'compounds', value: `${packCompounds.length} (${provenance.catalogue.compounds_with_empty_evidence.length} with empty evidence)` },
  { item: 'occurrence rows', value: `${occurrenceRows.length} (${Object.entries(provenance.catalogue.occurrence_rows_by_basis).map(([k, v]) => `${k} ${v}`).join(', ')})` },
  { item: 'evidence rows', value: `${allEvidence.length} (${Object.entries(provenance.catalogue.evidence_by_grade).sort().map(([k, v]) => `${k} ${v}`).join(', ')})` },
  { item: 'taxa', value: `${packTaxa.length} (${Object.entries(provenance.taxa.by_profile_depth).map(([k, v]) => `${k} ${v}`).join(', ')})` },
  { item: 'plantings → taxa', value: `${plantings.length} → ${provenance.plantings.collapsed_to_taxa}` },
  { item: 'preparations', value: preparationsPack.length },
  { item: 'forbidden keys', value: forbiddenHits.length },
  { item: 'structures (mismatches)', value: structureSummary ? `${structureSummary.structures} (${structureSummary.formulaMismatches.length + structureSummary.inchikeyMismatches.length})` : 'missing' },
  { item: 'tours', value: tours.length },
  { item: 'todo items', value: todo.length },
  { item: 'warnings', value: warnings.length },
  { item: 'errors', value: errors.length },
]);
console.table(written.filter((w) => w.status === 'written').map((w) => ({ file: w.file, kB: Math.round(w.bytes / 102.4) / 10 })));
if (process.env.BX_VERBOSE && warnings.length) console.log('warnings:\n' + warnings.map((w) => '  WARN ' + w).join('\n'));
else if (warnings.length) console.log(`${warnings.length} warnings (BX_VERBOSE=1 to list; all are in provenance.json)`);
if (errors.length) {
  console.error(`\n${errors.length} error(s) — written to content-pack/BUILD-ERRORS.md:`);
  for (const e of errors) console.error(`  ERROR ${e.where}: ${e.message}`);
  // CI gate (README "Known build errors"): with BX_KNOWN_ERRORS pointing at the committed build-errors.json, the
  // build still prints and records every error but fails only on an error that is not already known and shown
  // on /methods. Locally, and without the variable, any error fails the build.
  const known = process.env.BX_KNOWN_ERRORS;
  if (known && fs.existsSync(known)) {
    const k = new Set((JSON.parse(fs.readFileSync(known, 'utf8')) as BuildError[]).map((e) => `${e.where}|${e.message}`));
    const fresh = errors.filter((e) => !k.has(`${e.where}|${e.message}`));
    if (!fresh.length) { console.error('All errors are known, recorded in build-errors.json and published on /methods — continuing (BX_KNOWN_ERRORS).'); process.exit(0); }
    console.error(`${fresh.length} NEW error(s) not in ${known}.`);
  }
  process.exit(1);
}
console.log('\n0 errors.');
