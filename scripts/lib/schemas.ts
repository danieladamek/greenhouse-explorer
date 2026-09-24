/**
 * Zod schemas mirroring docs/CONTENT-PACK.md v0.5 (topic mode) and tools/validate_pack.py, plus the five
 * catalogue-extension files that KICKOFF §4b–4d specify normatively for this prototype: compounds.yaml, taxa.yaml,
 * plantings.csv, preparations.yaml and taxa_safety_evidence.yaml (proposed for a future `mode: catalogue`, B6.1;
 * docs/ was not edited). Everything the content build accepts is declared here; anything else is a loud failure.
 */
import { z } from 'zod';

export const kebab = z.string().regex(/^[a-z0-9-]+$/, 'must be kebab-case');

export const ManifestSchema = z
  .object({
    mode: z.enum(['manuscript', 'topic']).default('manuscript'),
    slug: kebab,
    title: z.string().min(1),
    short_title: z.string().min(1),
    question: z.string().optional(),
    purpose: z.string().optional(),
    as_of: z.string().optional(),
    authors: z.array(z.string().min(1)).min(1),
    venue: z.string().min(1),
    year: z.number().int(),
    doi: z.string().optional(),
    url: z.string().optional(),
    plain_abstract: z.string().default(''),
    reading_minutes: z.number().optional(),
    audience: z.string().optional(),
    palette: z.object({ groups: z.record(z.string()) }).default({ groups: {} }),
    permissions: z.object({
      text: z.string().min(1, 'permissions.text is REQUIRED — no pack ships without it'),
      figures: z.string().optional(),
    }),
    delivery: z.enum(['local', 'pages']).default('local'),
    link_every_occurrence: z.boolean().default(false),
    // CONTENT-PACK shows builder as {name, version, date}; this pack writes one string. Both are accepted and the
    // build normalises to the object form (schema feedback for B6.1).
    builder: z.union([z.string().min(1), z.object({ name: z.string(), version: z.string(), date: z.string().optional() })]),
    github_account: z.string().min(1),
    notes_storage: z.enum(['file', 'browser']).default('file'),
    catalogue: z.object({
      enabled: z.boolean(), file: z.string(), count: z.number().int(), note: z.string().optional(),
      taxa_file: z.string(), plantings_file: z.string(), preparations_file: z.string(), taxa_evidence_file: z.string(),
      long_tail_display: z.enum(['none', 'count', 'table']).default('none'),
    }).optional(),
    // KICKOFF §4e — the prototype banner and the critique link
    prototype: z.boolean().default(false),
    banner: z.object({ text: z.string().min(1), link_label: z.string().min(1) }).optional(),
    critique: z.object({ issues_url: z.string().url(), label: z.string().min(1) }).optional(),
  })
  .superRefine((m, ctx) => {
    if (m.mode === 'topic') {
      for (const k of ['question', 'purpose', 'as_of'] as const) {
        if (!m[k]) ctx.addIssue({ code: z.ZodIssueCode.custom, path: [k], message: `${k} is REQUIRED in topic mode` });
      }
      if (!/peer/i.test(m.venue)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['venue'], message: 'topic mode: venue must make the non-peer-reviewed status unmissable' });
      }
      if (m.delivery === 'pages' && !/25 words/i.test(m.permissions.text)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['permissions', 'text'], message: 'delivery: pages needs permissions.text to state the ≤ 25-word quotation rule' });
      }
    } else if (!(m.doi || m.url)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'doi or url required' });
    }
    if (m.prototype) {
      if (!m.banner) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['banner'], message: 'prototype: true needs banner {text, link_label} (KICKOFF §4e)' });
      if (!m.critique) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['critique'], message: 'prototype: true needs critique {issues_url, label} (KICKOFF §4e)' });
      if (!/PROTOTYPE/.test(m.venue)) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['venue'], message: 'prototype: venue must carry the prototype statement in capitals' });
    }
  });
export type Manifest = z.infer<typeof ManifestSchema>;

export const GLOSSARY_KINDS = ['science', 'methods', 'statistics', 'notation', 'drug'] as const;
export const GlossaryEntrySchema = z.object({
  id: kebab,
  term: z.string().min(1),
  kind: z.enum(GLOSSARY_KINDS),
  variants: z.array(z.string().min(1)).default([]),
  short: z.string().min(1).max(200, 'short > 200 chars'),
  definition: z.string().min(1),
  concept: kebab.optional(),
  see: z.array(kebab).default([]),
  sources: z.array(z.string()).default([]),
});
export const GlossarySchema = z.array(GlossaryEntrySchema);
export type GlossaryEntry = z.infer<typeof GlossaryEntrySchema>;

export const ConceptFrontmatterSchema = z.object({
  id: kebab,
  title: z.string().min(1),
  one_liner: z.string().min(1),
  why_here: z.string().min(1),
  prerequisites: z.array(kebab).default([]),
  terms: z.array(kebab).default([]),
  figures: z.array(kebab).default([]),
  further_reading: z
    .array(z.object({ title: z.string().min(1), url: z.string().min(1), kind: z.string().optional() }))
    .min(2, 'needs ≥2 further_reading'),
  self_check: z
    .array(
      z
        .object({ q: z.string().min(1), options: z.array(z.string()).min(2), answer: z.number().int(), explanation: z.string().default('') })
        .refine((q) => q.answer >= 0 && q.answer < q.options.length, { message: 'self_check answer index out of range' }),
    )
    .min(1, 'needs ≥1 self_check'),
});
export type ConceptFrontmatter = z.infer<typeof ConceptFrontmatterSchema>;

export const FIGURE_KINDS = ['chart', 'table', 'network', 'pathway', 'image'] as const;
export const CHART_TYPES = ['line', 'bar', 'grouped-bar', 'stacked-bar', 'scatter', 'area', 'step', 'box', 'heatmap', 'forest', 'range-bar'] as const;
const AxisSchema = z.object({
  field: z.string().optional(),
  label: z.string().optional(),
  unit: z.string().optional(),
  scale: z.enum(['linear', 'log']).optional(),
  invert: z.boolean().optional(),
  domain: z.tuple([z.number(), z.number()]).optional(),
});
export const ChartSpecSchema = z.object({
  type: z.enum(CHART_TYPES),
  data: z.string().optional(),
  x: AxisSchema.optional(),
  y: AxisSchema.optional(),
  value: AxisSchema.optional(), // heatmap cell value (catalogue pack extension)
  series: z.union([z.string(), z.array(z.object({ label: z.string(), lo: z.string().optional(), hi: z.string().optional(), field: z.string().optional() }))]).optional(),
  ci: z.tuple([z.string(), z.string()]).optional(),
});
export const ExplainSchema = z.object({ on: z.string().min(1), text: z.string().min(1), term: kebab.optional(), concept: kebab.optional() });
export const HotspotSchema = z.object({ panel: z.string().optional(), x: z.number(), y: z.number(), w: z.number(), h: z.number(), text: z.string().min(1), term: kebab.optional() });
export const FigureSchema = z.object({
  id: kebab,
  label: z.string().min(1),
  title: z.string().min(1),
  kind: z.enum(FIGURE_KINDS),
  synthesis: z.enum(['data', 'conceptual']).optional(),
  refs: z.array(z.number().int()).default([]),
  data: z.string().optional(),
  image: z.string().optional(),
  panels: z.array(z.object({ id: z.string(), image: z.string(), label: z.string() })).optional(),
  columns: z.array(z.object({ field: z.string(), label: z.string().optional(), sortable: z.boolean().optional(), sort_field: z.string().optional() })).optional(),
  chart: ChartSpecSchema.optional(),
  caption: z.string().min(1),
  legend_text: z.string().optional(),
  how_to_read: z.string().min(1),
  explain: z.array(ExplainSchema).default([]),
  hotspots: z.array(HotspotSchema).default([]),
  concepts: z.array(kebab).default([]),
  discussed_in: z.array(z.string()).default([]),
  cites: z.array(z.number().int()).default([]),
  source: z.string().min(1),
});
export const FiguresSchema = z.array(FigureSchema);
export type FigureDef = z.infer<typeof FigureSchema>;

export const REF_ROLES = ['support', 'method', 'contrast', 'prior-result', 'data-source', 'background', 'guideline', 'review', 'consensus'] as const;
export const REF_TIERS = ['seminal', 'classic', 'current', 'background'] as const;
export const ReferenceSchema = z
  .object({
    n: z.number().int().positive(),
    tier: z.enum(REF_TIERS).optional(),
    anchor: z.boolean().default(false),
    citation: z.string().min(1),
    year: z.number().int().optional(),
    doi: z.string().optional(),
    url: z.string().optional(),
    summary: z.string().default(''),
    why_it_mattered: z.string().default(''),
    role_here: z.enum(REF_ROLES),
    role_note: z.string().default(''),
    key_facts: z.array(z.string()).default([]),
    gap: z.string().optional(),
    cited_in: z.array(z.string()).default([]),
    // catalogue extension: which catalogue records cite this reference, as "compounds:<id>" · "taxa:<id>" ·
    // "preparations:<id>". Checked against the records by the build.
    cited_in_catalogue: z.array(z.string().regex(/^(compounds|taxa|preparations):[a-z0-9-]+$/, 'cited_in_catalogue entries are kind:id')).default([]),
    verified: z.boolean().default(false),
    notes: z.string().optional(),
  })
  .refine((r) => !!(r.doi || r.url), { message: 'doi or url required' })
  .refine((r) => r.summary.trim().length > 0 || !r.verified, { message: 'no summary (a missing summary is allowed only with verified: false)' })
  .refine((r) => r.tier !== 'classic' || r.summary.trim().split(/\s+/).length >= 30, { message: 'classic tier needs a full summary (3–6 sentences)' });
export const ReferencesSchema = z.array(ReferenceSchema);
export type Reference = z.infer<typeof ReferenceSchema>;

export const TodoSchema = z.array(z.object({ where: z.string().min(1), what: z.string().min(1) }));
export type TodoItem = z.infer<typeof TodoSchema>[number];

/** Node/edge JSON for network and pathway figures. */
export const GraphSchema = z.object({
  layout: z.enum(['fixed', 'tree', 'force']).default('force'),
  compartments: z.array(z.object({ id: z.string(), label: z.string(), y: z.number() })).optional(),
  legend: z.record(z.string()).optional(),
  nodes: z
    .array(z.object({
      id: z.string(), label: z.string(), kind: z.string().optional(), x: z.number().optional(), y: z.number().optional(),
      term: kebab.nullable().optional(), contested: z.boolean().optional(),
      // this pack's pathway JSON: `type` (normalised to kind), per-node refs, compartment, a compound link, a note
      type: z.string().optional(), refs: z.array(z.number().int()).default([]), compartment: z.string().optional(),
      compound_id: kebab.optional(), note: z.string().optional(),
    }))
    .min(1),
  edges: z.array(z.object({
    from: z.string(), to: z.string(), type: z.string().optional(), label: z.string().optional(), via: z.string().optional(),
    refs: z.array(z.number().int()).default([]), style: z.enum(['solid', 'dashed', 'artefact']).optional(),
  })),
});
export type Graph = z.infer<typeof GraphSchema>;

/* ───────────────────────── scope.yaml (topic mode) — published content, rendered by /methods */

export const ScopeSchema = z.object({
  topic: z.string().min(1),
  question: z.string().min(1),
  purpose: z.string().optional(),
  boundary: z.object({
    in: z.array(z.string()).min(1, 'boundary.in is empty — the scope must say what is in'),
    out: z.array(z.string()).min(1, 'boundary.out is empty — the scope must say what was deliberately left out'),
    rationale: z.string().default(''),
  }),
  level: z.string().optional(),
  time_window: z.object({ current_from: z.number().int().optional(), seminal: z.string().optional() }),
  stance: z.string().optional(),
  depth: z.enum(['brief', 'standard', 'deep']),
  anchors: z.array(z.object({ citation: z.string(), doi: z.string().optional(), url: z.string().optional(), why: z.string().default(''), refs: z.array(z.number().int()).default([]) })).default([]),
  excluded: z.array(z.object({ what: z.string(), why: z.string().default('') })).default([]),
  assumed: z.boolean().default(false),
  interview: z.array(z.object({ q: z.string(), answer: z.string(), asked: z.union([z.string(), z.date()]).transform(String).optional() })).default([]),
  search_strategy: z.object({
    run_on: z.union([z.string(), z.date()]).transform((d) => (d instanceof Date ? d.toISOString().slice(0, 10) : d)),
    sources: z.array(z.string()).min(1),
    queries_note: z.string().default(''),
    // `hits` is REQUIRED as a key, but may be null: this prototype's sweep did not log counts, and the pack says
    // so rather than inventing them. The app renders null as "not logged in the prototype", never as a number.
    queries: z.array(z.object({
      q: z.string().min(1), source: z.string().optional(), hits: z.number().int().nullable(), kept: z.number().int().optional(),
      lane: z.string().optional(), note: z.string().optional(),
    })).min(1),
    snowball: z.array(z.string()).default([]),
    inclusion: z.array(z.string()).min(1),
    exclusion: z.array(z.string()).min(1),
    known_gaps: z.array(z.string()).default([]),
  }),
  corpus_profile: z.object({
    by_tier: z.record(z.number().int()),
    year_range: z.array(z.number().int()).optional(),
    total: z.number().int().optional(),
    total_references: z.number().int().optional(),
    verified: z.number().int().optional(),
    current_before_window: z.number().int().optional(),
    concentration: z.string().default(''),
    dissent_represented: z.boolean().default(false),
    dissent_note: z.string().default(''),
    dissent_examples: z.array(z.string()).default([]),
    evidence_shape: z.string().default(''),
    note: z.string().default(''),
  }),
  // catalogue extension (greenhouse): the content line, the extraction rule and the evidence-grade table
  content_line: z.object({ in: z.array(z.string()).min(1), out: z.array(z.string()).min(1) }),
  extraction_rule: z.string().min(1),
  evidence_grades: z.object({
    rule: z.string().min(1),
    grades: z.array(z.object({ grade: z.enum(['A', 'B', 'C', 'D', 'E', 'T']), basis: z.string().min(1) })).length(6, 'evidence_grades.grades must define A, B, C, D, E and T'),
    example: z.string().default(''),
  }),
});
export type Scope = z.infer<typeof ScopeSchema>;

/* ───────────────────────── compounds.yaml — KICKOFF §4b (catalogue extension) */

const nullableString = z.string().nullable().default(null);
const refsList = z.array(z.number().int().positive()).default([]);

export const BASES = ['fresh_weight', 'dry_weight', 'essential_oil_pct', 'per_g_extract', 'unstated', 'presence_only'] as const;
export type Basis = (typeof BASES)[number];
/** Bases that may enter a quantitative view. `unstated` and `presence_only` never do (KICKOFF §1, §4b). */
export const QUANT_BASES: readonly Basis[] = ['fresh_weight', 'dry_weight', 'essential_oil_pct', 'per_g_extract'];
export const LEVELS = ['species', 'cultivar'] as const;
export const GRADES = ['A', 'B', 'C', 'D', 'E', 'T'] as const;
export const TEST_ARTICLES = ['whole_herb', 'named_extract', 'essential_oil', 'isolated_compound', 'multi_herb_formula'] as const;
export const POPULATIONS = ['human', 'animal', 'in_vitro', 'traditional'] as const;
export const FORMED_DURING = ['distillation', 'drying', 'heating', 'infusion', 'fermentation', 'cutting'] as const;

/**
 * One occurrence row. KICKOFF §4b: every row renders with unit, basis, level and source. `basis` is required and
 * enumerated — a row with no basis is a build error, never a guess. `value` is a number, a range string, or null
 * (presence only). `database_url` is not in §4b's key list; this pack carries it on every row and it is kept.
 */
export const OccurrenceSchema = z
  .object({
    taxon_id: kebab,
    plant_part: z.string().nullable(),
    value: z.union([z.number(), z.string().min(1)]).nullable(),
    unit: z.string().nullable(),
    basis: z.enum(BASES, { errorMap: () => ({ message: `occurrence basis is required and must be one of ${BASES.join(' | ')}` }) }),
    level: z.enum(LEVELS),
    cultivar: z.string().nullable(),
    source_citation: z.string().min(1, 'every occurrence row must carry its source citation'),
    source_doi_or_url: z.string().nullable(),
    database: z.string().nullable(),
    database_url: z.string().nullable().optional(),
    verified: z.boolean(),
    note: z.string().nullable(),
  })
  .strict()
  .superRefine((o, ctx) => {
    const quant = (QUANT_BASES as readonly string[]).includes(o.basis);
    // presence_only carries no number. One row in this pack uses it with value "not detected" / unit "qualitative"
    // (teucrin A in S. lateriflora): a qualitative statement, rendered verbatim — never as "reported present".
    if (o.basis === 'presence_only' && o.value !== null && !(typeof o.value === 'string' && o.unit === 'qualitative' && !/\d/.test(o.value))) {
      ctx.addIssue({ code: 'custom', path: ['value'], message: 'presence_only rows carry no number (a qualitative statement needs unit: qualitative)' });
    }
    if (quant && o.value === null) ctx.addIssue({ code: 'custom', path: ['value'], message: `basis ${o.basis} needs a value` });
    if (o.value !== null && !o.unit) ctx.addIssue({ code: 'custom', path: ['unit'], message: 'an occurrence value may never be recorded without its unit' });
    if (o.level === 'cultivar' && !o.cultivar) ctx.addIssue({ code: 'custom', path: ['cultivar'], message: 'level cultivar needs the cultivar named' });
  });
export type Occurrence = z.infer<typeof OccurrenceSchema>;

/** One graded health statement (compounds.yaml and taxa_safety_evidence.yaml share it). Grade and test article travel together. */
export const EvidenceSchema = z
  .object({
    claim: z.string().min(1),
    grade: z.enum(GRADES, { errorMap: () => ({ message: `evidence grade is required: ${GRADES.join(' | ')}` }) }),
    test_article: z.enum(TEST_ARTICLES, { errorMap: () => ({ message: `every evidence row must name its test article: ${TEST_ARTICLES.join(' | ')}` }) }),
    test_article_detail: z.string().min(1, 'test_article_detail is required'),
    population: z.enum(POPULATIONS),
    outcome_summary: z.string().min(1),
    refs: z.array(z.number().int().positive()).min(1, 'an evidence row needs ≥ 1 reference'),
    note: z.string().nullable().default(null),
  })
  .strict()
  .superRefine((e, ctx) => {
    // grade ↔ population consistency: A–C are human, D animal, E in vitro, T traditional
    const want = { A: 'human', B: 'human', C: 'human', D: 'animal', E: 'in_vitro', T: 'traditional' }[e.grade];
    if (want !== e.population) ctx.addIssue({ code: 'custom', path: ['population'], message: `grade ${e.grade} implies population ${want}, got ${e.population}` });
  });
export type Evidence = z.infer<typeof EvidenceSchema>;

export const CompoundSchema = z
  .object({
    id: kebab,
    name: z.string().min(1),
    synonyms: z.array(z.string()).default([]),
    class: kebab,
    subclass: z.string().default(''),
    one_liner: z.string().min(1),
    palette_group: z.enum(['lamiaceae', 'asteraceae', 'shared']),
    auxiliary: z.boolean().default(false),
    identity: z.object({
      iupac: z.string().nullable(),
      formula: z.string().nullable(),
      mw: z.number().nullable(),
      mw_source: z.string().nullable(),
      smiles: z.string().nullable(),
      inchikey: z.string().nullable(),
      inchi: z.string().optional(),
      cas: z.string().nullable(),
      pubchem_cid: z.number().int().nullable(),
      chebi_id: z.string().nullable(),
      source: z.string().nullable(),
      cross_checked: z.boolean(),
      note: z.string().nullable().default(null),
    }).superRefine((i, ctx) => {
      if (i.smiles && (!i.inchikey || !i.formula)) ctx.addIssue({ code: 'custom', message: 'a record with a SMILES needs inchikey and formula' });
    }),
    physchem: z.object({ logp: z.number().nullable(), pka: z.number().nullable(), source: nullableString }),
    biosynthesis: z.object({ pathway: z.string().nullable(), note: nullableString }),
    occurrences: z.array(OccurrenceSchema).default([]),
    pharmacology: z.object({ primary_targets: nullableString, mechanism: nullableString, functional_notes: nullableString }),
    absorption_bioavailability: nullableString,
    evidence: z.array(EvidenceSchema).default([]),
    processing_stability: z.object({
      heat: nullableString, water_solubility: nullableString, ethanol_solubility: nullableString, volatility: nullableString,
      enzyme_dependence: nullableString, formed_during: z.enum(FORMED_DURING).nullable(), note: nullableString, refs: refsList,
    }),
    safety_flags: z.array(z.object({
      flag: z.string().min(1), detail: nullableString, threshold_or_limit: nullableString,
      source_citation: z.string().min(1, 'every safety flag carries its source'), refs: refsList,
    }).strict()).default([]),
    teaching_note: nullableString,
    citations: z.array(z.number().int().positive()).min(1, 'every compound cites ≥ 1 reference'),
    gaps: z.array(z.string()).default([]),
    as_of: z.union([z.string(), z.date()]).transform(String),
  })
  .strict();
export const CompoundsSchema = z.array(CompoundSchema);
export type PackCompound = z.infer<typeof CompoundSchema>;

/* ───────────────────────── taxa.yaml — KICKOFF §4c */

export const IDENTITY_STATUS = ['confirmed', 'check', 'unresolved'] as const;
export const PROFILE_DEPTHS = ['deep', 'light', 'guest', 'stub'] as const;
export const COLUMNS = ['leafy_greens', 'veggies', 'herbs', 'medicinal'] as const;

export const TaxonSchema = z
  .object({
    id: kebab,
    species_key: z.string().min(1),
    accepted_name: z.string().min(1),
    authority: z.string().nullable(),
    family: z.string().min(1),
    common_names: z.array(z.string()).default([]),
    identifiers: z.object({ ncbi_taxid: z.number().int().nullable(), powo_id: z.string().nullable(), gbif_key: z.number().int().nullable(), wfo_id: z.string().nullable() }),
    synonyms: z.array(z.string()).default([]),
    columns: z.array(z.enum(COLUMNS)).min(1),
    identity_status: z.enum(IDENTITY_STATUS),
    candidates: z.array(kebab).optional(),
    profiled: z.boolean(),
    profile_depth: z.enum(PROFILE_DEPTHS),
    cultivars: z.array(z.object({
      crop_id: z.string().regex(/^GH-\d{3}$/), name: z.string().nullable(), type: z.string().nullable(), list_category: z.enum(COLUMNS),
      name_as_given: z.string().nullable(), identity_status: z.enum(IDENTITY_STATUS), note: z.string().nullable(),
    }).strict()).default([]),
    safety: z.null(),
    taxonomy_note: z.string().nullable(),
    as_of: z.union([z.string(), z.date()]).transform(String),
  })
  .strict()
  .superRefine((t, ctx) => {
    if (t.identity_status === 'unresolved' && !(t.candidates && t.candidates.length >= 2)) ctx.addIssue({ code: 'custom', path: ['candidates'], message: 'an unresolved taxon needs ≥ 2 candidates' });
    if (t.identity_status === 'confirmed' && t.candidates?.length) ctx.addIssue({ code: 'custom', path: ['candidates'], message: 'candidates only when identity_status is unresolved or check' });
    if (t.profiled !== (t.profile_depth !== 'stub')) ctx.addIssue({ code: 'custom', path: ['profiled'], message: `profiled ${t.profiled} disagrees with profile_depth ${t.profile_depth}` });
    // a record with no cultivars is only legitimate as a candidate of an unresolved entry (checked in the build)
  });
export const TaxaFileSchema = z.object({
  meta: z.object({ generated: z.union([z.string(), z.date()]).transform(String), source: z.string(), counts: z.record(z.number().int()), note: z.string().default('') }),
  taxa: z.array(TaxonSchema).min(1),
});
export type PackTaxon = z.infer<typeof TaxonSchema>;

/* ───────────────────────── plantings.csv — KICKOFF §4c */

export const PLANTING_COLUMNS = ['id', 'list_category', 'original_entry', 'common_name', 'cultivar', 'crop_type', 'scientific_name', 'species_key', 'family', 'confidence', 'note', 'taxon_id', 'status'] as const;
export const PlantingSchema = z
  .object({
    id: z.string().regex(/^GH-\d{3}$/, 'planting id is GH-nnn'),
    list_category: z.string().min(1),
    original_entry: z.string().min(1),
    common_name: z.string().min(1),
    cultivar: z.string().default(''),
    crop_type: z.string().default(''),
    scientific_name: z.string().min(1),
    species_key: z.string().min(1),
    family: z.string().min(1),
    confidence: z.enum(['High', 'Medium', 'Low', 'Check', 'Unresolved']),
    note: z.string().default(''),
    taxon_id: kebab,
    status: z.enum(['current', 'past']),
  })
  .strict();
export type Planting = z.infer<typeof PlantingSchema>;

/* ───────────────────────── preparations.yaml — KICKOFF §4d (CLOSED schema) */

/** The only keys a preparation may carry. Anything else — above all a dose — fails the build. */
export const PREPARATION_KEYS = ['id', 'name', 'kind', 'plants', 'plant_part', 'method_as_chemistry', 'solvent', 'temperature_c', 'time_min', 'what_it_extracts', 'what_it_leaves_behind', 'formed_or_lost', 'safety_block', 'refs', 'as_of'] as const;
/** Key names that must not appear anywhere in the pack (KICKOFF §4d unit test). */
export const FORBIDDEN_KEYS = ['dose', 'dosage', 'indication', 'serving', 'frequency'] as const;

const range = z.tuple([z.number(), z.number()]).nullable();
export const PreparationSchema = z
  .object({
    id: kebab,
    name: z.string().min(1),
    kind: z.enum(['infusion', 'decoction', 'tincture', 'maceration', 'distillation']),
    plants: z.array(kebab).min(1),
    plant_part: z.string().min(1),
    method_as_chemistry: z.string().min(1),
    solvent: z.string().min(1),
    temperature_c: range,
    time_min: range,
    what_it_extracts: z.array(kebab).default([]),
    what_it_leaves_behind: z.array(kebab).default([]),
    formed_or_lost: z.array(z.object({ compound_id: kebab, change: z.string().min(1), why: z.string().min(1) }).strict()).default([]),
    safety_block: z.object({
      summary: z.string().min(1, 'every preparation carries a safety block'),
      constituents_of_concern: z.array(z.object({ compound_id: kebab, concern: z.string().min(1), threshold_or_limit: z.string().nullable(), refs: refsList }).strict()).default([]),
      refs: z.array(z.number().int().positive()).min(1),
    }).strict(),
    refs: z.array(z.number().int().positive()).min(1),
    as_of: z.union([z.string(), z.date()]).transform(String),
  })
  .strict();
export const PreparationsSchema = z.array(PreparationSchema);
export type Preparation = z.infer<typeof PreparationSchema>;

/* ───────────────────────── taxa_safety_evidence.yaml — KICKOFF §4c */

const statement = z.object({ statement: z.string().nullable(), refs: refsList }).strict();
const monograph = z.object({ exists: z.boolean().nullable(), url: z.string().nullable() }).strict();
export const TaxonSafetySchema = z
  .object({
    taxon_id: kebab,
    plant_part_used: z.string().nullable(),
    safety: z.object({
      // an interaction names what it is with, its effect, and the pack's grade for it (null where ungraded). §4c lists
      // no test_article here: the app shows the grade with "test article not recorded" rather than a bare grade.
      drug_interactions: z.array(z.object({ with: z.string().min(1), effect: z.string().min(1), evidence_grade: z.enum(GRADES).nullable(), refs: refsList }).strict()).default([]),
      pregnancy_lactation: statement,
      allergy: statement,
      constituents_of_concern: z.array(z.object({ compound_id: kebab, concern: z.string().min(1), threshold_or_limit: z.string().nullable(), refs: refsList }).strict()).default([]),
      adverse_event_history: statement,
      contraindications: z.array(z.string().min(1)).default([]),  // sentences with inline [n]
    }).strict(),
    evidence: z.array(EvidenceSchema).default([]),
    monograph_status: z.object({ ema_hmpc: monograph, escop: monograph, who: monograph }).strict(),
    refs: refsList,
    gaps: z.array(z.string()).default([]),
    as_of: z.union([z.string(), z.date()]).transform(String),
  })
  .strict();
export const TaxaSafetySchema = z.array(TaxonSafetySchema);
export type TaxonSafety = z.infer<typeof TaxonSafetySchema>;

/** Walk any parsed YAML value and return the paths of every mapping key in `forbidden` (case-insensitive). */
export function scanForbiddenKeys(value: unknown, forbidden: readonly string[] = FORBIDDEN_KEYS, where = ''): string[] {
  const hits: string[] = [];
  const bad = new Set(forbidden.map((k) => k.toLowerCase()));
  const walk = (v: unknown, p: string) => {
    if (Array.isArray(v)) v.forEach((x, i) => walk(x, `${p}[${i}]`));
    else if (v && typeof v === 'object' && !(v instanceof Date)) {
      for (const [k, x] of Object.entries(v)) {
        if (bad.has(k.toLowerCase())) hits.push(`${p}/${k}`);
        walk(x, `${p}/${k}`);
      }
    }
  };
  walk(value, where);
  return hits;
}

export interface BuildError { where: string; message: string }

/** Flatten a zod error into build errors with a stable "where" prefix. */
export function zodErrors(where: string, err: z.ZodError): BuildError[] {
  return err.issues.map((i) => ({ where: i.path.length ? `${where}/${i.path.join('/')}` : where, message: i.message }));
}
