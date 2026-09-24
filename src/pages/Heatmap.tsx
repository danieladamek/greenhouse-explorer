import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { BASIS_LABEL, BASIS_SHORT, amountText, type Basis } from '@/lib/basis';
import { CLASSES, classMeta, familyColour, getTaxonMeta, taxaIndex } from '@/lib/data';
import { loadOccurrences, useAsync } from '@/lib/heavy';
import type { OccurrenceRow } from '@/types';
import InfographicFrame from '@/components/ui/InfographicFrame';
import { ShapePath } from '@/components/catalogue/Chips';

/** Cell colour encodes the BASIS of the row, never its amount: amounts on different bases cannot share a scale. */
const BASIS_FILL: Record<Basis, string> = {
  essential_oil_pct: '#2a7ab0', dry_weight: '#5f9e2f', fresh_weight: '#1f9c9c', per_g_extract: '#8a5fb0', unstated: '#d97706', presence_only: '#868e96',
};

function Cell({ rows, x, y, w, h, onTip }: { rows: OccurrenceRow[]; x: number; y: number; w: number; h: number; onTip: (t: string | null, e?: React.MouseEvent) => void }) {
  if (!rows.length) return <rect x={x + 2} y={y + 2} width={w - 4} height={h - 4} rx={3} fill="none" stroke="currentColor" strokeOpacity={0.08} />;
  const r = rows[0];
  const text = rows.map((q) => `${q.compound} in ${q.taxon_name ?? q.taxon_id} (${q.plant_part ?? 'part not stated'}): ${amountText(q)}${q.verified ? '' : ' — unverified'} · ${q.source_citation}`).join('\n');
  // never cut a number: a long value is shown whole in a smaller face; a multi-range value says "see rows"
  const raw = r.basis === 'presence_only' ? (r.value === null ? 'present' : String(r.value)) : String(r.value ?? '');
  const label = /;/.test(raw) ? 'several ranges' : raw;
  const fs = label.length > 13 ? 8 : label.length > 10 ? 9 : 10;
  return (
    <g role="cell" aria-label={text} onMouseEnter={(e) => onTip(text, e)} onMouseMove={(e) => onTip(text, e)} onMouseLeave={() => onTip(null)}>
      <title>{text}</title>
      {r.basis === 'presence_only'
        ? <rect x={x + 2} y={y + 2} width={w - 4} height={h - 4} rx={3} fill="none" stroke={BASIS_FILL.presence_only} strokeDasharray="3 2" />
        : r.basis === 'unstated'
          ? <rect x={x + 2} y={y + 2} width={w - 4} height={h - 4} rx={3} fill="url(#bx-hatch)" stroke={BASIS_FILL.unstated} />
          : <rect x={x + 2} y={y + 2} width={w - 4} height={h - 4} rx={3} fill={BASIS_FILL[r.basis]} fillOpacity={0.22} stroke={BASIS_FILL[r.basis]} />}
      <text x={x + w / 2} y={y + h / 2 - 1} textAnchor="middle" fontSize={fs} fill="currentColor" pointerEvents="none">{label}</text>
      <text x={x + w / 2} y={y + h / 2 + 10} textAnchor="middle" fontSize={8.5} fill="currentColor" opacity={0.75} pointerEvents="none">{BASIS_SHORT[r.basis]}{rows.length > 1 ? ` +${rows.length - 1}` : ''}{r.unit && r.basis !== 'presence_only' ? ` · ${r.unit}` : ''}</text>
    </g>
  );
}

/** /heatmap (feature A6): compounds × profiled species, every cell carrying its basis. Unprofiled species are excluded, and say so. */
export default function Heatmap() {
  const rowsAll = useAsync(loadOccurrences);
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const sort = params.get('sort') === 'plants' ? 'plants' : 'class';
  const aux = params.get('aux') === '1';
  const [tip, setTip] = useState<{ x: number; y: number; text: string } | null>(null);
  const set = (k: string, v: string | null) => { const p = new URLSearchParams(params); if (v === null) p.delete(k); else p.set(k, v); setParams(p, { replace: true }); };

  const { taxa, compounds, byPair } = useMemo(() => {
    const rows = (rowsAll ?? []).filter((r) => r.taxon_known && (aux || !r.auxiliary));
    const taxa = [...new Set(rows.map((r) => r.taxon_id))].sort((a, b) => getTaxonMeta(a)!.family.localeCompare(getTaxonMeta(b)!.family) || a.localeCompare(b));
    const cmap = new Map<string, { id: string; name: string; cls: string; n: number }>();
    for (const r of rows) { const c = cmap.get(r.compound_id) ?? { id: r.compound_id, name: r.compound, cls: r.class, n: 0 }; c.n = new Set(rows.filter((q) => q.compound_id === r.compound_id).map((q) => q.taxon_id)).size; cmap.set(r.compound_id, c); }
    const order = CLASSES.map((c) => c.id);
    const compounds = [...cmap.values()].sort(sort === 'class' ? (a, b) => order.indexOf(a.cls) - order.indexOf(b.cls) || a.name.localeCompare(b.name) : (a, b) => b.n - a.n || a.name.localeCompare(b.name));
    const byPair = new Map<string, OccurrenceRow[]>();
    for (const r of rows) { const k = `${r.compound_id}|${r.taxon_id}`; byPair.set(k, [...(byPair.get(k) ?? []), r]); }
    return { taxa, compounds, byPair };
  }, [rowsAll, aux, sort]);

  const LW = 210; const CW = 92; const RH = 30; const HEAD = 130;
  const W = LW + taxa.length * CW + 100; const H = HEAD + compounds.length * RH + 10;
  const excluded = taxaIndex.filter((t) => !taxa.includes(t.id));

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="text-3xl sm:text-4xl">Heatmap</h1>
      <p className="bx-prose mt-2 max-w-3xl">Rows are curated compounds, columns are the plants they are recorded in. Each cell shows the first published value for that pair with its basis (hover for every row, its plant part and source). Colour tells you the <strong>basis</strong>, not the amount: values on different bases cannot share one colour scale.</p>
      <div className="mt-6">
        <InfographicFrame
          title="Compounds × plants"
          caption={<>Excluded: the {excluded.length} taxa with no occurrence rows in this prototype (the unprofiled species and the unresolved skullcap entry, whose rows sit on its two candidates){rowsAll?.some((r) => !r.taxon_known) ? ', and one row whose plant has no taxa.yaml record (listed on Methods)' : ''}.</>}
          filename="greenhouse-explorer-heatmap.svg"
          controls={(
            <>
              <label className="text-sm inline-flex items-center gap-1">Order
                <select className="bx-input !w-auto" value={sort} onChange={(e) => set('sort', e.target.value === 'class' ? null : e.target.value)}><option value="class">by class</option><option value="plants">most plants first</option></select>
              </label>
              <label className="text-sm inline-flex items-center gap-1"><input type="checkbox" checked={aux} onChange={(e) => set('aux', e.target.checked ? '1' : null)} /> Show auxiliary</label>
            </>
          )}
          legend={<div className="flex flex-wrap gap-x-4 gap-y-1">{(Object.keys(BASIS_FILL) as Basis[]).map((b) => <span key={b} className="inline-flex items-center gap-1.5"><svg width="16" height="12" aria-hidden="true"><rect x="1" y="1" width="14" height="10" rx="2" fill={b === 'presence_only' ? 'none' : BASIS_FILL[b]} fillOpacity={b === 'unstated' ? 0.35 : 0.22} stroke={BASIS_FILL[b]} strokeDasharray={b === 'presence_only' ? '3 2' : undefined} /></svg>{BASIS_LABEL[b]}</span>)}</div>}
        >
          {!rowsAll ? <p className="bx-muted" role="status">Loading…</p> : (
            <div className="relative">
              <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} className="max-w-none text-ink dark:text-night-ink" role="table" aria-label="Heatmap of curated compounds by plant; each cell gives value, unit and basis" style={{ fontFamily: 'inherit' }} data-testid="heatmap">
                <title>Curated compounds by plant, with the basis of each value</title>
                <defs><pattern id="bx-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="6" height="6" fill="#d97706" fillOpacity={0.08} /><line x1="0" y1="0" x2="0" y2="6" stroke="#d97706" strokeOpacity={0.45} strokeWidth="2" /></pattern></defs>
                <g role="row">
                  {taxa.map((t, i) => { const tm = getTaxonMeta(t)!; return (
                    <g key={t}>
                      {/* ink text + a family swatch: family colours are identity, not text (several fail contrast on manila) */}
                      <circle cx={LW + i * CW + CW / 2 - 8} cy={HEAD - 4} r={4} fill={familyColour(tm.family)} />
                      <text role="columnheader" transform={`translate(${LW + i * CW + CW / 2 - 2}, ${HEAD - 8}) rotate(-40)`} fontSize={12} fontStyle="italic" fontWeight={600} fill="currentColor" className="cursor-pointer" onClick={() => navigate(`/plants/${t}`)}>{tm.accepted_name}</text>
                    </g>
                  ); })}
                </g>
                {compounds.map((c, j) => {
                  const y = HEAD + j * RH; const cm = classMeta(c.cls);
                  return (
                    <g key={c.id} role="row">
                      <rect x={0} y={y} width={W} height={RH} fill="currentColor" opacity={j % 2 ? 0.03 : 0} />
                      <g transform={`translate(6, ${y + 10})`}><ShapePath shape={cm.icon} color={cm.color} /></g>
                      <text x={22} y={y + RH / 2 + 4} fontSize={12} fill="currentColor" role="rowheader" className="cursor-pointer" tabIndex={0} onClick={() => navigate(`/compounds/${c.id}`)} onKeyDown={(e) => { if (e.key === 'Enter') navigate(`/compounds/${c.id}`); }}>{c.name.length > 27 ? `${c.name.slice(0, 25)}…` : c.name}</text>
                      {taxa.map((t, i) => <Cell key={t} rows={byPair.get(`${c.id}|${t}`) ?? []} x={LW + i * CW} y={y} w={CW} h={RH} onTip={(text, e) => setTip(text && e ? { x: e.clientX, y: e.clientY, text } : null)} />)}
                    </g>
                  );
                })}
              </svg>
              {tip && <div role="tooltip" className="pointer-events-none fixed z-50 max-w-sm whitespace-pre-line rounded-md border border-[color:var(--bx-line)] bg-paper dark:bg-night-2 p-2 text-xs shadow-lg" style={{ left: Math.min(tip.x + 12, window.innerWidth - 390), top: tip.y + 12 }}>{tip.text}</div>}
            </div>
          )}
        </InfographicFrame>
      </div>
    </div>
  );
}
