import { conceptsIndex, figuresIndex, sectionsIndex } from '@/lib/data';
import { loadCompounds, loadGlossary, loadPreparations, loadReferences, loadTaxa } from '@/lib/heavy';
import type { AnchorIndex, Labelled } from '@/lib/notepad';

let cached: Promise<AnchorIndex> | null = null;
/** The ids notes can anchor to, from the current build. Built lazily (the full files are separate chunks). */
export function loadAnchorIndex(): Promise<AnchorIndex> {
  if (!cached) cached = Promise.all([loadGlossary(), loadReferences(), loadCompounds(), loadTaxa(), loadPreparations()]).then(([glossary, refs, compounds, taxa, preps]) => {
    const m = <T,>(xs: T[], key: (x: T) => string, val: (x: T) => Labelled) => new Map(xs.map((x) => [key(x), val(x)]));
    return {
      sections: sectionsIndex.map((s) => ({ id: s.id, title: s.title, number: s.number })),
      terms: m(glossary, (t) => t.id, (t) => ({ label: t.term, sections: t.appears_in })),
      concepts: m(conceptsIndex, (c) => c.id, (c) => ({ label: c.title, sections: [] })),
      compounds: m(compounds, (c) => c.id, (c) => ({ label: c.name, sections: c.primer_sections })),
      taxa: m(taxa, (t) => t.id, (t) => ({ label: t.accepted_name, sections: t.primer_sections })),
      preparations: m(preps, (p) => p.id, (p) => ({ label: p.name, sections: [] })),
      figures: m(figuresIndex, (f) => f.id, (f) => ({ label: `${f.label} · ${f.title}`, sections: [] })),
      refs: new Map(refs.map((r) => [r.n, { label: r.citation, sections: r.cited_in }])),
    };
  });
  return cached;
}
