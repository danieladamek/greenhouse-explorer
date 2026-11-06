/**
 * Local grow-log entries: for anyone without write access to the repo. Entries are kept in this browser only
 * (localStorage), shown on /grow-log marked "saved in this browser", and exported either as the workbook with the
 * new rows merged in (ready for someone with access to upload) or as a CSV of just the new rows.
 * Storage can be unavailable (private windows, blocked site data): every read and write is guarded.
 */
import { SLUG, assetUrl } from '@/lib/data';
import type { GrowLog } from '@/lib/growlog';

export type DraftSheet = 'Plantings' | 'Observations' | 'Harvests' | 'Water';
export interface Draft { sheet: DraftSheet; row: Record<string, string | number | null>; saved_at: string }

const KEY = `${SLUG}:growlog-drafts`;
export function readDrafts(): Draft[] {
  try { const s = localStorage.getItem(KEY); return s ? (JSON.parse(s) as Draft[]) : []; } catch { return []; }
}
export function writeDrafts(d: Draft[]): boolean {
  try { localStorage.setItem(KEY, JSON.stringify(d)); return true; } catch { return false; }
}

const PREFIX: Record<DraftSheet, string> = { Plantings: 'GL', Observations: 'O', Harvests: 'H', Water: 'W' };
/** Next free id for a sheet, counting both the published workbook and this browser's drafts. */
export function nextId(sheet: DraftSheet, g: GrowLog, drafts: Draft[]): string {
  const p = PREFIX[sheet];
  const existing = { Plantings: g.plantings, Observations: g.observations, Harvests: g.harvests, Water: g.water }[sheet].map((r) => r.id);
  const all = [...existing, ...drafts.filter((d) => d.sheet === sheet).map((d) => String(d.row.id))];
  const max = Math.max(0, ...all.map((id) => Number(id.match(new RegExp(`^${p}-(\\d+)$`))?.[1] ?? 0)));
  return `${p}-${String(max + 1).padStart(2, '0')}`;
}

/** The published grow log with this browser's drafts merged in (drafts carry `local: true`). */
export function withDrafts(g: GrowLog, drafts: Draft[]): GrowLog & { localIds: Set<string> } {
  const localIds = new Set(drafts.map((d) => String(d.row.id)));
  const s = (v: unknown) => (v == null || v === '' ? null : String(v));
  const n = (v: unknown) => (v == null || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));
  const plantings = [...g.plantings, ...drafts.filter((d) => d.sheet === 'Plantings').map(({ row: r }) => ({
    id: String(r.id), crop: s(r.crop_as_entered) ?? '', scientific_as_entered: s(r.scientific_as_entered), taxon_id: s(r.taxon_id), accepted_name: null, family: null,
    cultivar: s(r.cultivar), location: s(r.location), location_note: null, location_kind: null, method: s(r.method), date_planted: s(r.date_planted),
    date_inventoried: s(r.date_inventoried), condition: s(r.condition), condition_notes: null, last_checked: null,
  }))];
  const byId = new Map(plantings.map((p) => [p.id, p]));
  return {
    ...g, localIds, plantings,
    observations: [...g.observations, ...drafts.filter((d) => d.sheet === 'Observations').map(({ row: r }) => ({
      id: String(r.id), date: s(r.date), planting_id: s(r.planting_id), taxon_id: byId.get(String(r.planting_id))?.taxon_id ?? null, plant: byId.get(String(r.planting_id))?.crop ?? null,
      condition: s(r.condition), pest_disease: s(r.pest_disease), stem_height_cm: n(r.stem_height_cm), stem_diameter_mm: n(r.stem_diameter_mm), leaf_flower: s(r.leaf_flower), observer: s(r.observer),
    }))],
    harvests: [...g.harvests, ...drafts.filter((d) => d.sheet === 'Harvests').map(({ row: r }) => {
      const p = byId.get(String(r.planting_id)); const fresh = n(r.fresh_g), dry = n(r.dry_g);
      return {
        id: String(r.id), date: s(r.date), planting_id: s(r.planting_id), taxon_id: p?.taxon_id ?? null, plant: p?.crop ?? null, part: s(r.part), fresh_g: fresh, dry_g: dry,
        water_lost_pct: fresh && dry != null ? Math.round((1 - dry / fresh) * 1000) / 10 : null, drying: s(r.drying), storage: s(r.storage), location: p?.location ?? null, method: p?.method ?? null, preparations: [],
      };
    })],
    water: [...g.water, ...drafts.filter((d) => d.sheet === 'Water').map(({ row: r }) => ({
      id: String(r.id), date: s(r.date), system: s(r.system), ec: n(r.ec), ec_unit: s(r.ec_unit), water_temp_c: n(r.water_temp_c), ph: n(r.ph), nutrient_additions: s(r.nutrient_additions), water_change: s(r.water_change),
    }))],
  };
}

function save(blob: Blob, name: string) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}

/** The published workbook with this browser's drafts appended to the matching sheets (columns matched by header). */
export async function downloadMergedWorkbook(sourcePath: string, drafts: Draft[]) {
  const XLSX = await import('xlsx');
  const buf = await fetch(assetUrl(sourcePath)).then((r) => { if (!r.ok) throw new Error(String(r.status)); return r.arrayBuffer(); });
  const wb = XLSX.read(buf, { type: 'array', cellDates: true });
  for (const sheet of ['Plantings', 'Observations', 'Harvests', 'Water'] as DraftSheet[]) {
    const rows = drafts.filter((d) => d.sheet === sheet);
    const ws = wb.Sheets[sheet];
    if (!rows.length || !ws) continue;
    const header = (XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1 })[0] ?? []).map(String);
    XLSX.utils.sheet_add_aoa(ws, rows.map((d) => header.map((h) => {
      const val = d.row[h] ?? null;
      return /date|last_checked/.test(h) && typeof val === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(val) ? new Date(`${val}T12:00:00`) : val;
    })), { origin: -1, cellDates: true });
  }
  const out = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
  save(new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), 'grow-log.xlsx');
}

/** Just this browser's drafts, one CSV row per entry. */
export function downloadDraftsCsv(drafts: Draft[]) {
  const cols = [...new Set(['sheet', 'saved_at', ...drafts.flatMap((d) => Object.keys(d.row))])];
  const esc = (v: unknown) => { const s = v == null ? '' : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const lines = [cols.join(','), ...drafts.map((d) => cols.map((c) => esc(c === 'sheet' ? d.sheet : c === 'saved_at' ? d.saved_at : d.row[c])).join(','))];
  save(new Blob([lines.join('\n')], { type: 'text/csv' }), 'grow-log-local-entries.csv');
}
