import { useEffect, useState } from 'react';
import type { Compound, Concept, Figure, GlossaryEntry, OccurrenceRow, Planting, Preparation, Reference, Section, StructureDetail, Taxon, TodoItem, BuildError, SynthesisPassage } from '@/types';
import type scopeJson from '@/data/scope.json';
import type structuresJson from '@/data/structures.json';
import { assetUrl } from '@/lib/data';

/** Full data files as separate chunks in dist/ (still no runtime fetch of anything outside the app). */
const cache = new Map<string, Promise<unknown>>();
function once<T>(key: string, load: () => Promise<T>): Promise<T> {
  if (!cache.has(key)) cache.set(key, load());
  return cache.get(key) as Promise<T>;
}
export const loadGlossary = () => once('glossary', () => import('@/data/glossary.json').then((m) => m.default as unknown as GlossaryEntry[]));
export const loadConcepts = () => once('concepts', () => import('@/data/concepts.json').then((m) => m.default as unknown as Concept[]));
export const loadFigures = () => once('figures', () => import('@/data/figures.json').then((m) => m.default as unknown as Figure[]));
export const loadSections = () => once('sections', () => import('@/data/sections.json').then((m) => m.default as unknown as Section[]));
export const loadReferences = () => once('references', () => import('@/data/references.json').then((m) => m.default as unknown as Reference[]));
export const loadCompounds = () => once('compounds', () => import('@/data/compounds.json').then((m) => m.default as unknown as Compound[]));
export const loadOccurrences = () => once('occurrences', () => import('@/data/occurrence-rows.json').then((m) => m.default as unknown as OccurrenceRow[]));
export const loadTaxa = () => once('taxa', () => import('@/data/taxa.json').then((m) => m.default as unknown as Taxon[]));
export const loadPlantings = () => once('plantings', () => import('@/data/plantings.json').then((m) => m.default as unknown as { inventory_date: string; rows: Planting[] }));
export const loadPreparations = () => once('preparations', () => import('@/data/preparations.json').then((m) => m.default as unknown as Preparation[]));
export const loadScope = () => once('scope', () => import('@/data/scope.json').then((m) => m.default as typeof scopeJson));
export const loadTodo = () => once('todo', () => import('@/data/todo.json').then((m) => m.default as unknown as TodoItem[]));
export const loadBuildErrors = () => once('build-errors', () => import('@/data/build-errors.json').then((m) => m.default as unknown as BuildError[]));
export const loadSynthesis = () => once('synthesis', () => import('@/data/synthesis.json').then((m) => m.default as unknown as SynthesisPassage[]));
export const loadStructureSummary = () => once('structures', () => import('@/data/structures.json').then((m) => m.default as typeof structuresJson));

/** One record's own data file (src/data/records/…), so a record page does not load the whole catalogue. */
const compoundRecords = import.meta.glob<{ default: CompoundRecordFile }>('../data/records/compounds/*.json');
const taxonRecords = import.meta.glob<{ default: TaxonRecordFile }>('../data/records/taxa/*.json');
export interface CompoundRecordFile { compound: Compound; rows: OccurrenceRow[]; preparations: { id: string; name: string }[] }
export interface TaxonRecordFile { taxa: Taxon[]; rows: OccurrenceRow[]; plantings: Planting[]; preparations: { id: string; name: string }[] }
export const loadCompoundRecord = (id: string) => once(`c:${id}`, () => { const f = compoundRecords[`../data/records/compounds/${id}.json`]; return f ? f().then((m) => m.default) : Promise.resolve(null); });
export const loadTaxonRecord = (id: string) => once(`t:${id}`, () => { const f = taxonRecords[`../data/records/taxa/${id}.json`]; return f ? f().then((m) => m.default) : Promise.resolve(null); });

/** Per-atom detail for one structure: a static file in dist/structures/data/, built by scripts/build-data.py. */
export const loadStructureDetail = (path: string) => once(`detail:${path}`, () => fetch(assetUrl(path)).then((r) => { if (!r.ok) throw new Error(String(r.status)); return r.json() as Promise<StructureDetail>; }));

/** Resolve a loader into state; `undefined` while loading. */
export function useAsync<T>(load: () => Promise<T>): T | undefined {
  const [v, setV] = useState<T | undefined>(undefined);
  useEffect(() => { let live = true; load().then((x) => { if (live) setV(x); }); return () => { live = false; }; }, [load]);
  return v;
}
