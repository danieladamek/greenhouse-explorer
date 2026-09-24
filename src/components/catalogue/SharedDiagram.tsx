import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { classMeta, familyColour, getTaxonMeta } from '@/lib/data';
import type { OccurrenceRow } from '@/types';
import { ShapePath } from './Chips';

/**
 * The shared-compound diagram (feature A5), re-keyed on taxa. Bioactive Explorer drew four overlapping circles for
 * four plants; with ten profiled plants no Venn layout can show every overlap, so this is the set-matrix form of the
 * same question — which curated compounds are shared across which greenhouse plants. Rows are compounds, grouped
 * by how many plants carry them; columns are plants, coloured by family; a dot means the catalogue has at least one
 * occurrence row for that pair. Presence only: amounts and bases are on the heatmap and in Compare.
 */
export default function SharedDiagram({ rows }: { rows: OccurrenceRow[] }) {
  const navigate = useNavigate();
  const [hot, setHot] = useState<{ c?: string; t?: string } | null>(null);
  const known = rows.filter((r) => r.taxon_known && !r.auxiliary);
  const taxa = useMemo(() => [...new Set(known.map((r) => r.taxon_id))].sort((a, b) => (getTaxonMeta(a)!.family.localeCompare(getTaxonMeta(b)!.family)) || a.localeCompare(b)), [known]);
  const compounds = useMemo(() => {
    const m = new Map<string, { id: string; name: string; cls: string; taxa: Set<string> }>();
    for (const r of known) { if (!m.has(r.compound_id)) m.set(r.compound_id, { id: r.compound_id, name: r.compound, cls: r.class, taxa: new Set() }); m.get(r.compound_id)!.taxa.add(r.taxon_id); }
    return [...m.values()].sort((a, b) => b.taxa.size - a.taxa.size || taxa.indexOf([...a.taxa][0]) - taxa.indexOf([...b.taxa][0]) || a.name.localeCompare(b.name));
  }, [known, taxa]);

  const LW = 230; const CW = 46; const RH = 19; const HEAD = 150; const GH = 22;
  const layout: { y: number; group?: string; c?: (typeof compounds)[number] }[] = [];
  let y = HEAD; let last = -1;
  for (const c of compounds) {
    if (c.taxa.size !== last) { layout.push({ y, group: c.taxa.size === 1 ? 'IN ONE PLANT ONLY' : `SHARED BY ${c.taxa.size} PLANTS` }); y += GH; last = c.taxa.size; }
    layout.push({ y, c }); y += RH;
  }
  const W = LW + taxa.length * CW + 110; const H = y + 10;
  const dim = (c?: string, t?: string) => !!hot && ((hot.c && c && hot.c !== c) || (hot.t && t && hot.t !== t));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full min-w-[640px] text-ink dark:text-night-ink" role="group" aria-label="Which curated compounds are shared across which greenhouse plants" style={{ fontFamily: 'inherit' }} data-testid="shared-diagram">
      <title>Curated compounds shared across the profiled greenhouse plants</title>
      {taxa.map((t, i) => {
        const tm = getTaxonMeta(t)!;
        const x = LW + i * CW + CW / 2;
        return (
          <g key={t} opacity={dim(undefined, t) ? 0.3 : 1} onMouseEnter={() => setHot({ t })} onMouseLeave={() => setHot(null)} className="cursor-pointer" role="link" tabIndex={0} aria-label={`${tm.accepted_name}: open plant page`} onClick={() => navigate(`/plants/${t}`)} onKeyDown={(e) => { if (e.key === 'Enter') navigate(`/plants/${t}`); }}>
            <rect x={x - CW / 2 + 3} y={HEAD - 8} width={CW - 6} height={H - HEAD} fill={familyColour(tm.family)} opacity={0.07} rx={4} />
            <text transform={`translate(${x + 4}, ${HEAD - 14}) rotate(-55)`} fontSize={12} fontStyle="italic" fill={familyColour(tm.family)} fontWeight={600}>{tm.accepted_name}</text>
          </g>
        );
      })}
      {layout.map((l, i) => {
        if (l.group) return <text key={`g${i}`} x={8} y={l.y + 15} fontSize={10} fontWeight={700} letterSpacing={1} fill="currentColor" opacity={0.7}>{l.group}</text>;
        const c = l.c!;
        const cm = classMeta(c.cls);
        const members = taxa.map((t, j) => ({ t, j })).filter(({ t }) => c.taxa.has(t));
        return (
          <g key={c.id} opacity={dim(c.id) ? 0.3 : 1} onMouseEnter={() => setHot({ c: c.id })} onMouseLeave={() => setHot(null)} onFocus={() => setHot({ c: c.id })} onBlur={() => setHot(null)} className="cursor-pointer" role="link" tabIndex={0} aria-label={`${c.name}: in ${[...c.taxa].map((t) => getTaxonMeta(t)?.accepted_name).join(', ')}. Open compound page`} onClick={() => navigate(`/compounds/${c.id}`)} onKeyDown={(e) => { if (e.key === 'Enter') navigate(`/compounds/${c.id}`); }}>
            <title>{`${c.name} — ${[...c.taxa].map((t) => getTaxonMeta(t)?.accepted_name).join(', ')}`}</title>
            <rect x={0} y={l.y} width={W} height={RH} fill="currentColor" opacity={hot?.c === c.id ? 0.08 : i % 2 ? 0.025 : 0} />
            <g transform={`translate(${8}, ${l.y + 4.5})`}><ShapePath shape={cm.icon} color={cm.color} /></g>
            <text x={24} y={l.y + 14} fontSize={12} fill="currentColor">{c.name.length > 30 ? `${c.name.slice(0, 28)}…` : c.name}</text>
            {members.length > 1 && <line x1={LW + members[0].j * CW + CW / 2} x2={LW + members[members.length - 1].j * CW + CW / 2} y1={l.y + RH / 2} y2={l.y + RH / 2} stroke="currentColor" strokeOpacity={0.35} strokeWidth={2} />}
            {taxa.map((t, j) => {
              const on = c.taxa.has(t);
              const cx = LW + j * CW + CW / 2;
              return on
                ? <circle key={t} cx={cx} cy={l.y + RH / 2} r={6} fill={familyColour(getTaxonMeta(t)!.family)} stroke="currentColor" strokeOpacity={0.35} />
                : <circle key={t} cx={cx} cy={l.y + RH / 2} r={2} fill="currentColor" opacity={0.2} />;
            })}
          </g>
        );
      })}
    </svg>
  );
}
