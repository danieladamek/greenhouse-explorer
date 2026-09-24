/**
 * /compounds filter state (feature A2): every filter lives in the URL, so a view can be shared and reloading the
 * URL restores it. Pure, so the unit tests and the detail page's prev/next (feature B4) use the same logic.
 */
import type { CompoundMeta } from '@/types';
import { getTaxonMeta } from '@/lib/data';

export interface CompoundFilters {
  q: string;
  classes: string[];
  families: string[];
  plants: string[];
  parts: string[];
  basis: string[];
  human: boolean;
  safety: boolean;
  aux: boolean;
  sort: 'name' | 'class' | 'plants';
  dir: 'asc' | 'desc';
}

const list = (p: URLSearchParams, k: string) => (p.get(k) ?? '').split(',').filter(Boolean);

export function paramsToFilters(p: URLSearchParams): CompoundFilters {
  const sort = p.get('sort');
  return {
    q: p.get('q') ?? '',
    classes: list(p, 'classes'),
    families: list(p, 'families'),
    plants: list(p, 'plants'),
    parts: list(p, 'parts'),
    basis: list(p, 'basis'),
    human: p.get('human') === '1',
    safety: p.get('safety') === '1',
    aux: p.get('aux') === '1',
    sort: sort === 'class' || sort === 'plants' ? sort : 'name',
    dir: p.get('dir') === 'desc' ? 'desc' : 'asc',
  };
}

export function filtersToParams(f: CompoundFilters): URLSearchParams {
  const p = new URLSearchParams();
  if (f.q) p.set('q', f.q);
  for (const k of ['classes', 'families', 'plants', 'parts', 'basis'] as const) if (f[k].length) p.set(k, f[k].join(','));
  if (f.human) p.set('human', '1');
  if (f.safety) p.set('safety', '1');
  if (f.aux) p.set('aux', '1');
  if (f.sort !== 'name') p.set('sort', f.sort);
  if (f.dir !== 'asc') p.set('dir', f.dir);
  return p;
}

/** Family of a compound = the families of the plants it is recorded in (a compound can belong to several). */
export function familiesOf(c: CompoundMeta): string[] {
  return [...new Set(c.taxa.map((t) => getTaxonMeta(t)?.family).filter((x): x is string => !!x).map((f) => f.toLowerCase()))];
}

export function applyFilters(all: CompoundMeta[], f: CompoundFilters): CompoundMeta[] {
  const q = f.q.trim().toLowerCase();
  const out = all.filter((c) =>
    (f.aux || !c.auxiliary)
    && (!q || [c.name, ...c.synonyms, c.formula ?? '', c.inchikey ?? '', c.class, c.subclass].join(' ').toLowerCase().includes(q))
    && (!f.classes.length || f.classes.includes(c.class))
    && (!f.families.length || familiesOf(c).some((x) => f.families.includes(x)))
    && (!f.plants.length || c.taxa.some((t) => f.plants.includes(t)))
    && (!f.parts.length || c.parts.some((p) => f.parts.includes(p)))
    && (!f.basis.length || c.bases.some((b) => f.basis.includes(b)))
    && (!f.human || c.has_human_evidence)
    && (!f.safety || c.safety_flags > 0));
  const key = (c: CompoundMeta) => (f.sort === 'class' ? `${c.class} ${c.name}` : f.sort === 'plants' ? String(100 - c.taxa.length).padStart(3, '0') + c.name : c.name.replace(/^[()+\-−αβγ,\d]+-?/, ''));
  out.sort((a, b) => key(a).localeCompare(key(b)));
  if (f.dir === 'desc') out.reverse();
  return out;
}
