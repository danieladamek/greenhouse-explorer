/** Figure data loading + declared-field validation (CSV via papaparse, JSON graphs via zod). */
import fs from 'node:fs';
import path from 'node:path';
import Papa from 'papaparse';
import { GraphSchema, type BuildError, type FigureDef, type Graph } from './schemas';

export type Row = Record<string, string | number | null>;

export function parseCsv(text: string): { rows: Row[]; fields: string[] } {
  const res = Papa.parse<Record<string, string>>(text.trim(), { header: true, skipEmptyLines: true });
  const fields = res.meta.fields ?? [];
  const rows: Row[] = res.data.map((r) => {
    const o: Row = {};
    for (const f of fields) {
      const v = r[f] ?? '';
      o[f] = v === '' ? null : /^-?\d+(\.\d+)?$/.test(v) ? Number(v) : v;
    }
    return o;
  });
  return { rows, fields };
}

/** CSV as strings, no coercion (plantings.csv: ids and notes must arrive exactly as written). */
export function parseCsvRaw(text: string): { rows: Record<string, string>[]; fields: string[]; errors: string[] } {
  const res = Papa.parse<Record<string, string>>(text.replace(/^\uFEFF/, '').trim(), { header: true, skipEmptyLines: true });
  return { rows: res.data, fields: res.meta.fields ?? [], errors: res.errors.map((e) => `row ${e.row}: ${e.message}`) };
}

export interface LoadedFigure {
  table?: { rows: Row[]; fields: string[] };
  graph?: Graph;
  chartRows?: Row[];
  chartFields?: string[];
}

function fieldsOfChart(chart: NonNullable<FigureDef['chart']>): string[] {
  const f: string[] = [];
  if (chart.x?.field) f.push(chart.x.field);
  if (chart.y?.field) f.push(chart.y.field);
  if (chart.value?.field) f.push(chart.value.field);
  if (typeof chart.series === 'string') f.push(chart.series);
  else for (const s of chart.series ?? []) for (const k of [s.lo, s.hi, s.field]) if (k) f.push(k);
  if (chart.ci) f.push(...chart.ci);
  return f;
}

export function loadFigureData(fig: FigureDef, packDir: string, termIds: Set<string>, errors: BuildError[], topic = false): LoadedFigure {
  const out: LoadedFigure = {};
  const where = `figures/${fig.id}`;
  const E = (message: string) => errors.push({ where, message });
  if (['chart', 'table', 'network', 'pathway'].includes(fig.kind)) {
    if (!fig.data) E(`${fig.kind} needs data`);
    else {
      const p = path.join(packDir, fig.data);
      if (!fs.existsSync(p)) E(`data file missing ${fig.data}`);
      else if (fig.data.endsWith('.csv')) {
        const t = parseCsv(fs.readFileSync(p, 'utf8'));
        if (!t.rows.length) E('empty csv');
        for (const col of fig.columns ?? []) {
          if (!t.fields.includes(col.field)) E(`column field ${col.field} not in csv`);
          if (col.sort_field && !t.fields.includes(col.sort_field)) E(`sort_field ${col.sort_field} not in csv`);
        }
        // topic mode: every point in a synthesised data figure must be traceable to its own source
        if (topic && fig.synthesis === 'data' && !t.fields.includes('ref')) {
          E(`synthesis: data csv needs a 'ref' column so every row is traceable (cols: ${t.fields.join(', ')})`);
        }
        out.table = t;
      } else if (fig.data.endsWith('.json')) {
        const parsed = GraphSchema.safeParse(JSON.parse(fs.readFileSync(p, 'utf8')));
        if (!parsed.success) { for (const i of parsed.error.issues) E(`${fig.data}: ${i.path.join('/')} ${i.message}`); }
        else {
          const g = parsed.data;
          const ids = new Set(g.nodes.map((n) => n.id));
          const dup = g.nodes.map((n) => n.id).filter((id, i, a) => a.indexOf(id) !== i);
          if (dup.length) E(`duplicate node ids ${dup.join(', ')}`);
          for (const e of g.edges) {
            for (const end of ['from', 'to'] as const) if (!ids.has(e[end])) E(`edge endpoint ${e[end]} unknown`);
            if (e.via && !ids.has(e.via)) E(`via ${e.via} unknown`);
          }
          for (const n of g.nodes) {
            if (n.term && !termIds.has(n.term)) E(`node term ${n.term} unknown`);
            if (g.layout === 'fixed' && (n.x === undefined || n.y === undefined)) E(`fixed layout but node ${n.id} has no x/y`);
          }
          out.graph = g;
        }
      } else E(`unsupported data format ${fig.data}`);
    }
    if (fig.chart) {
      let rows: Row[] | undefined; let fields: string[] | undefined;
      if (fig.chart.data) {
        const p = path.join(packDir, fig.chart.data);
        if (!fs.existsSync(p)) E(`chart data missing ${fig.chart.data}`);
        else { const t = parseCsv(fs.readFileSync(p, 'utf8')); rows = t.rows; fields = t.fields; }
      } else if (out.table) { rows = out.table.rows; fields = out.table.fields; }
      if (rows && fields) {
        for (const f of fieldsOfChart(fig.chart)) if (!fields.includes(f)) E(`chart field ${f} not in ${fig.chart.data ?? fig.data}`);
        out.chartRows = rows; out.chartFields = fields;
      }
    }
  }
  if (fig.kind === 'image') {
    if (!fig.image || !fs.existsSync(path.join(packDir, fig.image))) E('image missing');
    if (!fig.hotspots.length) E('image needs ≥1 hotspot');
    const panelIds = new Set((fig.panels ?? []).map((p) => p.id));
    for (const h of fig.hotspots) if (h.panel && !panelIds.has(h.panel)) E(`hotspot panel ${h.panel} unknown`);
    for (const h of fig.hotspots) for (const k of ['x', 'y', 'w', 'h'] as const) if (h[k] < 0 || h[k] > 100) E(`hotspot ${k} out of 0–100 range`);
  }
  if (fig.image && !fs.existsSync(path.join(packDir, fig.image))) E(`image path missing ${fig.image}`);
  for (const p of fig.panels ?? []) if (!fs.existsSync(path.join(packDir, p.image))) E(`panel image missing ${p.image}`);
  return out;
}
