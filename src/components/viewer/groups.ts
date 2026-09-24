import type { Structure } from '@/types';

/** Categorical colours for functional-group highlights (independent of the family and class palettes). Ported from Bioactive Explorer; groups re-chosen for this catalogue's terpenoids, phenylpropanoids and flavones. */
export const GROUP_COLORS: Record<string, string> = {
  'phenol': '#f59f00',
  'catechol': '#e8590c',
  'pyrogallol': '#d6336c',
  'alcohol': '#228be6',
  'methoxy': '#15aabf',
  'ketone': '#7048e8',
  'aldehyde': '#ae3ec9',
  'carboxylic-acid': '#f03e3e',
  'ester': '#4c6ef5',
  'lactone': '#be4bdb',
  'glycoside': '#12b886',
  'allyl': '#82c91e',
  'isopropyl': '#40c057',
  'cinnamoyl': '#fd7e14',
  'chromone': '#fab005',
  'furan': '#20c997',
  'cis-alkene': '#868e96',
};

export interface Highlight { id: string; atoms: number[]; color: string }

/** Flatten the selected groups into per-group atom lists. */
export function highlightsFor(structure: Structure, active: string[]): Highlight[] {
  return structure.functionalGroups
    .filter((g) => active.includes(g.id))
    .map((g) => ({ id: g.id, atoms: [...new Set(g.matches.flat())], color: GROUP_COLORS[g.id] ?? '#999' }));
}

export function groupsOfAtom(structure: Structure, atomIndex: number): string[] {
  return structure.functionalGroups.filter((g) => g.matches.some((m) => m.includes(atomIndex))).map((g) => g.name);
}
