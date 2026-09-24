import searchJson from '@/data/search.json';

export interface SearchHit { kind: 'term' | 'concept' | 'compound' | 'plant' | 'preparation' | 'figure' | 'section'; id: string; title: string; subtitle: string; to: string }

/** Built at content-build time (terms + variants, 101s, compounds, plants, preparations, figures, sections); lives in the lazy search chunk. */
const INDEX = searchJson as (SearchHit & { hay: string })[];

export function search(q: string, limit = 12): SearchHit[] {
  const query = q.trim().toLowerCase();
  if (!query) return [];
  const words = query.split(/\s+/);
  const scored = INDEX.map((e) => {
    let score = 0;
    const title = e.title.toLowerCase();
    if (title === query) score += 100;
    else if (title.startsWith(query)) score += 60;
    else if (title.includes(query)) score += 40;
    for (const w of words) if (e.hay.includes(w)) score += 10;
    return { e, score };
  }).filter((x) => x.score > 0).sort((a, b) => b.score - a.score || a.e.title.localeCompare(b.e.title));
  return scored.slice(0, limit).map(({ e }) => ({ kind: e.kind, id: e.id, title: e.title, subtitle: e.subtitle, to: e.to }));
}
