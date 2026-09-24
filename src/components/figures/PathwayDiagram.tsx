import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import type { Figure, Graph, GraphEdge, GraphNode } from '@/types';
import { getTerm } from '@/lib/data';
import { useTermDrawer } from '@/components/ui/TermDrawer';
import { useTheme } from '@/lib/theme';
import { downloadSvg, svgToPng } from './download';

/**
 * Layered layout, not a force simulation.
 *
 * Every diagram in this pack is a flow — scaffolds to targets, ligand to transducer, parent drug to metabolite —
 * and each one says so in its own "how to read this" text. A force simulation renders that as a cloud: it spreads
 * nodes until they hit the edges of the frame, and the clamping then stacks them in the corners on top of each
 * other. So nodes are ranked into columns and placed on a grid instead, which cannot overlap and reads in the
 * direction the caption promises.
 */

interface Placed extends GraphNode { px: number; py: number; w: number; h: number; lines: string[]; rank: number }

const CHAR_W = 6.3; const LINE_H = 14; const PAD_X = 11; const PAD_Y = 9; const MAX_CHARS = 24;
const ROW_GAP = 18; const MARGIN = 16;
/** A long chain (fig 3's ligand→transducer, fig 6's drug→critical period) gets tighter gaps so it stays compact. */
const colGapFor = (ranks: number) => (ranks >= 5 ? 74 : 104);

function wrap(label: string, max = MAX_CHARS): string[] {
  const words = label.split(/\s+/); const lines: string[] = []; let cur = '';
  for (const w of words) { if ((cur + ' ' + w).trim().length > max && cur) { lines.push(cur); cur = w; } else cur = (cur + ' ' + w).trim(); }
  if (cur) lines.push(cur);
  return lines;
}

/** Edges with a `via` node are two hops for ranking, or the intermediate node would never get a column. */
function flatEdges(g: Graph): { from: string; to: string }[] {
  const out: { from: string; to: string }[] = [];
  for (const e of g.edges) {
    if (e.via) out.push({ from: e.from, to: e.via }, { from: e.via, to: e.to });
    else out.push({ from: e.from, to: e.to });
  }
  return out;
}

/**
 * Column index per node: Kahn's algorithm for the acyclic part (longest path, so a node sits to the right of
 * everything feeding it), then a breadth-first pass for anything left in a cycle — fig 3's lid genuinely points
 * both ways, and a layout must not hang on that.
 */
function rankNodes(g: Graph): Map<string, number> {
  const ids = g.nodes.map((n) => n.id);
  const edges = flatEdges(g).filter((e) => ids.includes(e.from) && ids.includes(e.to));
  const out = new Map<string, string[]>(ids.map((i) => [i, []]));
  const indeg = new Map<string, number>(ids.map((i) => [i, 0]));
  for (const e of edges) { out.get(e.from)!.push(e.to); indeg.set(e.to, (indeg.get(e.to) ?? 0) + 1); }

  const rank = new Map<string, number>();
  const queue = ids.filter((i) => (indeg.get(i) ?? 0) === 0);
  for (const i of queue) rank.set(i, 0);
  const deg = new Map(indeg);
  while (queue.length) {
    const u = queue.shift()!;
    for (const v of out.get(u)!) {
      rank.set(v, Math.max(rank.get(v) ?? 0, (rank.get(u) ?? 0) + 1));
      deg.set(v, (deg.get(v) ?? 0) - 1);
      if ((deg.get(v) ?? 0) === 0) queue.push(v);
    }
  }
  // whatever the cycle swallowed: place it one column right of a neighbour that already has one
  const settled = new Set(rank.keys());
  const bfs = [...settled];
  while (bfs.length) {
    const u = bfs.shift()!;
    for (const v of out.get(u)!) {
      if (settled.has(v)) continue;
      rank.set(v, (rank.get(u) ?? 0) + 1); settled.add(v); bfs.push(v);
    }
  }
  for (const i of ids) if (!settled.has(i)) rank.set(i, 0);

  // the figures that name their columns should keep them: a target belongs on the right, as the caption says
  const max = Math.max(0, ...[...rank.values()]);
  if (g.nodes.some((n) => n.kind === 'target')) {
    for (const n of g.nodes) if (n.kind === 'target') rank.set(n.id, max);
  }
  return rank;
}

function layout(g: Graph, availableWidth: number): { nodes: Placed[]; width: number; height: number } {
  const base: Placed[] = g.nodes.map((n) => {
    const lines = wrap(n.label);
    return {
      ...n, lines, rank: 0,
      w: Math.max(...lines.map((l) => l.length)) * CHAR_W + PAD_X * 2,
      h: lines.length * LINE_H + PAD_Y * 2,
      px: 0, py: 0,
    };
  });
  const byId = new Map(base.map((n) => [n.id, n]));

  if (g.layout === 'fixed' && base.every((n) => n.x !== undefined && n.y !== undefined)) {
    const xs = base.map((n) => n.x ?? 0); const ys = base.map((n) => n.y ?? 0);
    const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
    const xStep = Math.min(240, Math.max(160, (availableWidth - 2 * MARGIN) / Math.max(1, maxX - minX)));
    for (const n of base) { n.px = MARGIN + ((n.x ?? 0) - minX) * xStep + n.w / 2; n.py = MARGIN + ((n.y ?? 0) - minY) * 96 + n.h / 2; }
    return { nodes: base, width: MARGIN * 2 + (maxX - minX) * xStep + 200, height: MARGIN * 2 + (maxY - minY) * 96 + 80 };
  }

  const rank = rankNodes(g);
  for (const n of base) n.rank = rank.get(n.id) ?? 0;
  const maxRank = Math.max(0, ...base.map((n) => n.rank));
  const columns: Placed[][] = Array.from({ length: maxRank + 1 }, () => []);
  for (const n of base) columns[n.rank].push(n);

  // order within each column so connected nodes line up: a few barycentre sweeps over the previous column
  const edges = flatEdges(g);
  const neighboursLeft = new Map<string, string[]>(base.map((n) => [n.id, []]));
  for (const e of edges) neighboursLeft.get(e.to)?.push(e.from);
  const orderOf = new Map<string, number>();
  columns.forEach((col) => col.forEach((n, i) => orderOf.set(n.id, i)));
  for (let pass = 0; pass < 4; pass++) {
    for (let r = 1; r <= maxRank; r++) {
      columns[r].sort((a, b) => {
        const bary = (n: Placed) => {
          const ns = (neighboursLeft.get(n.id) ?? []).map((id) => orderOf.get(id)).filter((v): v is number => v !== undefined);
          return ns.length ? ns.reduce((x, y) => x + y, 0) / ns.length : orderOf.get(n.id) ?? 0;
        };
        return bary(a) - bary(b);
      });
      columns[r].forEach((n, i) => orderOf.set(n.id, i));
    }
  }

  const colGap = colGapFor(maxRank + 1);
  const colWidth = columns.map((col) => Math.max(...col.map((n) => n.w), 0));
  const colHeight = columns.map((col) => col.reduce((a, n) => a + n.h, 0) + ROW_GAP * Math.max(0, col.length - 1));
  const height = Math.max(...colHeight, 0) + MARGIN * 2;
  let x = MARGIN;
  columns.forEach((col, r) => {
    let y = MARGIN + (height - MARGIN * 2 - colHeight[r]) / 2;
    for (const n of col) { n.px = x + colWidth[r] / 2; n.py = y + n.h / 2; y += n.h + ROW_GAP; }
    x += colWidth[r] + colGap;
  });
  const width = x - colGap + MARGIN;
  void byId;
  return { nodes: base, width, height };
}

/** Where the segment from (cx,cy) toward (tx,ty) leaves a w×h box centred at (cx,cy). */
function edgePoint(cx: number, cy: number, w: number, h: number, tx: number, ty: number, margin = 3) {
  const dx = tx - cx, dy = ty - cy;
  if (dx === 0 && dy === 0) return { x: cx, y: cy };
  const sx = Math.abs(dx) > 0 ? (w / 2 + margin) / Math.abs(dx) : Infinity;
  const sy = Math.abs(dy) > 0 ? (h / 2 + margin) / Math.abs(dy) : Infinity;
  const s = Math.min(sx, sy);
  return { x: cx + dx * s, y: cy + dy * s };
}

const KIND_STYLE: Record<string, { fill: string; stroke: string; rx: number; dash?: string; italic?: boolean }> = {
  concept: { fill: 'transparent', stroke: 'var(--bx-accent)', rx: 6, dash: '4 3', italic: true },
  scaffold: { fill: 'var(--bx-bg-2)', stroke: 'var(--bx-ink)', rx: 6 },
  target: { fill: 'var(--bx-bg)', stroke: 'var(--bx-accent)', rx: 16 },
  outlier: { fill: 'rgba(168,90,31,0.16)', stroke: '#a85a1f', rx: 6 },
  ligand: { fill: 'var(--bx-bg-2)', stroke: 'var(--bx-ink)', rx: 14 },
  residue: { fill: 'var(--bx-bg)', stroke: 'var(--bx-ink)', rx: 6 },
  structure: { fill: 'var(--bx-bg-2)', stroke: 'var(--bx-muted)', rx: 6 },
  output: { fill: 'var(--bx-bg)', stroke: 'var(--bx-accent)', rx: 16 },
  input: { fill: 'var(--bx-bg-2)', stroke: 'var(--bx-ink)', rx: 14 },
  receptor: { fill: 'var(--bx-bg-2)', stroke: 'var(--bx-muted)', rx: 12 },
  signal: { fill: 'var(--bx-bg)', stroke: 'var(--bx-ink)', rx: 6 },
  parent: { fill: 'var(--bx-bg-2)', stroke: 'var(--bx-ink)', rx: 6 },
  active: { fill: 'rgba(31,122,99,0.16)', stroke: '#1f7a63', rx: 6 },
  inactive: { fill: 'transparent', stroke: 'var(--bx-muted)', rx: 6, dash: '4 3' },
  enzyme: { fill: 'var(--bx-bg)', stroke: 'var(--bx-accent)', rx: 6 },
  inhibitor: { fill: 'rgba(184,134,11,0.18)', stroke: '#8a6d1f', rx: 6 },
  // this pack's biosynthesis map (fig-pathways)
  precursor: { fill: 'var(--bx-bg-2)', stroke: 'var(--bx-ink)', rx: 14 },
  pathway: { fill: 'transparent', stroke: 'var(--bx-accent)', rx: 6, dash: '4 3', italic: true },
  intermediate: { fill: 'var(--bx-bg)', stroke: 'var(--bx-muted)', rx: 6 },
  compound: { fill: 'rgba(47,125,79,0.14)', stroke: '#2f7d4f', rx: 12 },
};

const isContested = (e: GraphEdge) => /CONTESTED/i.test(e.label ?? '');
const shortLabel = (s: string) => (s.length > 22 ? `${s.slice(0, 21)}…` : s);

/**
 * Which labels are written on the diagram itself. A short one ("agonist", "activation") sits in the gap without
 * crowding anything; a sentence-length one ("selective agonist; no 5-HT2A activity") collides with its
 * neighbours and with the boxes, which is what made these diagrams hard to read. The long ones are not lost —
 * every edge label appears on hover and in the "all connections as text" list under the figure. A CONTESTED
 * edge always keeps its label, because that disagreement is the point of the diagram.
 */
const INLINE_LABEL_MAX = 16;
const showsInlineLabel = (e: GraphEdge) => !!e.label && (isContested(e) || e.label.length <= INLINE_LABEL_MAX);

/**
 * Where to write an edge's label. An edge that crosses more than one column (an outlier reaching its target past
 * the scaffold columns) gets its label just after the source box, in the empty gap — otherwise every long edge
 * writes its label at the middle of the frame and they all land on top of each other. Short edges label at their
 * midpoint, nudged by index so neighbouring labels in the same gap do not collide.
 */
function labelPoint(p1: { x: number; y: number }, p2: { x: number; y: number }, spanRanks: number, index: number) {
  const t = spanRanks > 1 ? 0.18 : 0.5;
  return { x: p1.x + (p2.x - p1.x) * t, y: p1.y + (p2.y - p1.y) * t + ((index % 3) - 1) * 10 };
}

interface Props { figure: Figure; graph: Graph; inline?: boolean }

export default function PathwayDiagram({ figure, graph, inline }: Props) {
  // ?compound=<id> (from a compound page's Biosynthesis link) highlights that compound's node on arrival
  const [params] = useSearchParams();
  const fromUrl = graph.nodes.find((n) => n.compound_id && n.compound_id === params.get('compound'))?.id ?? null;
  const [selected, setSelected] = useState<string | null>(fromUrl);
  useEffect(() => {
    if (!fromUrl) return;
    setSelected(fromUrl);
    // bring the compound's node into view inside the sideways-scrolling frame
    requestAnimationFrame(() => document.querySelector(`[data-testid="node-${fromUrl}"]`)?.scrollIntoView({ block: 'center', inline: 'center' }));
  }, [fromUrl]);
  const [hover, setHover] = useState<{ x: number; y: number; title: string; text: string } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const drawer = useTermDrawer();
  const { theme } = useTheme();

  const { nodes, width, height } = useMemo(() => layout(graph, 1100), [graph]);
  const byId = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);
  const neighbours = useMemo(() => {
    const m = new Map<string, Set<string>>();
    for (const e of graph.edges) for (const [a, b] of [[e.from, e.to], [e.to, e.from]]) { if (!m.has(a)) m.set(a, new Set()); m.get(a)!.add(b); if (e.via) m.get(a)!.add(e.via); }
    return m;
  }, [graph]);
  const dim = (id: string) => selected !== null && selected !== id && !neighbours.get(selected)?.has(id);
  const edgeDim = (e: GraphEdge) => selected !== null && e.from !== selected && e.to !== selected && e.via !== selected;
  const contestedCount = graph.edges.filter(isContested).length;
  const filename = `${figure.id}-${figure.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40)}`;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 no-print">
        <p className="text-xs bx-muted">
          Click a node to highlight what it connects to; click again to clear. Hover an arrow for its full label.
          {width > 900 && ' This diagram is wider than the page — scroll it sideways.'}
        </p>
        {selected && <button type="button" className="bx-btn" onClick={() => setSelected(null)}>Clear highlight</button>}
        {!inline && (
          <div className="ml-auto inline-flex gap-1">
            <button type="button" className="bx-btn" onClick={() => svgRef.current && svgToPng(svgRef.current, `${filename}.png`)}>PNG</button>
            <button type="button" className="bx-btn" onClick={() => svgRef.current && downloadSvg(svgRef.current, `${filename}.svg`)}>SVG</button>
          </div>
        )}
      </div>
      <div className="mt-3 relative overflow-x-auto">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${width} ${height}`}
          width={width}
          height={height}
          /* Natural size, never scaled down to fit: a squeezed diagram is an unreadable one. When it is wider
             than the card it scrolls inside its own container, so the page itself never overflows. */
          style={{ fontFamily: 'inherit', display: 'block' }}
          role="img"
          aria-label={`${figure.label}: ${figure.title}, drawn as a left-to-right diagram with ${nodes.length} nodes and ${graph.edges.length} connections${contestedCount ? `, of which ${contestedCount} are marked contested` : ''}. Every connection is also listed as text below the diagram.`}
          data-testid={`pathway-${figure.id}`}
        >
          <defs>
            <marker id={`arrow-${figure.id}`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor" /></marker>
          </defs>
          <g color="var(--bx-ink)">
            {graph.edges.map((e, i) => {
              const a = byId.get(e.from); const b = byId.get(e.to); if (!a || !b) return null;
              const via = e.via ? byId.get(e.via) : undefined;
              const contested = isContested(e);
              const title = `${a.label} → ${b.label}${e.label ? ` (${e.label})` : ''}${e.refs?.length ? ` [${e.refs.join(',')}]` : ''}`;
              const artefact = e.type === 'artefact' || e.style === 'artefact';
              const stroke = contested ? 'var(--bx-muted)' : artefact ? '#b45309' : 'currentColor';
              const dash = contested ? '6 4' : artefact ? '2 3' : (e.type === 'dashed' || e.style === 'dashed') ? '6 4' : undefined;
              const back = b.rank <= a.rank; // a cycle or an intra-column link: bow it out so it stays readable
              const segs: { from: Placed; to: Placed }[] = via ? [{ from: a, to: via }, { from: via, to: b }] : [{ from: a, to: b }];
              const mids: { x: number; y: number }[] = [];
              const paths = segs.map((s, k) => {
                const p1 = edgePoint(s.from.px, s.from.py, s.from.w, s.from.h, s.to.px, s.to.py);
                const p2 = edgePoint(s.to.px, s.to.py, s.to.w, s.to.h, s.from.px, s.from.py);
                const lp = labelPoint(p1, p2, s.to.rank - s.from.rank, i);
                const mx = lp.x, my = lp.y;
                mids.push({ x: mx, y: my });
                const d = back
                  ? `M ${p1.x} ${p1.y} Q ${mx} ${my - 46} ${p2.x} ${p2.y}`
                  : `M ${p1.x} ${p1.y} L ${p2.x} ${p2.y}`;
                return <path key={k} d={d} fill="none" stroke={stroke} strokeWidth={contested || artefact ? 2 : 1.4} strokeDasharray={via ? '5 3' : dash} markerEnd={k === segs.length - 1 ? `url(#arrow-${figure.id})` : undefined} />;
              });
              const mid = mids[mids.length - 1];
              return (
                <g key={i} opacity={edgeDim(e) ? 0.12 : 1} tabIndex={0} role="img" aria-label={title} className="outline-none"
                  onMouseEnter={() => setHover({ x: mid.x, y: mid.y, title: contested ? 'contested' : 'connection', text: title })} onMouseLeave={() => setHover(null)}
                  onFocus={() => setHover({ x: mid.x, y: mid.y, title: contested ? 'contested' : 'connection', text: title })} onBlur={() => setHover(null)}>
                  {paths}
                  {showsInlineLabel(e) && (
                    <text x={mid.x} y={mid.y - (back ? 26 : 6)} textAnchor="middle" fontSize={9.5} fontWeight={contested ? 700 : 400} fill={contested ? 'var(--bx-ink)' : 'var(--bx-muted)'} paintOrder="stroke" stroke="var(--bx-bg)" strokeWidth={3.5}>
                      {shortLabel(e.label ?? '')}
                    </text>
                  )}
                </g>
              );
            })}
          </g>
          {nodes.map((n) => {
            const st = KIND_STYLE[n.kind ?? 'signal'] ?? KIND_STYLE.signal;
            const term = getTerm(n.term);
            const isSel = selected === n.id;
            const label = `${n.lines.join(' ')}${n.kind ? ` (${n.kind})` : ''}${n.contested ? ', contested' : ''}${term ? `. Opens glossary entry ${term.term}` : ''}`;
            return (
              <g key={n.id} transform={`translate(${n.px - n.w / 2},${n.py - n.h / 2})`} opacity={dim(n.id) ? 0.22 : 1} role="button" tabIndex={0} aria-label={label} aria-pressed={isSel} className="cursor-pointer outline-none"
                onClick={() => { setSelected(isSel ? null : n.id); if (term) drawer.openTerm(term.id); }}
                onKeyDown={(ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); setSelected(isSel ? null : n.id); if (term) drawer.openTerm(term.id); } }}
                onMouseEnter={() => setHover({ x: n.px, y: n.py + n.h / 2, title: n.label, text: term ? term.short : `${n.kind ?? ''}${n.compartment ? ` · ${n.compartment}` : ''}${n.refs?.length ? ` · [${n.refs.join(',')}]` : ''}${n.note ? ` · ${n.note}` : ''}` })} onMouseLeave={() => setHover(null)}
                onFocus={() => setHover({ x: n.px, y: n.py + n.h / 2, title: n.label, text: term ? term.short : '' })} onBlur={() => setHover(null)}
                data-testid={`node-${n.id}`}>
                <rect width={n.w} height={n.h} rx={st.rx} fill={st.fill} stroke={isSel ? 'var(--bx-accent)' : st.stroke} strokeWidth={isSel ? 3 : n.contested ? 2 : 1.2} strokeDasharray={n.contested ? '5 3' : st.dash} />
                <text fontSize={11} fontWeight={600} fontStyle={st.italic ? 'italic' : undefined} fill={theme === 'dark' ? '#efe6d3' : '#2a231a'} aria-hidden="true">
                  {n.lines.map((l, i) => <tspan key={i} x={n.w / 2} y={PAD_Y + LINE_H * (i + 1) - 3} textAnchor="middle">{l}</tspan>)}
                </text>
              </g>
            );
          })}
        </svg>
        {hover && hover.text && (
          <div className="bx-card pointer-events-none absolute z-10 p-2 text-xs max-w-[20rem]" style={{ left: `${Math.min(92, (hover.x / width) * 100)}%`, top: `${(hover.y / height) * 100}%`, transform: 'translate(-50%, 6px)' }} role="status">
            <span className="font-semibold">{hover.title}</span>{hover.text && <span className="block mt-0.5 bx-muted">{hover.text}</span>}
          </div>
        )}
      </div>
      {selected && byId.get(selected)?.compound_id && (
        <p className="mt-2 text-sm bx-card p-2" role="status" data-testid="pathway-selected">
          Selected: <strong>{byId.get(selected)!.label}</strong>{byId.get(selected)!.refs?.length ? <span className="bx-muted"> [{byId.get(selected)!.refs!.join(',')}]</span> : null} — <Link className="underline" to={`/compounds/${byId.get(selected)!.compound_id}`}>open the compound record →</Link>
        </p>
      )}
      <p className="mt-2 text-xs bx-muted flex flex-wrap gap-x-4 gap-y-1">
        <span><span aria-hidden="true">→</span> a relationship as published — not a measured flux</span>
        {graph.edges.some((e) => e.style === 'dashed') && <span><span aria-hidden="true" className="inline-block w-6 border-t-2 border-dashed align-middle" /> several steps compressed into one arrow</span>}
        {graph.edges.some((e) => e.style === 'artefact') && <span><span aria-hidden="true" className="inline-block w-6 border-t-2 border-dotted border-amber-700 align-middle" /> formed after harvest (drying, distillation), not in the living plant</span>}
        {graph.nodes.some((n) => n.compound_id) && <span>Green rounded boxes are compounds with a record in the catalogue: click one to select it and follow the link.</span>}
        {graph.edges.some((e) => !showsInlineLabel(e)) && <span>Hover or focus an arrow for its full label; all {graph.edges.length} are listed as text below.</span>}
        {graph.edges.some((e) => e.via) && <span>Dashed two-part arrow: the step runs through the enzyme it passes.</span>}
        {contestedCount > 0 && <span><span aria-hidden="true" className="inline-block w-6 border-t-2 border-dashed align-middle" /> contested: the cited papers disagree, and the diagram leaves the disagreement in ({contestedCount} here)</span>}
      </p>
      <details className="mt-2 text-sm">
        <summary className="cursor-pointer bx-muted">All {graph.edges.length} connections as text</summary>
        <ul className="mt-1 grid gap-1 list-disc pl-5">
          {graph.edges.map((e, i) => (
            <li key={i}>
              <span className="font-semibold">{byId.get(e.from)?.label ?? e.from}</span> → <span className="font-semibold">{byId.get(e.to)?.label ?? e.to}</span>
              {e.via && <> (via {byId.get(e.via)?.label ?? e.via})</>}
              {e.label && <span className="bx-muted"> — {e.label}</span>}
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}
