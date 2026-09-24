import { useRef, useState } from 'react';
// No <LabelList> anywhere: recharts 2.x renders it with a string ref, which React 18's StrictMode rejects
// outright — in a production build that kills the whole page rather than just the label. Every value it would
// have drawn is in the chart's tooltip and in the "every value with its own source" table under each figure.
import { Bar, BarChart, CartesianGrid, ErrorBar, Legend, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis, Line, LineChart, Area, AreaChart } from 'recharts';
import type { ChartSpec, Row } from '@/types';
import { CAT, PALETTE } from '@/lib/data';
import { downloadCsv, svgToPng } from './download';

interface Props { id: string; spec: ChartSpec; rows: Row[]; fields: string[]; inline?: boolean }

const num = (v: unknown) => (typeof v === 'number' ? v : v == null || v === '' ? null : Number.isFinite(Number(v)) ? Number(v) : null);
const SHAPES = ['■', '●', '▲', '◆', '▼', '★'];
const colour = (key: string, i: number) => PALETTE[key] ?? CAT[i % CAT.length];

function useChartFrame(id: string, rows: Row[], fields: string[]) {
  const ref = useRef<HTMLDivElement>(null);
  const png = () => { const svg = ref.current?.querySelector('svg'); if (svg) svgToPng(svg as SVGSVGElement, `${id}-chart.png`); };
  const csv = () => downloadCsv(rows, fields, `${id}-data.csv`);
  return { ref, png, csv };
}

function Downloads({ png, csv }: { png: () => void; csv: () => void }) {
  return <div className="ml-auto inline-flex gap-1 no-print"><button type="button" className="bx-btn" onClick={png}>PNG</button><button type="button" className="bx-btn" onClick={csv}>CSV</button></div>;
}

function ToggleLegend({ items, hidden, onToggle }: { items: { key: string; colour: string; shape: string }[]; hidden: Set<string>; onToggle: (k: string) => void }) {
  return (
    <ul className="flex flex-wrap gap-2 text-xs" aria-label="Series (click to show or hide)">
      {items.map((it) => (
        <li key={it.key}>
          <button type="button" className={`bx-btn !py-0.5 ${hidden.has(it.key) ? 'opacity-50 line-through' : ''}`} aria-pressed={!hidden.has(it.key)} onClick={() => onToggle(it.key)}>
            <span aria-hidden="true" style={{ color: it.colour }}>{it.shape}</span> {it.key}
          </button>
        </li>
      ))}
    </ul>
  );
}

/**
 * A logarithmic axis needs a real numeric domain: Recharts hands `'auto'` straight to d3's log scale, which then
 * generates ticks from an undefined interval and hangs the renderer. So the domain is computed from the data and
 * snapped out to the enclosing powers of ten. Values that a log axis cannot show (zero or negative) are ignored
 * here rather than silently shifted — this pack has none.
 */
function domainFor(a: ChartSpec['x'], values: number[]): [number | string, number | string] {
  if (a?.domain) return a.domain;
  if (a?.scale !== 'log') return ['auto', 'auto'];
  const positive = values.filter((v) => Number.isFinite(v) && v > 0);
  if (!positive.length) return ['auto', 'auto'];
  const lo = Math.pow(10, Math.floor(Math.log10(Math.min(...positive))));
  const hi = Math.pow(10, Math.ceil(Math.log10(Math.max(...positive))));
  return [lo, hi === lo ? lo * 10 : hi];
}

const axisProps = (a: ChartSpec['x'], values: number[]) => ({
  scale: (a?.scale === 'log' ? 'log' : 'auto') as 'log' | 'auto',
  domain: domainFor(a, values),
  allowDataOverflow: a?.scale === 'log',
});

const numbersIn = (rows: Row[], field: string): number[] => rows.map((r) => num(r[field])).filter((v): v is number => v !== null);

/** Scatter with optional log axes (fig4: onset against duration, three orders of magnitude). */
export function ScatterFigure({ id, spec, rows, fields, inline }: Props) {
  const xf = spec.x?.field ?? fields[0]; const yf = spec.y?.field ?? fields[1];
  const sf = typeof spec.series === 'string' ? spec.series : undefined;
  const series = sf ? [...new Set(rows.map((r) => String(r[sf])))] : ['all'];
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const { ref, png, csv } = useChartFrame(id, rows, fields);
  const labelField = fields.find((f) => ['label', 'compound', 'trial', 'study', 'name'].includes(f)) ?? fields[0];
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <ToggleLegend items={series.map((s, i) => ({ key: s, colour: colour(s, i), shape: SHAPES[i % SHAPES.length] }))} hidden={hidden} onToggle={(k) => setHidden((h) => { const n = new Set(h); if (n.has(k)) n.delete(k); else n.add(k); return n; })} />
        {!inline && <Downloads png={png} csv={csv} />}
      </div>
      <div ref={ref} className="mt-2" style={{ width: '100%', height: inline ? 320 : 420 }} role="img" aria-label={`Scatter plot of ${spec.y?.label ?? yf} against ${spec.x?.label ?? xf}${spec.x?.scale === 'log' ? ', both axes logarithmic' : ''}. Every point is listed with its source in the table below.`}>
        <ResponsiveContainer>
          <ScatterChart margin={{ top: 16, right: 20, left: 8, bottom: 24 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--bx-line)" />
            <XAxis type="number" dataKey={xf} {...axisProps(spec.x, numbersIn(rows, xf))} tick={{ fill: 'var(--bx-muted)', fontSize: 12 }} label={{ value: `${spec.x?.label ?? xf}${spec.x?.unit ? ` (${spec.x.unit})` : ''}`, position: 'insideBottom', offset: -12, fill: 'var(--bx-muted)', fontSize: 12 }} />
            <YAxis type="number" dataKey={yf} {...axisProps(spec.y, numbersIn(rows, yf))} tick={{ fill: 'var(--bx-muted)', fontSize: 12 }} label={{ value: `${spec.y?.label ?? yf}${spec.y?.unit ? ` (${spec.y.unit})` : ''}`, angle: -90, position: 'insideLeft', fill: 'var(--bx-muted)', fontSize: 12 }} />
            <ZAxis range={[80, 80]} />
            <Tooltip
              cursor={{ strokeDasharray: '3 3' }}
              contentStyle={{ background: 'var(--bx-bg)', border: '1px solid var(--bx-line)', borderRadius: 8, fontSize: 12, maxWidth: 320 }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const p = payload[0].payload as Row;
                return (
                  <div className="bx-card p-2 text-xs max-w-[20rem]">
                    <p className="font-semibold">{String(p[labelField] ?? '')}</p>
                    <p className="mt-0.5">{spec.x?.label ?? xf}: {String(p[xf])}{spec.x?.unit ? ` ${spec.x.unit}` : ''} · {spec.y?.label ?? yf}: {String(p[yf])}{spec.y?.unit ? ` ${spec.y.unit}` : ''}</p>
                    {p.note && <p className="mt-0.5 bx-muted">{String(p.note)}</p>}
                    {p.ref && <p className="mt-0.5 bx-muted">source: {String(p.ref)}</p>}
                  </div>
                );
              }}
            />
            <Legend content={() => null} />
            {series.map((s, i) => !hidden.has(s) && (
              <Scatter key={s} name={s} data={rows.filter((r) => (!sf || String(r[sf]) === s)).map((r) => ({ ...r, [xf]: num(r[xf]), [yf]: num(r[yf]) }))} fill={colour(s, i)} isAnimationActive={false} />
            ))}
          </ScatterChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-1 text-xs bx-muted">Hover or focus a point for its exact values, its note and the source it came from. Points are as each study published them and are never pooled.</p>
    </div>
  );
}

/** Bars, optionally on a log axis (fig8: 5-HT2B safety margins). */
export function BarFigure({ id, spec, rows, fields, inline }: Props) {
  const xf = spec.x?.field ?? fields[0]; const yf = spec.y?.field ?? fields[1];
  const { ref, png, csv } = useChartFrame(id, rows, fields);
  const data = rows.map((r) => ({ ...r, [yf]: num(r[yf]) }));
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-xs bx-muted">{spec.y?.scale === 'log' ? 'Logarithmic axis.' : ''}</p>
        {!inline && <Downloads png={png} csv={csv} />}
      </div>
      <div ref={ref} className="mt-2" style={{ width: '100%', height: inline ? 300 : 400 }} role="img" aria-label={`Bar chart of ${spec.y?.label ?? yf} by ${spec.x?.label ?? xf}. Exact values are in the table below.`}>
        <ResponsiveContainer>
          <BarChart data={data} margin={{ top: 16, right: 12, left: 8, bottom: 40 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--bx-line)" />
            <XAxis dataKey={xf} tick={{ fill: 'var(--bx-muted)', fontSize: 11 }} interval={0} angle={-25} textAnchor="end" height={60} label={{ value: spec.x?.label ?? xf, position: 'insideBottom', offset: -34, fill: 'var(--bx-muted)', fontSize: 12 }} />
            <YAxis {...axisProps(spec.y, numbersIn(rows, yf))} tick={{ fill: 'var(--bx-muted)', fontSize: 12 }} width={72} label={{ value: spec.y?.unit ?? '', angle: -90, position: 'insideLeft', fill: 'var(--bx-muted)', fontSize: 12 }} />
            <Tooltip
              cursor={{ fill: 'var(--bx-bg-2)' }}
              contentStyle={{ background: 'var(--bx-bg)', border: '1px solid var(--bx-line)', borderRadius: 8, fontSize: 12 }}
              formatter={(v: number) => [String(v), spec.y?.label ?? yf]}
            />
            <Bar dataKey={yf} fill={CAT[0]} isAnimationActive={false} radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-1 text-xs bx-muted">{spec.y?.label ?? yf}. Hover a bar for the exact value; every value came from the single source named under the figure.</p>
    </div>
  );
}

/**
 * Grouped bars (fig-extraction): one group per x value, one bar per series value (e.g. essential oil vs
 * polyphenols), a whisker where the source gives a range (`ci`). Every bar keeps its own row, so the tooltip shows
 * its measure, comparator, conditions and source exactly as the CSV records them.
 */
export function GroupedBarFigure({ id, spec, rows, fields, inline }: Props) {
  const xf = spec.x?.field ?? fields[0]; const yf = spec.y?.field ?? fields[1];
  const sf = typeof spec.series === 'string' ? spec.series : undefined;
  const series = sf ? [...new Set(rows.map((r) => String(r[sf])))] : [yf];
  const [lo, hi] = spec.ci ?? [undefined, undefined];
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const { ref, png, csv } = useChartFrame(id, rows, fields);
  const xs = [...new Set(rows.map((r) => String(r[xf])))];
  const data = xs.map((x) => {
    const o: Record<string, unknown> = { [xf]: x };
    for (const s of series) {
      const r = rows.find((row) => String(row[xf]) === x && (!sf || String(row[sf]) === s));
      const v = r ? num(r[yf]) : null;
      o[s] = v;
      o[`${s}__row`] = r ?? null;
      const l = r && lo ? num(r[lo]) : null; const h = r && hi ? num(r[hi]) : null;
      o[`${s}__err`] = v !== null && l !== null && h !== null ? [v - l, h - v] : null;
    }
    return o;
  });
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <ToggleLegend items={series.map((s, i) => ({ key: s, colour: colour(s, i), shape: SHAPES[i % SHAPES.length] }))} hidden={hidden} onToggle={(k) => setHidden((h) => { const n = new Set(h); if (n.has(k)) n.delete(k); else n.add(k); return n; })} />
        {!inline && <Downloads png={png} csv={csv} />}
      </div>
      <div ref={ref} className="mt-2" style={{ width: '100%', height: inline ? 320 : 420 }} role="img" aria-label={`Grouped bar chart of ${spec.y?.label ?? yf} by ${spec.x?.label ?? xf}, one bar per ${sf ?? 'series'}: ${series.join(', ')}. Exact values, ranges and sources are in the table below.`}>
        <ResponsiveContainer>
          <BarChart data={data} margin={{ top: 16, right: 12, left: 8, bottom: 24 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--bx-line)" />
            <XAxis dataKey={xf} tick={{ fill: 'var(--bx-muted)', fontSize: 12 }} interval={0} label={{ value: spec.x?.label ?? xf, position: 'insideBottom', offset: -14, fill: 'var(--bx-muted)', fontSize: 12 }} />
            <YAxis {...axisProps(spec.y, numbersIn(rows, yf))} tick={{ fill: 'var(--bx-muted)', fontSize: 12 }} width={56} label={{ value: spec.y?.unit ?? '', angle: -90, position: 'insideLeft', fill: 'var(--bx-muted)', fontSize: 12 }} />
            <Tooltip
              cursor={{ fill: 'var(--bx-bg-2)' }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                return (
                  <div className="bx-card p-2 text-xs max-w-[22rem] bg-paper dark:bg-night">
                    {payload.map((p) => {
                      const r = (p.payload as Record<string, Row | null>)[`${String(p.dataKey)}__row`];
                      if (!r) return null;
                      return (
                        <div key={String(p.dataKey)} className="mt-1 first:mt-0">
                          <p className="font-semibold">{String(r[xf])} · {String(p.dataKey)}: {String(r[yf])}{spec.y?.unit ? ` ${spec.y.unit}` : ''}{lo && r[lo] !== null && hi && r[hi] !== null ? ` (range ${String(r[lo])}–${String(r[hi])})` : ''}</p>
                          {r.measure && <p>{String(r.measure)}{r.comparator ? ` · compared with ${String(r.comparator)}` : ''}</p>}
                          {r.conditions && <p className="bx-muted">{String(r.conditions)}</p>}
                          {r.basis_note && <p className="bx-muted">{String(r.basis_note)}</p>}
                          {r.ref && <p className="bx-muted">source: [{String(r.ref)}]</p>}
                        </div>
                      );
                    })}
                  </div>
                );
              }}
            />
            <Legend content={() => null} />
            {series.map((s, i) => !hidden.has(s) && (
              <Bar key={s} dataKey={s} name={s} fill={colour(s, i)} isAnimationActive={false} radius={[3, 3, 0, 0]}>
                {lo && hi && <ErrorBar dataKey={`${s}__err`} width={6} stroke="var(--bx-ink)" strokeWidth={1.2} />}
              </Bar>
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-1 text-xs bx-muted">Bars grouped by {spec.x?.label?.toLowerCase() ?? xf}, one colour per {sf ?? 'series'}; whiskers show a published range and the bar its midpoint. A missing bar means no comparable value was found — it is not a zero. Hover a bar for its measure, comparator, conditions and source.</p>
    </div>
  );
}

/** Line / area fallbacks for any remaining chart type in the pack. */
export function LineFigure({ id, spec, rows, fields, inline }: Props) {
  const xf = spec.x?.field ?? fields[0]; const yf = spec.y?.field ?? fields[1];
  const sf = typeof spec.series === 'string' ? spec.series : undefined;
  const series = sf ? [...new Set(rows.map((r) => String(r[sf])))] : [yf];
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const { ref, png, csv } = useChartFrame(id, rows, fields);
  const xs = [...new Set(rows.map((r) => r[xf]))];
  const data = xs.map((x) => { const o: Record<string, unknown> = { [xf]: x }; for (const s of series) { const r = rows.find((row) => row[xf] === x && (!sf || String(row[sf]) === s)); o[s] = r ? num(r[sf ? yf : s]) : null; } return o; });
  const Chart = spec.type === 'area' ? AreaChart : LineChart;
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <ToggleLegend items={series.map((s, i) => ({ key: s, colour: colour(s, i), shape: SHAPES[i % SHAPES.length] }))} hidden={hidden} onToggle={(k) => setHidden((h) => { const n = new Set(h); if (n.has(k)) n.delete(k); else n.add(k); return n; })} />
        {!inline && <Downloads png={png} csv={csv} />}
      </div>
      <div ref={ref} className="mt-2" style={{ width: '100%', height: inline ? 300 : 380 }} role="img" aria-label={`${spec.type} chart of ${spec.y?.label ?? yf} by ${spec.x?.label ?? xf}`}>
        <ResponsiveContainer>
          <Chart data={data} margin={{ top: 16, right: 12, left: 4, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--bx-line)" />
            <XAxis dataKey={xf} tick={{ fill: 'var(--bx-muted)', fontSize: 12 }} label={{ value: spec.x?.label ?? xf, position: 'insideBottom', offset: -4, fill: 'var(--bx-muted)', fontSize: 12 }} />
            <YAxis {...axisProps(spec.y, numbersIn(rows, yf))} tick={{ fill: 'var(--bx-muted)', fontSize: 12 }} label={{ value: spec.y?.label ?? yf, angle: -90, position: 'insideLeft', fill: 'var(--bx-muted)', fontSize: 12 }} />
            <Tooltip contentStyle={{ background: 'var(--bx-bg)', border: '1px solid var(--bx-line)', borderRadius: 8, fontSize: 12 }} />
            {series.map((s, i) => !hidden.has(s) && (
              spec.type === 'area'
                ? <Area key={s} dataKey={s} stroke={colour(s, i)} fill={colour(s, i)} fillOpacity={0.25} connectNulls={false} isAnimationActive={false} />
                : <Line key={s} type={spec.type === 'step' ? 'stepAfter' : 'monotone'} dataKey={s} stroke={colour(s, i)} dot={{ r: 3 }} connectNulls={false} isAnimationActive={false} />
            ))}
          </Chart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/** Entry used by FigureBody's lazy import: picks the chart by spec.type. */
export default function Charts(props: Props) {
  if (props.spec.type === 'scatter') return <ScatterFigure {...props} />;
  if (props.spec.type === 'grouped-bar') return <GroupedBarFigure {...props} />;
  if (props.spec.type === 'bar' || props.spec.type === 'stacked-bar') return <BarFigure {...props} />;
  return <LineFigure {...props} />;
}
