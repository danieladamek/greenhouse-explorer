/**
 * The basis rule (KICKOFF §1, §4b; requirements §5.6), in one place so the content build, every rendering path and
 * the tests agree.
 *
 *  - An amount never loses its basis: every rendering of an occurrence value goes through `formatAmount`, which
 *    always returns the unit and the basis together, or "reported present" / the qualitative statement, or
 *    "basis not stated in source".
 *  - `unstated` and `presence_only` rows never reach a quantitative view (`isQuantitative`).
 *  - Different bases are never plotted together; neither are different units within one basis, because putting
 *    ppm next to % would be a conversion the app does not make (`chartPlan` refuses and says why).
 *  - Values are never averaged and never converted. A range stays a range; a one-sided bound ("up to 6",
 *    "max 3500") and a value with two chemotype ranges are shown in tables and left out of charts, with a reason.
 */

export const BASES = ['fresh_weight', 'dry_weight', 'essential_oil_pct', 'per_g_extract', 'unstated', 'presence_only'] as const;
export type Basis = (typeof BASES)[number];
export const QUANT_BASES: readonly Basis[] = ['fresh_weight', 'dry_weight', 'essential_oil_pct', 'per_g_extract'];

export const BASIS_LABEL: Record<Basis, string> = {
  fresh_weight: 'fresh weight',
  dry_weight: 'dry weight',
  essential_oil_pct: 'share of the essential oil',
  per_g_extract: 'per gram of extract',
  unstated: 'basis not stated in source',
  presence_only: 'presence only',
};

/** Short chip text for tables. */
export const BASIS_SHORT: Record<Basis, string> = {
  fresh_weight: 'FW',
  dry_weight: 'DW',
  essential_oil_pct: 'of oil',
  per_g_extract: 'of extract',
  unstated: 'basis not stated',
  presence_only: 'presence only',
};

export interface AmountRow {
  value: number | string | null;
  unit: string | null;
  basis: Basis;
}

export function isQuantitative(b: Basis): boolean {
  return (QUANT_BASES as readonly string[]).includes(b);
}

/** Parsed numeric content of a value, or the reason it is not chartable. */
export type Parsed =
  | { kind: 'point'; lo: number; hi: number }
  | { kind: 'range'; lo: number; hi: number }
  | { kind: 'bound' | 'composite' | 'text' | 'none'; reason: string };

const NUM = String.raw`-?\d+(?:\.\d+)?`;

export function parseValue(value: number | string | null): Parsed {
  if (value === null || value === undefined) return { kind: 'none', reason: 'no value (presence only)' };
  if (typeof value === 'number') return { kind: 'point', lo: value, hi: value };
  const v = value.trim();
  if (new RegExp(`^${NUM}$`).test(v)) { const n = Number(v); return { kind: 'point', lo: n, hi: n }; }
  const r = new RegExp(`^(${NUM})\\s*[-–]\\s*(${NUM})$`).exec(v);
  if (r) { const a = Number(r[1]); const b = Number(r[2]); return { kind: 'range', lo: Math.min(a, b), hi: Math.max(a, b) }; }
  // mean ± SD is shown as written; the mean is the published point, the SD is not turned into a range
  const pm = new RegExp(`^(${NUM})\\s*±\\s*(${NUM})$`).exec(v);
  if (pm) { const n = Number(pm[1]); return { kind: 'point', lo: n, hi: n }; }
  if (/;/.test(v)) return { kind: 'composite', reason: 'several ranges (e.g. per chemotype) — see the table' };
  if (/^(up to|max(imum)?|min(imum)?|about|at least|not more than|<|>|≤|≥)/i.test(v)) return { kind: 'bound', reason: 'a bound or approximate value, not a measured amount — see the table' };
  return { kind: 'text', reason: 'not a number — see the table' };
}

/** The one formatter. Unit and basis always travel with the number. */
export function formatAmount(row: AmountRow): { amount: string; basis: string; quantitative: boolean } {
  if (row.basis === 'presence_only') {
    // a qualitative statement (e.g. "not detected") is rendered verbatim, never as "reported present"
    const text = row.value === null ? 'reported present' : String(row.value);
    return { amount: text, basis: BASIS_LABEL.presence_only, quantitative: false };
  }
  const val = row.value === null ? 'value not given' : String(row.value);
  const unit = row.unit ?? 'unit not given';
  if (row.basis === 'unstated') return { amount: `${val} ${unit}`, basis: BASIS_LABEL.unstated, quantitative: false };
  return { amount: `${val} ${unit}`, basis: BASIS_LABEL[row.basis], quantitative: true };
}

/** Plain-text form used in tooltips, aria labels and exports. */
export function amountText(row: AmountRow): string {
  const f = formatAmount(row);
  if (row.basis === 'presence_only') return `${f.amount} (${f.basis})`;
  return `${f.amount} — ${f.basis}`;
}

export interface ChartableRow extends AmountRow { id: string }

export type ChartPlan<T extends ChartableRow> =
  | { ok: true; basis: Basis; panels: { unit: string; rows: (T & { lo: number; hi: number; range: boolean })[] }[]; excluded: { row: T; reason: string }[] }
  | { ok: false; reason: 'none' | 'mixed'; bases: Basis[]; excluded: { row: T; reason: string }[] };

/**
 * Decide what a quantitative view may draw. `unstated` and `presence_only` rows are always excluded (and listed).
 * If the remaining rows span more than one basis and none was chosen, the answer is a refusal. Within one basis,
 * rows are split into one panel per unit — never converted.
 */
export function chartPlan<T extends ChartableRow>(rows: T[], chosen?: Basis | null): ChartPlan<T> {
  const excluded: { row: T; reason: string }[] = [];
  const quant: T[] = [];
  for (const r of rows) {
    if (r.basis === 'unstated') excluded.push({ row: r, reason: 'basis not stated in source — never charted' });
    else if (r.basis === 'presence_only') excluded.push({ row: r, reason: 'presence only — no amount to chart' });
    else quant.push(r);
  }
  const bases = [...new Set(quant.map((r) => r.basis))];
  let pool = quant;
  if (chosen) {
    pool = quant.filter((r) => r.basis === chosen);
    for (const r of quant) if (r.basis !== chosen) excluded.push({ row: r, reason: `different basis (${BASIS_LABEL[r.basis]})` });
  } else if (bases.length > 1) {
    return { ok: false, reason: 'mixed', bases, excluded };
  }
  const basis = chosen ?? bases[0];
  if (!basis || !pool.length) return { ok: false, reason: 'none', bases, excluded };
  const byUnit = new Map<string, (T & { lo: number; hi: number; range: boolean })[]>();
  for (const r of pool) {
    const p = parseValue(r.value);
    if (p.kind !== 'point' && p.kind !== 'range') { excluded.push({ row: r, reason: p.reason }); continue; }
    const unit = r.unit ?? '';
    if (!byUnit.has(unit)) byUnit.set(unit, []);
    byUnit.get(unit)!.push({ ...r, lo: p.lo, hi: p.hi, range: p.kind === 'range' });
  }
  const panels = [...byUnit.entries()].map(([unit, rs]) => ({ unit, rows: rs }));
  if (!panels.length) return { ok: false, reason: 'none', bases, excluded };
  return { ok: true, basis, panels, excluded };
}
