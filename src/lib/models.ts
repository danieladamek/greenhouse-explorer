/**
 * Page models for plant pages, pure so the unit tests can prove every taxon record yields a page and the
 * unresolved skullcap entry yields two candidate panels (KICKOFF §5).
 */
import type { OccurrenceRow, Taxon } from '@/types';

export type PlantPageKind = 'profiled' | 'stub' | 'unresolved';

export interface PlantPageModel {
  id: string;
  kind: PlantPageKind;
  title: string;
  candidates: Taxon[];
  rows: OccurrenceRow[];
  hasSafety: boolean;
}

export function plantPageModel(t: Taxon, all: Taxon[], rows: OccurrenceRow[]): PlantPageModel {
  const kind: PlantPageKind = t.identity_status === 'unresolved' && (t.candidates?.length ?? 0) >= 2 ? 'unresolved' : t.profiled ? 'profiled' : 'stub';
  const candidates = kind === 'unresolved' ? (t.candidates ?? []).map((c) => all.find((x) => x.id === c)).filter((x): x is Taxon => !!x) : [];
  return {
    id: t.id,
    kind,
    title: t.accepted_name,
    candidates,
    rows: rows.filter((r) => r.taxon_id === t.id),
    hasSafety: !!t.safety_evidence,
  };
}

/** Compound × taxon matrix for a set of taxa: one row per compound found in any of them, cells keep every row. */
export function compoundMatrix(taxa: string[], rows: OccurrenceRow[]) {
  const mine = rows.filter((r) => taxa.includes(r.taxon_id));
  const compounds = [...new Set(mine.map((r) => r.compound_id))];
  const cells = compounds.map((c) => ({
    compound_id: c,
    compound: mine.find((r) => r.compound_id === c)!.compound,
    by: Object.fromEntries(taxa.map((t) => [t, mine.filter((r) => r.compound_id === c && r.taxon_id === t)])) as Record<string, OccurrenceRow[]>,
  }));
  const shared = cells.filter((x) => taxa.every((t) => x.by[t].length > 0)).map((x) => x.compound_id);
  // shared first, then by how many taxa carry it, then alphabetically
  cells.sort((a, b) => Number(shared.includes(b.compound_id)) - Number(shared.includes(a.compound_id))
    || taxa.filter((t) => b.by[t].length).length - taxa.filter((t) => a.by[t].length).length || a.compound.localeCompare(b.compound));
  return { cells, shared, distinct: Object.fromEntries(taxa.map((t) => [t, cells.filter((x) => x.by[t].length && !shared.includes(x.compound_id)).map((x) => x.compound_id)])) as Record<string, string[]> };
}
