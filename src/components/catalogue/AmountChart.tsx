import { useRef, useState } from 'react';
import { scaleLinear } from 'd3-scale';
import { BASIS_LABEL, BASES, chartPlan, type Basis } from '@/lib/basis';
import { classMeta, familyColour } from '@/lib/data';
import type { OccurrenceRow } from '@/types';
import { downloadSvg } from '@/components/figures/download';
import { BasisChip } from './Chips';

type Row = OccurrenceRow & { id: string };

/**
 * The only quantitative view of occurrence rows (KICKOFF §4b /compare, requirements §5.6). It goes through
 * `chartPlan`, which excludes `unstated` and `presence_only` rows, refuses a mix of bases unless one is chosen, and
 * splits one basis into one panel per unit. Ranges are drawn as ranges and points as points; nothing is averaged.
 */
export default function AmountChart({ rows, basis, onBasis, label, colourBy }: {
  rows: OccurrenceRow[]; basis: Basis | null; onBasis: (b: Basis | null) => void; label: (r: OccurrenceRow) => string; colourBy: 'compound' | 'taxon';
}) {
  const withId: Row[] = rows.map((r) => ({ ...r, id: r.row }));
  const plan = chartPlan(withId, basis);
  const available = BASES.filter((b) => rows.some((r) => r.basis === b));
  const quantBases = available.filter((b) => b !== 'unstated' && b !== 'presence_only');
  return (
    <div data-testid="amount-chart">
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-sm">
          <span className="block text-[11px] font-semibold tracking-[0.15em] bx-muted">BASIS — WHAT IS BEING CHARTED</span>
          <select className="bx-input !w-auto mt-1" value={basis ?? ''} onChange={(e) => onBasis((e.target.value || null) as Basis | null)} data-testid="basis-select">
            <option value="">{quantBases.length > 1 ? '— choose one basis —' : quantBases.length === 1 ? `${BASIS_LABEL[quantBases[0]]} (the only one)` : 'no quantitative basis'}</option>
            {quantBases.map((b) => <option key={b} value={b}>{BASIS_LABEL[b]} ({rows.filter((r) => r.basis === b).length} rows)</option>)}
          </select>
        </label>
        <p className="text-xs bx-muted max-w-xl">Rows whose basis is not stated, and rows that only report presence, are never charted. Values are never converted between bases or units.</p>
      </div>
      {!plan.ok && plan.reason === 'mixed' && (
        <div className="mt-3 bx-card p-4 border-l-4 border-l-[color:var(--bx-accent)]" role="status" data-testid="basis-refusal">
          <p className="font-semibold">No chart: these rows are measured on different bases.</p>
          <p className="text-sm mt-1">
            The selection mixes {plan.bases.map((b, i) => <span key={b}>{i ? (i === plan.bases.length - 1 ? ' and ' : ', ') : ''}<BasisChip basis={b} /></span>)}.
            A share of an essential oil, a content per dry weight and an amount per gram of extract measure different things, and this site never converts one into another — so they are not drawn on one axis.
            Choose one basis above to chart its rows; every row, on every basis, stays in the tables below.
          </p>
        </div>
      )}
      {!plan.ok && plan.reason === 'none' && (
        <p className="mt-3 text-sm bx-card p-3" role="status" data-testid="no-quant">No chartable rows{basis ? ` on the basis “${BASIS_LABEL[basis]}”` : ''}: the rows here are presence-only, have no stated basis, or give bounds rather than values. They are all in the tables below.</p>
      )}
      {plan.ok && (
        <div className="mt-3 grid gap-4">
          <p className="text-sm">Charting <BasisChip basis={plan.basis} />{plan.panels.length > 1 && <> in {plan.panels.length} panels, one per unit — the units differ and are not converted</>}.</p>
          {plan.panels.map((p) => <Panel key={p.unit} unit={p.unit} basis={plan.basis} rows={p.rows} label={label} colourBy={colourBy} />)}
        </div>
      )}
      {plan.excluded.length > 0 && (
        <details className="mt-3 text-sm">
          <summary className="cursor-pointer bx-muted">{plan.excluded.length} row{plan.excluded.length === 1 ? '' : 's'} not charted, and why</summary>
          <ul className="mt-1 grid gap-1 text-xs">{plan.excluded.map((e) => <li key={e.row.row}>{label(e.row)} — {e.row.value ?? 'no value'} {e.row.unit ?? ''}: {e.reason}</li>)}</ul>
        </details>
      )}
    </div>
  );
}

function Panel({ unit, basis, rows, label, colourBy }: { unit: string; basis: Basis; rows: (Row & { lo: number; hi: number; range: boolean })[]; label: (r: OccurrenceRow) => string; colourBy: 'compound' | 'taxon' }) {
  const ref = useRef<SVGSVGElement>(null);
  const [focus, setFocus] = useState<string | null>(null);
  const LW = 230; const W = 720; const RH = 26; const top = 26; const H = top + rows.length * RH + 34;
  const scale = scaleLinear().domain([0, Math.max(...rows.map((r) => r.hi)) || 1]).range([LW, W - 36]).nice(5);
  const x = (v: number) => scale(v);
  const ticks = scale.ticks(5);
  const fmt = (v: number) => (v >= 1000 ? v.toLocaleString('en', { maximumFractionDigits: 0 }) : String(Math.round(v * 100) / 100));
  const colour = (r: OccurrenceRow) => (colourBy === 'compound' ? classMeta(r.class).color : familyColour(r.family));
  const title = `Published amounts — ${BASIS_LABEL[basis]}, ${unit}`;
  return (
    <figure className="bx-card p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <figcaption className="text-sm font-semibold">{title}</figcaption>
        <button type="button" className="bx-btn !py-0.5 !text-xs" onClick={() => ref.current && downloadSvg(ref.current, `amounts-${basis}-${unit.replace(/\W+/g, '')}.svg`)}>Download SVG</button>
      </div>
      <div className="overflow-x-auto">
        <svg ref={ref} viewBox={`0 0 ${W} ${H}`} className="w-full min-w-[520px] text-ink dark:text-night-ink" role="img" aria-label={`${title}. ${rows.map((r) => `${label(r)}: ${r.value} ${r.unit}`).join('; ')}`} style={{ fontFamily: 'inherit' }}>
          <title>{title}</title>
          {ticks.map((t, i) => (
            <g key={i}>
              <line x1={x(t)} x2={x(t)} y1={top - 6} y2={H - 28} stroke="currentColor" strokeOpacity={0.15} />
              <text x={x(t)} y={H - 12} fontSize={11} textAnchor="middle" fill="currentColor" opacity={0.75}>{fmt(t)}</text>
            </g>
          ))}
          <text x={W - 20} y={top - 10} fontSize={11} textAnchor="end" fill="currentColor" opacity={0.75}>{unit} · {BASIS_LABEL[basis]}</text>
          {rows.map((r, i) => {
            const y = top + i * RH + RH / 2;
            const c = colour(r);
            const text = `${label(r)}: ${r.value} ${r.unit} (${BASIS_LABEL[basis]}) — ${r.plant_part ?? 'part not stated'}; ${r.level === 'cultivar' ? `cultivar ${r.cultivar}` : 'species-level'}; source: ${r.source_citation}`;
            const hot = focus === r.row;
            return (
              <g key={r.row} tabIndex={0} role="img" aria-label={text} onMouseEnter={() => setFocus(r.row)} onMouseLeave={() => setFocus(null)} onFocus={() => setFocus(r.row)} onBlur={() => setFocus(null)} data-testid="chart-row">
                <title>{text}</title>
                {hot && <rect x={0} y={y - RH / 2} width={W} height={RH} fill="currentColor" opacity={0.06} />}
                <text x={LW - 8} y={y + 4} fontSize={12} textAnchor="end" fill="currentColor">{label(r).length > 34 ? `${label(r).slice(0, 32)}…` : label(r)}</text>
                {r.range
                  ? <rect x={x(r.lo)} y={y - 6} width={Math.max(2, x(r.hi) - x(r.lo))} height={12} rx={3} fill={c} fillOpacity={0.55} stroke={c} />
                  : <circle cx={x(r.lo)} cy={y} r={5.5} fill={c} stroke="currentColor" strokeOpacity={0.4} />}
                {/* value label to the right of the mark; when the mark reaches the right edge, inside its end, haloed */}
                {(() => { const edge = x(r.hi) + 8 > W - 110; return <text x={edge ? x(r.hi) - 4 : x(r.hi) + 8} y={y + 4} fontSize={11} fontWeight={edge ? 600 : 400} fill="currentColor" textAnchor={edge ? 'end' : 'start'} paintOrder="stroke" stroke="var(--bx-bg)" strokeWidth={3.5}>{String(r.value)}{!r.verified ? ' (unverified)' : ''}</text>; })()}
              </g>
            );
          })}
        </svg>
      </div>
      {focus && <p className="text-xs mt-1" aria-live="polite">{(() => { const r = rows.find((x) => x.row === focus)!; return `${label(r)}: ${r.value} ${r.unit} · ${r.plant_part ?? ''} · ${r.source_citation}`; })()}</p>}
      <p className="text-xs bx-muted mt-1">Bars are published ranges; dots are single published values (a mean ± SD is drawn at its mean — the table keeps the SD). Values describe the studied plants, not the greenhouse's.</p>
    </figure>
  );
}
