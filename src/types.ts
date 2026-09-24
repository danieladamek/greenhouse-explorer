import type { Basis } from '@/lib/basis';

export type BlockMarker = 'framing' | 'synthesis' | null;

export type Chunk =
  | { kind: 'md'; md: string; hasMath: boolean; marker: BlockMarker; id: string | null }
  | { kind: 'figure'; id: string };

export interface Section {
  id: string; title: string; depth: number; number: string | null;
  chunks: Chunk[]; terms: string[]; cites: number[]; figures: string[]; words: number;
  blocks: number; cited_blocks: number; framing_blocks: number; synthesis_blocks: number;
}

export interface GlossaryEntry {
  id: string; term: string; kind: 'science' | 'methods' | 'statistics' | 'notation' | 'drug';
  variants: string[]; short: string; definition: string; concept?: string; see: string[]; sources: string[];
  appears_in: string[]; occurrences: number; figures: string[]; concepts: string[]; compounds: string[]; records: string[];
}

export interface SelfCheck { q: string; options: string[]; answer: number; explanation: string }
export interface Concept {
  id: string; title: string; one_liner: string; why_here: string; prerequisites: string[]; terms: string[]; figures: string[];
  further_reading: { title: string; url: string; kind?: string }[]; self_check: SelfCheck[];
  body_before: string; picture: string | null; body_after: string; has_math: boolean;
  used_by_terms: string[]; used_by_figures: string[]; used_by_concepts: string[];
}

export type Row = Record<string, string | number | null>;
export interface GraphNode { id: string; label: string; kind?: string; x?: number; y?: number; term?: string | null; contested?: boolean; refs?: number[]; compartment?: string; compound_id?: string; note?: string }
export interface GraphEdge { from: string; to: string; type?: string; label?: string; via?: string; refs?: number[]; style?: string }
export interface Graph { layout: 'fixed' | 'tree' | 'force'; compartments?: { id: string; label: string; y: number }[]; legend?: Record<string, string>; nodes: GraphNode[]; edges: GraphEdge[] }
export interface Explain { on: string; text: string; term?: string; concept?: string }
export interface Hotspot { panel?: string; x: number; y: number; w: number; h: number; text: string; term?: string }
export interface Axis { field?: string; label?: string; unit?: string; scale?: 'linear' | 'log'; invert?: boolean; domain?: [number, number] }
export interface ChartSpec {
  type: string; data?: string; x?: Axis; y?: Axis; value?: Axis;
  series?: string | { label: string; lo?: string; hi?: string; field?: string }[];
  ci?: [string, string];
}
export interface Figure {
  id: string; label: string; title: string; kind: 'chart' | 'table' | 'network' | 'pathway' | 'image';
  synthesis?: 'data' | 'conceptual'; refs: number[];
  image?: string; panels?: { id: string; image: string; label: string }[];
  columns?: { field: string; label?: string; sortable?: boolean; sort_field?: string }[];
  chart?: ChartSpec; caption: string; legend_text?: string; how_to_read: string;
  explain: Explain[]; hotspots: Hotspot[]; concepts: string[]; discussed_in: string[]; cites: number[]; source: string;
  table?: { rows: Row[]; fields: string[] }; graph?: Graph; chart_rows?: Row[];
  provenance: string; caption_md?: string | null; how_to_read_md?: string | null;
}

export interface Reference {
  n: number; tier?: 'seminal' | 'classic' | 'current' | 'background'; anchor: boolean; citation: string; year?: number;
  doi?: string; url?: string; summary: string; why_it_mattered: string; role_here: string; role_note: string;
  key_facts: string[]; gap?: string; cited_in: string[]; cited_in_catalogue: string[]; verified: boolean; notes?: string;
  cited_sections: string[]; cited_compounds: string[];
}

export interface TodoItem { where: string; what: string }
export interface BuildError { where: string; message: string }
export interface SynthesisPassage { id: string; section: string; excerpt: string; words: number }

/* ── the catalogue (KICKOFF §4b–§4d) */

export type Grade = 'A' | 'B' | 'C' | 'D' | 'E' | 'T';
export type TestArticle = 'whole_herb' | 'named_extract' | 'essential_oil' | 'isolated_compound' | 'multi_herb_formula';
export type Population = 'human' | 'animal' | 'in_vitro' | 'traditional';
export type IdentityStatus = 'confirmed' | 'check' | 'unresolved';
export type ProfileDepth = 'deep' | 'light' | 'guest' | 'stub';

export interface EvidenceRow {
  claim: string; grade: Grade; test_article: TestArticle; test_article_detail: string; population: Population;
  outcome_summary: string; refs: number[]; note: string | null;
}
/** Evidence as rendered: the pack row plus its term/citation-linked prose. */
export interface EvidenceView extends EvidenceRow { md: { claim: string; outcome_summary: string } }

export interface OccurrenceRow {
  row: string; compound_id: string; compound: string; class: string; palette_group: string; auxiliary: boolean;
  taxon_id: string; taxon_known: boolean; taxon_name: string | null; family: string | null;
  plant_part: string | null; value: number | string | null; unit: string | null; basis: Basis; level: 'species' | 'cultivar'; cultivar: string | null;
  source_citation: string; source_doi_or_url: string | null; database: string | null; database_url: string | null;
  verified: boolean; note: string | null; refs: number[];
}

export interface AtomRecord { i: number; el: string; hyb: string; chg: number; arom: boolean; nH: number; q: number; cip: string | null }
export interface FunctionalGroupMatch { id: string; name: string; matches: number[][] }
export interface Descriptors {
  heavyAtoms: number; rings: number; aromaticRings: number; hbd: number; hba: number; rotatableBonds: number;
  logP: number; tpsa: number; fsp3: number; stereocenters: number; charge: number;
}
export interface Structure {
  formulaComputed: string; inchikeyComputed: string; canonicalSmiles: string; monoisotopicMass: number; averageMass: number;
  descriptors: Descriptors; atomCount: number; heavyAtomCount: number; functionalGroups: FunctionalGroupMatch[];
  conformerSource: 'pubchem' | 'rdkit'; sdf: string; svg: { light: string; dark: string; width: number; height: number }; detail: string;
  mwPack: number | null; mwSource: string | null;
}
export interface StructureDetail { id: string; atoms: AtomRecord[]; atomCoords: number[][] }

export interface SafetyFlag { flag: string; detail: string | null; threshold_or_limit: string | null; source_citation: string; refs: number[] }

export interface Compound {
  id: string; name: string; synonyms: string[]; class: string; subclass: string; one_liner: string; palette_group: string; auxiliary: boolean;
  identity: {
    iupac: string | null; formula: string | null; mw: number | null; mw_source: string | null; smiles: string | null; inchikey: string | null;
    inchi?: string; cas: string | null; pubchem_cid: number | null; chebi_id: string | null; source: string | null; cross_checked: boolean; note: string | null;
  };
  physchem: { logp: number | null; pka: number | null; source: string | null };
  biosynthesis: { pathway: string | null; note: string | null };
  occurrences: Omit<OccurrenceRow, 'row' | 'compound_id' | 'compound' | 'class' | 'palette_group' | 'auxiliary' | 'taxon_known' | 'taxon_name' | 'family' | 'refs'>[];
  pharmacology: { primary_targets: string | null; mechanism: string | null; functional_notes: string | null };
  absorption_bioavailability: string | null;
  evidence: EvidenceRow[];
  processing_stability: {
    heat: string | null; water_solubility: string | null; ethanol_solubility: string | null; volatility: string | null;
    enzyme_dependence: string | null; formed_during: string | null; note: string | null; refs: number[];
  };
  safety_flags: SafetyFlag[];
  teaching_note: string | null; citations: number[]; gaps: string[]; as_of: string;
  md: {
    one_liner: string; mechanism: string | null; primary_targets: string | null; functional_notes: string | null;
    absorption_bioavailability: string | null; teaching_note: string | null; processing_note: string | null; biosynthesis_note: string | null;
    evidence: { claim: string; outcome_summary: string }[];
    safety_flags: (string | null)[];
  };
  terms: string[]; cited_refs: number[]; taxa: string[]; has_human_evidence: boolean; structure: Structure | null; primer_sections: string[];
}

export interface CompoundMeta {
  id: string; name: string; class: string; subclass: string; palette_group: string; auxiliary: boolean; one_liner: string; synonyms: string[];
  formula: string | null; inchikey: string | null; mw: number | null; taxa: string[]; parts: string[]; bases: Basis[];
  has_human_evidence: boolean; evidence: number; safety_flags: number; grades: Grade[]; has_structure: boolean;
  svg: { light: string; dark: string } | null; formed_during: string | null;
}

export interface Cultivar { crop_id: string; name: string | null; type: string | null; list_category: string; name_as_given: string | null; identity_status: IdentityStatus; note: string | null }

export interface Statement { statement: string | null; refs: number[]; md: string | null }
export interface TaxonSafety {
  taxon_id: string; plant_part_used: string | null;
  safety: {
    drug_interactions: { with: string; effect: string; evidence_grade: Grade | null; refs: number[]; md: string | null }[];
    pregnancy_lactation: Statement; allergy: Statement; adverse_event_history: Statement;
    constituents_of_concern: { compound_id: string; concern: string; threshold_or_limit: string | null; refs: number[]; md: string | null }[];
    contraindications: { statement: string; md: string | null }[];
  };
  evidence: (EvidenceRow & { md: { claim: string; outcome_summary: string } })[];
  monograph_status: Record<'ema_hmpc' | 'escop' | 'who', { exists: boolean | null; url: string | null }>;
  refs: number[]; gaps: string[]; as_of: string; terms: string[]; cited_refs: number[];
}

export interface Taxon {
  id: string; species_key: string; accepted_name: string; authority: string | null; family: string; common_names: string[];
  identifiers: { ncbi_taxid: number | null; powo_id: string | null; gbif_key: number | null; wfo_id: string | null };
  synonyms: string[]; columns: string[]; identity_status: IdentityStatus; candidates?: string[]; profiled: boolean; profile_depth: ProfileDepth;
  cultivars: Cultivar[]; taxonomy_note: string | null; as_of: string;
  plantings: string[]; n_plantings: number; statuses: string[]; candidate_of: string | null; compounds: string[]; occurrence_rows: string[];
  safety_evidence: TaxonSafety | null; preparations: string[]; primer_sections: string[]; todo: TodoItem[];
}
export interface TaxonMeta {
  id: string; accepted_name: string; authority: string | null; family: string; common_names: string[]; columns: string[];
  identity_status: IdentityStatus; profiled: boolean; profile_depth: ProfileDepth; n_plantings: number; compounds: string[];
  candidates: string[]; candidate_of: string | null; preparations: string[]; has_safety: boolean; statuses: string[];
}

export interface Planting {
  id: string; list_category: string; original_entry: string; common_name: string; cultivar: string; crop_type: string; scientific_name: string;
  species_key: string; family: string; confidence: string; note: string; taxon_id: string; status: 'current' | 'past'; identity_status: IdentityStatus | null;
}

export interface FamilyIndex {
  id: string; family: string; colour: string | null; taxa: string[]; profiled: string[]; plantings: number; compounds: string[];
  shared_compounds: { id: string; taxa: string[] }[]; primer_sections: string[];
}

export interface Preparation {
  id: string; name: string; kind: string; plants: string[]; plant_part: string; method_as_chemistry: string; solvent: string;
  temperature_c: [number, number] | null; time_min: [number, number] | null; what_it_extracts: string[]; what_it_leaves_behind: string[];
  formed_or_lost: { compound_id: string; change: string; why: string }[];
  safety_block: { summary: string; constituents_of_concern: { compound_id: string; concern: string; threshold_or_limit: string | null; refs: number[] }[]; refs: number[] };
  refs: number[]; as_of: string;
  md: { method_as_chemistry: string; safety_summary: string; constituents_of_concern: string[]; formed_or_lost: { change: string; why: string }[] };
  terms: string[]; cited_refs: number[];
}

export interface TourStep { title: string; route: string; text: string; source: string }
export interface Tour { id: string; title: string; subtitle: string; minutes: number; steps: TourStep[]; quiz_from: string }

/* ── slim indexes */

export interface TermShort { id: string; term: string; kind: GlossaryEntry['kind']; short: string; concept: string | null }
export interface ConceptMeta { id: string; title: string; one_liner: string; prerequisites: string[]; figures: string[]; terms: string[]; self_check: SelfCheck[] }
export interface SectionMeta { id: string; title: string; depth: number; number: string | null; words: number; figures: string[]; synthesis_blocks: number }
export interface FigureMeta {
  id: string; label: string; title: string; kind: Figure['kind']; synthesis: 'data' | 'conceptual' | null; image: string | null;
  provenance: string; concepts: string[]; refs: number[]; rows: number | null; fields: number | null; has_chart: boolean;
}
