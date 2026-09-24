import manifestJson from '@/data/manifest.json';
import provenanceJson from '@/data/provenance.json';
import termsJson from '@/data/glossary-short.json';
import conceptsIndexJson from '@/data/concepts-index.json';
import figuresIndexJson from '@/data/figures-index.json';
import sectionsIndexJson from '@/data/sections-index.json';
import compoundsIndexJson from '@/data/compounds-index.json';
import taxaIndexJson from '@/data/taxa-index.json';
import familiesJson from '@/data/families.json';
import toursJson from '@/data/tours.json';
import type { CompoundMeta, ConceptMeta, FamilyIndex, FigureMeta, SectionMeta, TaxonMeta, TermShort, Tour } from '@/types';

/*
 * Only slim indexes are imported here (they ride in the first chunk). The full files — sections, glossary,
 * concepts, figures, references, compounds, occurrence rows, taxa, plantings, preparations, scope — are imported by
 * the routes that need them (src/lib/heavy.ts). Everything ships in dist/; nothing is fetched from anywhere else.
 */
export const manifest = manifestJson as typeof manifestJson & { builder: { name: string; version: string; date: string } };
export const provenance = provenanceJson;
export const SLUG: string = manifest.slug;
export const terms = termsJson as unknown as TermShort[];
export const conceptsIndex = conceptsIndexJson as unknown as ConceptMeta[];
export const figuresIndex = figuresIndexJson as unknown as FigureMeta[];
export const sectionsIndex = sectionsIndexJson as unknown as SectionMeta[];
export const compoundsIndex = compoundsIndexJson as unknown as CompoundMeta[];
export const taxaIndex = taxaIndexJson as unknown as TaxonMeta[];
export const families = familiesJson as unknown as FamilyIndex[];
export const tours = toursJson as unknown as Tour[];

const termById = new Map(terms.map((t) => [t.id, t]));
const conceptById = new Map(conceptsIndex.map((c) => [c.id, c]));
const figureById = new Map(figuresIndex.map((f) => [f.id, f]));
const sectionById = new Map(sectionsIndex.map((s) => [s.id, s]));
const compoundById = new Map(compoundsIndex.map((c) => [c.id, c]));
const taxonById = new Map(taxaIndex.map((t) => [t.id, t]));
const familyById = new Map(families.map((f) => [f.id, f]));
const tourById = new Map(tours.map((t) => [t.id, t]));

export const getTerm = (id?: string | null) => (id ? termById.get(id) : undefined);
export const getConcept = (id?: string | null) => (id ? conceptById.get(id) : undefined);
export const getFigure = (id?: string | null) => (id ? figureById.get(id) : undefined);
export const getSection = (id?: string | null) => (id ? sectionById.get(id) : undefined);
export const getCompoundMeta = (id?: string | null) => (id ? compoundById.get(id) : undefined);
export const getTaxonMeta = (id?: string | null) => (id ? taxonById.get(id) : undefined);
export const getFamily = (id?: string | null) => (id ? familyById.get(id.toLowerCase()) : undefined);
export const getTour = (id?: string | null) => (id ? tourById.get(id) : undefined);

/** Compounds shown in default lists (teucrin A is auxiliary and hidden unless asked for — feature D3). */
export const primaryCompounds = compoundsIndex.filter((c) => !c.auxiliary);

/** Reader sections in body order. */
export const bodySections = sectionsIndex;

export function assetUrl(rel: string): string {
  const base = import.meta.env.BASE_URL.endsWith('/') ? import.meta.env.BASE_URL : import.meta.env.BASE_URL + '/';
  return base + rel.replace(/^\//, '');
}

export const doiUrl = (doi: string) => (/^https?:/.test(doi) ? doi : `https://doi.org/${doi}`);

/* ── colour: botanical family (manifest.palette.groups) for taxa and, via palette_group, for compounds (E1) */
export const PALETTE: Record<string, string> = manifest.palette.groups;
export const familyColour = (family?: string | null) => (family && PALETTE[family.toLowerCase()]) || PALETTE.shared || '#6b6b6b';
export const colourForGroup = (group?: string | null) => (group && PALETTE[group]) || PALETTE.shared || '#6b6b6b';
export const colourForCompound = (id?: string | null) => colourForGroup(getCompoundMeta(id)?.palette_group);

/* ── compound classes: categorical colour + geometric icon, independent of the family palette (E1) */
export type IconShape = 'circle' | 'square' | 'diamond' | 'triangle' | 'triangleDown' | 'star' | 'pentagon' | 'hexagon' | 'plus' | 'halfCircle' | 'bar' | 'ring' | 'grid' | 'cross' | 'chevron';
export interface ClassMeta { id: string; label: string; color: string; icon: IconShape }
export const CLASSES: ClassMeta[] = [
  { id: 'monoterpene', label: 'Monoterpene', color: '#0c8599', icon: 'circle' },
  { id: 'monoterpenoid-ketone', label: 'Monoterpenoid ketone', color: '#1971c2', icon: 'square' },
  { id: 'sesquiterpene', label: 'Sesquiterpene', color: '#7048e8', icon: 'diamond' },
  { id: 'diterpene', label: 'Diterpene', color: '#66a80f', icon: 'plus' },
  { id: 'clerodane-diterpenoid', label: 'Clerodane diterpenoid', color: '#495057', icon: 'cross' },
  { id: 'triterpene', label: 'Triterpene', color: '#5c940d', icon: 'hexagon' },
  { id: 'phenylpropanoid', label: 'Phenylpropanoid', color: '#e8590c', icon: 'triangle' },
  { id: 'hydroxycinnamic-acid', label: 'Hydroxycinnamic acid', color: '#e03131', icon: 'star' },
  { id: 'coumarin', label: 'Coumarin', color: '#c2255c', icon: 'pentagon' },
  { id: 'flavone', label: 'Flavone', color: '#d4a017', icon: 'triangleDown' },
  { id: 'flavone-glycoside', label: 'Flavone glycoside', color: '#9c7a12', icon: 'halfCircle' },
  { id: 'flavone-glucuronide', label: 'Flavone glucuronide', color: '#b8860b', icon: 'grid' },
  { id: 'flavanone-glycoside', label: 'Flavanone glycoside', color: '#ae3ec9', icon: 'bar' },
  { id: 'flavanone-glucuronide', label: 'Flavanone glucuronide', color: '#862e9c', icon: 'ring' },
  { id: 'polyacetylene', label: 'Polyacetylene', color: '#868e96', icon: 'chevron' },
];
const classById = new Map(CLASSES.map((c) => [c.id, c]));
export const classMeta = (id: string): ClassMeta => classById.get(id) ?? { id, label: id, color: '#868e96', icon: 'circle' };

export const sectionTitle = (id: string) => getSection(id)?.title ?? getFigure(id)?.label ?? id;
export const shortSectionTitle = (s: { title: string }) => s.title.replace(/^\d+(\.\d+)*\.?\s+/, '');

/** The sweep date, shown on /, /read, /about and every profile (APP-SPEC §6.1 rule 9, KICKOFF §1). */
export const AS_OF: string = manifest.as_of ?? '';
export const asOfLong = (d = AS_OF): string => {
  const x = new Date(`${d}T00:00:00Z`);
  return Number.isNaN(x.getTime()) ? d : x.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
};
export const INVENTORY_DATE = '2025-10-25';

/** Italicised binomial helper: genus + epithet in italics, authority roman. */
export const taxonLabel = (id: string) => getTaxonMeta(id)?.accepted_name ?? id;
export const taxonCommon = (id: string) => getTaxonMeta(id)?.common_names[0] ?? '';

export const IDENTITY_LABEL: Record<string, string> = { confirmed: 'identity confirmed', check: 'identity to check', unresolved: 'identity unresolved' };
export const DEPTH_LABEL: Record<string, string> = { deep: 'deep profile', light: 'light profile', guest: 'guest profile', stub: 'profile in progress' };
export const COLUMN_LABEL: Record<string, string> = { leafy_greens: 'Leafy greens', veggies: 'Veggies', herbs: 'Herbs', medicinal: 'Medicinal' };

/** The two pre-built comparisons on / and /compare (KICKOFF §4f). */
export const PREBUILT = [
  { to: '/compare?ids=thymol,carvacrol,linalool', title: 'Thymol, carvacrol and linalool', blurb: 'Three monoterpenes of thyme, oregano and basil oils — charted on one basis, the share of the essential oil.' },
  { to: '/compare?plants=scutellaria-lateriflora,scutellaria-baicalensis', title: 'The two skullcaps', blurb: 'American and Chinese skullcap side by side: aerial parts against root, and what each record knows.' },
];

/** Design-system categorical slots (cat.*), for chart series that are not families or classes. */
export const CAT = ['#2a5aa6', '#7b2c5e', '#1f7a63', '#a85a1f', '#4a4a8a', '#8a6d1f'];
