/**
 * Catalogue rules (KICKOFF §5), run over the built data (src/data/*.json, written by `npm run build:content`):
 * no rendering path emits an occurrence value without unit and basis; mixed-basis comparison is refused;
 * unstated and presence-only rows never reach a chart; every evidence row renders grade + test article; all 47 taxa
 * produce a page model; the 91 plantings collapse onto their taxa; scutellaria-sp yields two candidates.
 */
import { describe, expect, it } from 'vitest';
import occurrenceRows from '../../src/data/occurrence-rows.json';
import compounds from '../../src/data/compounds.json';
import taxa from '../../src/data/taxa.json';
import plantings from '../../src/data/plantings.json';
import provenance from '../../src/data/provenance.json';
import { BASIS_LABEL, amountText, chartPlan, formatAmount, isQuantitative, parseValue, type Basis } from '../../src/lib/basis';
import { compoundMatrix, plantPageModel } from '../../src/lib/models';
import { applyFilters, filtersToParams, paramsToFilters } from '../../src/lib/filters';
import compoundsIndex from '../../src/data/compounds-index.json';
import { occurrenceCells } from '../../src/components/catalogue/OccurrenceTable';
import { evidenceRowsForRender } from '../../src/components/catalogue/EvidenceTable';
import type { CompoundMeta, EvidenceRow, OccurrenceRow, Taxon } from '../../src/types';

const rows = occurrenceRows as unknown as OccurrenceRow[];
const T = taxa as unknown as Taxon[];
const withId = rows.map((r) => ({ ...r, id: r.row }));

describe('amounts never lose their basis', () => {
  it('every occurrence row renders with its unit and its basis', () => {
    for (const r of rows) {
      const c = occurrenceCells(r);
      expect(c.basis, r.row).toBeTruthy();
      expect(c.basis).toBe(BASIS_LABEL[r.basis]);
      if (r.basis === 'presence_only') {
        // "reported present", or the qualitative statement as written — never a number
        expect(c.amount).not.toMatch(/\d/);
        if (r.value === null) expect(c.amount).toBe('reported present');
      } else {
        expect(r.unit, r.row).toBeTruthy();
        expect(c.amount.endsWith(String(r.unit)), r.row).toBe(true);
        expect(c.amount).toContain(String(r.value));
      }
      expect(amountText(r)).toContain(c.basis);
    }
  });
  it('unstated is labelled "basis not stated in source" and is never quantitative', () => {
    const u = rows.filter((r) => r.basis === 'unstated');
    expect(u.length).toBe(provenance.catalogue.occurrence_rows_by_basis.unstated);
    for (const r of u) { expect(formatAmount(r).basis).toBe('basis not stated in source'); expect(formatAmount(r).quantitative).toBe(false); }
  });
  it('the one qualitative presence row (teucrin A, "not detected") is not rendered as "reported present"', () => {
    const r = rows.find((x) => x.compound_id === 'teucrin-a' && x.taxon_id === 'scutellaria-lateriflora')!;
    expect(formatAmount(r).amount).toBe('not detected');
  });
  it('a range stays a range and bounds are not charted', () => {
    expect(parseValue('14000-593000')).toEqual({ kind: 'range', lo: 14000, hi: 593000 });
    expect(parseValue('up to 6').kind).toBe('bound');
    expect(parseValue('16.0-25.0 (Spanish type); 38.0-55.0 (Moroccan/Tunisian type)').kind).toBe('composite');
    expect(parseValue('11.7 ± 2.9')).toEqual({ kind: 'point', lo: 11.7, hi: 11.7 });
  });
});

describe('comparison refuses mixed bases', () => {
  it('a selection spanning two quantitative bases is refused without an explicit basis', () => {
    const sel = withId.filter((r) => ['rosmarinic-acid'].includes(r.compound_id));
    const bases = new Set(sel.filter((r) => isQuantitative(r.basis)).map((r) => r.basis));
    expect(bases.size).toBeGreaterThan(1);
    const plan = chartPlan(sel);
    expect(plan.ok).toBe(false);
    if (!plan.ok) expect(plan.reason).toBe('mixed');
  });
  it('choosing one basis charts only that basis, one panel per unit', () => {
    const sel = withId.filter((r) => r.compound_id === 'rosmarinic-acid');
    const plan = chartPlan(sel, 'dry_weight');
    expect(plan.ok).toBe(true);
    if (plan.ok) {
      for (const p of plan.panels) for (const r of p.rows) { expect(r.basis).toBe('dry_weight'); expect(r.unit).toBe(p.unit); }
      expect(new Set(plan.panels.map((p) => p.unit)).size).toBe(plan.panels.length);
    }
  });
  it('unstated and presence-only rows never reach a chart, whatever basis is chosen', () => {
    for (const b of [undefined, 'fresh_weight', 'dry_weight', 'essential_oil_pct', 'per_g_extract', 'unstated', 'presence_only'] as (Basis | undefined)[]) {
      const plan = chartPlan(withId, b);
      if (plan.ok) for (const p of plan.panels) for (const r of p.rows) expect(isQuantitative(r.basis)).toBe(true);
    }
    const onlyUnstated = chartPlan(withId.filter((r) => r.basis === 'unstated'));
    expect(onlyUnstated.ok).toBe(false);
  });
  it('the pre-built comparison thymol, carvacrol, linalool shares one basis and charts', () => {
    const plan = chartPlan(withId.filter((r) => ['thymol', 'carvacrol', 'linalool'].includes(r.compound_id)));
    expect(plan.ok).toBe(true);
    if (plan.ok) expect(plan.basis).toBe('essential_oil_pct');
  });
});

describe('evidence never loses its grade or its test article', () => {
  it('every compound and taxon evidence row renders grade and test article together', () => {
    const all: EvidenceRow[] = [
      ...(compounds as unknown as { evidence: EvidenceRow[] }[]).flatMap((c) => c.evidence),
      ...T.flatMap((t) => t.safety_evidence?.evidence ?? []),
    ];
    expect(all.length).toBe(provenance.catalogue.evidence_rows);
    const view = evidenceRowsForRender(all);
    expect(view.length).toBe(all.length);
    for (const r of view) { expect(r.grade).toMatch(/^[ABCDET]$/); expect(r.test_article).toBeTruthy(); expect(r.population).toBeTruthy(); }
  });
});

describe('taxa and plantings', () => {
  it('all 47 taxa produce a page model; stubs are stubs, the skullcap entry is unresolved', () => {
    expect(T).toHaveLength(47);
    const models = T.map((t) => plantPageModel(t, T, rows));
    expect(models.every((m) => ['profiled', 'stub', 'unresolved'].includes(m.kind))).toBe(true);
    expect(models.filter((m) => m.kind === 'stub')).toHaveLength(36);
    expect(plantPageModel(T.find((t) => t.id === 'lactuca-sativa')!, T, rows).kind).toBe('stub');
  });
  it('scutellaria-sp yields two candidate models, the two skullcap species', () => {
    const m = plantPageModel(T.find((t) => t.id === 'scutellaria-sp')!, T, rows);
    expect(m.kind).toBe('unresolved');
    expect(m.candidates.map((c) => c.id)).toEqual(['scutellaria-lateriflora', 'scutellaria-baicalensis']);
    const matrix = compoundMatrix(m.candidates.map((c) => c.id), rows);
    expect(matrix.shared).toContain('baicalin');
  });
  it('the 91 plantings collapse onto the taxon records (45 planted taxa + the 2 unplanted candidates = 47)', () => {
    const p = (plantings as { rows: { id: string; taxon_id: string }[] }).rows;
    expect(p).toHaveLength(91);
    const planted = new Set(p.map((x) => x.taxon_id));
    expect(planted.size).toBe(45);
    for (const id of planted) expect(T.some((t) => t.id === id)).toBe(true);
    expect(T.filter((t) => !planted.has(t.id)).map((t) => t.id).sort()).toEqual(['scutellaria-baicalensis', 'scutellaria-lateriflora']);
    expect(T.reduce((a, t) => a + t.n_plantings, 0)).toBe(91);
  });
});

describe('compound filters live in the URL', () => {
  it('round-trips and hides the auxiliary record by default', () => {
    const f = paramsToFilters(new URLSearchParams('q=thym&classes=monoterpene&human=1&sort=class'));
    expect(paramsToFilters(filtersToParams(f))).toEqual(f);
    const all = compoundsIndex as unknown as CompoundMeta[];
    expect(applyFilters(all, paramsToFilters(new URLSearchParams()))).toHaveLength(48);
    expect(applyFilters(all, paramsToFilters(new URLSearchParams('aux=1')))).toHaveLength(49);
    expect(applyFilters(all, paramsToFilters(new URLSearchParams('q=CDOSHBSSFJOMGT'))).map((c) => c.id)).toEqual(['linalool']);
  });
});
