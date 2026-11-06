/**
 * Grow log build (manager lane). Reads growlog/grow-log.xlsx — the workbook greenhouse staff edit and upload — links
 * it to the catalogue (taxa, Tea Time preparations), runs light checks, and writes:
 *   src/data/growlog.json            the model the /grow-log page, plant pages, /greenhouse and /tea read
 *   public/growlog/grow-log-report.xlsx  a spreadsheet report (summary, by location, hydro vs soil, yields, checks)
 *   public/growlog/*.csv             one CSV per table, for anyone who wants the raw rows
 *
 * Data-quality problems never fail the build: they become "Data checks" on the page and in the report. The build
 * fails only if the workbook is missing or cannot be read, so a bad upload leaves the last good site in place.
 * Grow-log records are greenhouse records, not scientific claims; nothing here touches content-pack/.
 */
import fs from 'node:fs';
import path from 'node:path';
import * as XLSX from 'xlsx';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const SRC = path.join(ROOT, 'growlog/grow-log.xlsx');
const OUT_JSON = path.join(ROOT, 'src/data/growlog.json');
const OUT_DIR = path.join(ROOT, 'public/growlog');
const SITE = (process.env.SITE_URL ?? 'https://danieladamek.github.io/greenhouse-explorer').replace(/\/$/, '');

type Row = Record<string, string | number | null>;
export interface Check { level: 'warn' | 'info'; sheet: string; id: string | null; message: string }

if (!fs.existsSync(SRC)) { console.error(`grow log: ${SRC} not found`); process.exit(1); }
const wb = XLSX.read(fs.readFileSync(SRC), { type: 'buffer', cellDates: true });

const iso = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
function clean(v: unknown): string | number | null {
  if (v == null) return null;
  if (v instanceof Date) return iso(v);
  if (typeof v === 'number') return v;
  const s = String(v).trim();
  if (!s || /^n\/?a$/i.test(s) || s === '—' || s === '-') return null;
  return s;
}
function sheet(name: string): Row[] {
  const ws = wb.Sheets[name];
  if (!ws) return [];
  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: null, raw: true });
  return raw.map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k.trim(), clean(v)]))).filter((r) => Object.values(r).some((v) => v != null));
}
const str = (v: unknown) => (v == null ? null : String(v));
const num = (v: unknown) => (v == null || v === '' ? null : Number.isFinite(Number(v)) ? Number(v) : null);
const date = (v: unknown) => { const s = str(v); return s && /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : s; };

const taxa: { id: string; accepted_name: string; common_names: string[]; family: string }[] = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/taxa-index.json'), 'utf8'));
const taxonById = new Map(taxa.map((t) => [t.id, t]));
const preps: { id: string; name: string; plants: string[] }[] = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/preparations.json'), 'utf8'));

const checks: Check[] = [];
const chk = (level: Check['level'], sheetName: string, id: string | null, message: string) => checks.push({ level, sheet: sheetName, id, message });

/* ── locations */
const locations = sheet('Locations').map((r) => ({ id: str(r.id)!, kind: str(r.kind) ?? 'unknown', label: str(r.label) ?? str(r.id)!, note: str(r.note) })).filter((l) => l.id);
const locById = new Map(locations.map((l) => [l.id, l]));

/* ── plantings */
const plantings = sheet('Plantings').map((r, i) => {
  const id = str(r.id) ?? `row-${i + 2}`;
  const taxon_id = str(r.taxon_id);
  const t = taxon_id ? taxonById.get(taxon_id) : undefined;
  const location = str(r.location);
  const method = str(r.method)?.toLowerCase() ?? null;
  if (!str(r.id)) chk('warn', 'Plantings', id, 'Row has no id — give it one (GL-nn) so observations and harvests can point to it.');
  if (taxon_id && !t) chk('warn', 'Plantings', id, `taxon_id "${taxon_id}" is not in the catalogue — pick one from the Lists sheet, or leave it empty.`);
  if (!taxon_id) chk('info', 'Plantings', id, `${str(r.crop_as_entered) ?? 'This plant'} is not in the catalogue yet, so it has no plant page.`);
  if (!location) chk('warn', 'Plantings', id, 'No location recorded.');
  else if (!locById.has(location)) chk('warn', 'Plantings', id, `Location "${location}" is not on the Locations sheet.`);
  if (!method) chk('warn', 'Plantings', id, 'No growing method recorded.');
  else if (!['hydroponic', 'soil'].includes(method)) chk('warn', 'Plantings', id, `Growing method "${method}" — expected hydroponic or soil.`);
  if (str(r.cleanup)) chk('info', 'Plantings', id, `Import note: ${str(r.cleanup)}`);
  return {
    id, crop: str(r.crop_as_entered) ?? '', scientific_as_entered: str(r.scientific_as_entered), taxon_id: t ? taxon_id : null,
    accepted_name: t?.accepted_name ?? null, family: t?.family ?? null, cultivar: str(r.cultivar), location, location_note: str(r.location_note),
    location_kind: location ? locById.get(location)?.kind ?? null : null, method, date_planted: date(r.date_planted), date_inventoried: date(r.date_inventoried),
    condition: str(r.condition), condition_notes: str(r.condition_notes), last_checked: date(r.last_checked),
  };
});
const plantingById = new Map(plantings.map((p) => [p.id, p]));

/* ── observations */
const observations = sheet('Observations').map((r, i) => {
  const id = str(r.id) ?? `obs-row-${i + 2}`;
  const pid = str(r.planting_id);
  const p = pid ? plantingById.get(pid) : undefined;
  if (!pid) chk('warn', 'Observations', id, 'No planting_id — which planting was observed?');
  else if (!p) chk('warn', 'Observations', id, `planting_id "${pid}" is not on the Plantings sheet.`);
  const locAs = str(r.location_as_entered);
  if (p && locAs && p.location && locAs !== p.location) chk('warn', 'Observations', id, `Observed at ${locAs}, but ${p.id} is recorded in ${p.location}.`);
  if (!date(r.date)) chk('warn', 'Observations', id, 'No date.');
  if (!str(r.observer)) chk('info', 'Observations', id, 'No observer recorded.');
  if (str(r.cleanup)) chk('info', 'Observations', id, `Import note: ${str(r.cleanup)}`);
  return {
    id, date: date(r.date), planting_id: p ? pid : null, taxon_id: p?.taxon_id ?? null, plant: str(r.plant_as_entered) ?? p?.crop ?? null,
    condition: str(r.condition), pest_disease: str(r.pest_disease), stem_height_cm: num(r.stem_height_cm), stem_diameter_mm: num(r.stem_diameter_mm),
    leaf_flower: str(r.leaf_flower), observer: str(r.observer),
  };
});

/* ── water */
const water = sheet('Water').map((r, i) => {
  const id = str(r.id) ?? `water-row-${i + 2}`;
  const system = str(r.system);
  if (!system) chk('warn', 'Water', id, 'No system recorded.');
  else if (!locById.has(system)) chk('warn', 'Water', id, `System "${system}" is not on the Locations sheet.`);
  if (num(r.ec) != null && !str(r.ec_unit)) chk('info', 'Water', id, 'EC has no unit — record µS/cm or mS/cm.');
  return { id, date: date(r.date), system, ec: num(r.ec), ec_unit: str(r.ec_unit), water_temp_c: num(r.water_temp_c), ph: num(r.ph), nutrient_additions: str(r.nutrient_additions), water_change: str(r.water_change) };
});

/* ── harvests */
const harvests = sheet('Harvests').map((r, i) => {
  const id = str(r.id) ?? `harvest-row-${i + 2}`;
  const pid = str(r.planting_id);
  const p = pid ? plantingById.get(pid) : undefined;
  const taxon_id = p?.taxon_id ?? (str(r.taxon_id) && taxonById.has(str(r.taxon_id)!) ? str(r.taxon_id) : null);
  const fresh = num(r.fresh_g), dry = num(r.dry_g);
  if (!pid) chk('warn', 'Harvests', id, `No planting_id${str(r.cleanup) ? '' : ' — which planting was harvested?'}${str(r.cleanup) ? ` (${str(r.cleanup)})` : ''}`);
  else if (!p) chk('warn', 'Harvests', id, `planting_id "${pid}" is not on the Plantings sheet.`);
  if (fresh == null && dry != null) chk('info', 'Harvests', id, 'No fresh weight, so the water lost in drying cannot be worked out.');
  if (fresh != null && dry != null && dry > fresh) chk('warn', 'Harvests', id, 'Dry weight is greater than fresh weight.');
  return {
    id, date: date(r.date), planting_id: p ? pid : null, taxon_id, plant: str(r.plant_as_entered) ?? p?.crop ?? null, part: str(r.part),
    fresh_g: fresh, dry_g: dry, water_lost_pct: fresh != null && dry != null && fresh > 0 ? Math.round((1 - dry / fresh) * 1000) / 10 : null,
    drying: str(r.drying), storage: str(r.storage), location: p?.location ?? null, method: p?.method ?? null,
    preparations: taxon_id ? preps.filter((x) => x.plants.includes(taxon_id)).map((x) => ({ id: x.id, name: x.name })) : [],
  };
});

/* ── seeds */
const seeds = sheet('Seeds').map((r, i) => {
  const id = str(r.id) ?? `seed-row-${i + 2}`;
  const taxon_id = str(r.taxon_id);
  if (taxon_id && !taxonById.has(taxon_id)) chk('warn', 'Seeds', id, `taxon_id "${taxon_id}" is not in the catalogue.`);
  if (str(r.cleanup)) chk(/check|not tulsi/i.test(str(r.cleanup)!) ? 'warn' : 'info', 'Seeds', id, `Import note: ${str(r.cleanup)}`);
  return { id, date_inventoried: date(r.date_inventoried), plant: str(r.plant_as_entered), scientific_as_entered: str(r.scientific_as_entered), taxon_id: taxon_id && taxonById.has(taxon_id) ? taxon_id : null, cultivar: str(r.cultivar), supplier: str(r.supplier) };
});

/* duplicate ids */
for (const [name, list] of [['Plantings', plantings], ['Observations', observations], ['Water', water], ['Harvests', harvests], ['Seeds', seeds]] as const) {
  const seen = new Set<string>();
  for (const r of list as { id: string }[]) { if (seen.has(r.id)) chk('warn', name, r.id, 'Duplicate id.'); seen.add(r.id); }
}

/* ── hydroponic vs soil: the same plant growing both ways (the comparison the walk notes and Lara's idea describe) */
const groupKey = (p: (typeof plantings)[number]) => p.taxon_id ?? `name:${(p.scientific_as_entered ?? p.crop).toLowerCase()}`;
const groups = new Map<string, (typeof plantings)[number][]>();
for (const p of plantings) { const k = groupKey(p); groups.set(k, [...(groups.get(k) ?? []), p]); }
const pairs = [...groups.values()].filter((g) => g.some((p) => p.method === 'hydroponic') && g.some((p) => p.method === 'soil')).map((g) => ({
  taxon_id: g[0].taxon_id, name: g[0].accepted_name ?? g[0].scientific_as_entered ?? g[0].crop, crop: g[0].crop,
  hydroponic: g.filter((p) => p.method === 'hydroponic').map((p) => p.id), soil: g.filter((p) => p.method === 'soil').map((p) => p.id),
  observations: observations.filter((o) => g.some((p) => p.id === o.planting_id)).length,
  harvests: harvests.filter((h) => g.some((p) => p.id === h.planting_id)).length,
}));

const allDates = [...plantings.map((p) => p.date_inventoried), ...observations.map((o) => o.date), ...water.map((w) => w.date), ...harvests.map((h) => h.date), ...seeds.map((s) => s.date_inventoried)].filter(Boolean).sort() as string[];
const model = {
  source: 'growlog/grow-log.xlsx', built: new Date().toISOString().slice(0, 10), latest_entry: allDates.at(-1) ?? null,
  locations, plantings, observations, water, harvests, seeds, pairs,
  checks: checks.sort((a, b) => (a.level === b.level ? 0 : a.level === 'warn' ? -1 : 1)),
  reports: { source: 'growlog/grow-log.xlsx', xlsx: 'growlog/grow-log-report.xlsx', csv: ['plantings', 'observations', 'water', 'harvests', 'seeds', 'checks'].map((n) => `growlog/${n}.csv`) },
};
fs.writeFileSync(OUT_JSON, JSON.stringify(model, null, 1));

/* ── reports */
fs.mkdirSync(OUT_DIR, { recursive: true });
const plantUrl = (id: string | null) => (id ? `${SITE}/plants/${id}` : '');
const tables: Record<string, Record<string, unknown>[]> = {
  plantings: plantings.map((p) => ({ id: p.id, crop: p.crop, scientific_name: p.accepted_name ?? p.scientific_as_entered, in_catalogue: p.taxon_id ? 'yes' : 'not yet', cultivar: p.cultivar, location: p.location, method: p.method, date_planted: p.date_planted, date_inventoried: p.date_inventoried, condition: p.condition, plant_page: plantUrl(p.taxon_id) })),
  observations: observations.map((o) => ({ id: o.id, date: o.date, planting_id: o.planting_id, plant: o.plant, condition: o.condition, pest_disease: o.pest_disease, stem_height_cm: o.stem_height_cm, stem_diameter_mm: o.stem_diameter_mm, leaf_flower: o.leaf_flower, observer: o.observer })),
  water: water.map((w) => ({ id: w.id, date: w.date, system: w.system, ec: w.ec, ec_unit: w.ec_unit, water_temp_c: w.water_temp_c, ph: w.ph, nutrient_additions: w.nutrient_additions, water_change: w.water_change })),
  harvests: harvests.map((h) => ({ id: h.id, date: h.date, planting_id: h.planting_id, plant: h.plant, part: h.part, location: h.location, method: h.method, fresh_g: h.fresh_g, dry_g: h.dry_g, water_lost_pct: h.water_lost_pct, drying: h.drying, storage: h.storage, tea_time: h.preparations.map((p) => p.name).join('; '), plant_page: plantUrl(h.taxon_id) })),
  seeds: seeds.map((s) => ({ id: s.id, date_inventoried: s.date_inventoried, plant: s.plant, scientific_as_entered: s.scientific_as_entered, cultivar: s.cultivar, supplier: s.supplier, plant_page: plantUrl(s.taxon_id) })),
  checks: model.checks.map((c) => ({ level: c.level, sheet: c.sheet, id: c.id, message: c.message })),
};
for (const [n, rows] of Object.entries(tables)) fs.writeFileSync(path.join(OUT_DIR, `${n}.csv`), XLSX.utils.sheet_to_csv(XLSX.utils.json_to_sheet(rows)));

const out = XLSX.utils.book_new();
const summary = [
  ['Greenhouse Explorer · Grow log report'], [],
  ['Generated', model.built], ['Source', 'growlog/grow-log.xlsx (uploaded by greenhouse staff)'], ['Latest entry', model.latest_entry ?? ''], ['Page', `${SITE}/grow-log`], [],
  ['Plantings', plantings.length], ['…in the catalogue', plantings.filter((p) => p.taxon_id).length], ['…hydroponic', plantings.filter((p) => p.method === 'hydroponic').length], ['…soil', plantings.filter((p) => p.method === 'soil').length],
  ['Observations', observations.length], ['Water readings', water.length], ['Harvest lots', harvests.length], ['Dry weight harvested (g)', Math.round(harvests.reduce((a, h) => a + (h.dry_g ?? 0), 0) * 10) / 10], ['Seed lots', seeds.length],
  ['Plants growing both hydroponically and in soil', pairs.length], ['Data checks to look at', checks.filter((c) => c.level === 'warn').length], [],
  ['These are greenhouse records, not scientific claims.'],
];
XLSX.utils.book_append_sheet(out, XLSX.utils.aoa_to_sheet(summary), 'Summary');
const byLoc = locations.map((l) => { const ps = plantings.filter((p) => p.location === l.id); return { location: l.id, kind: l.kind, plantings: ps.length, plants: ps.map((p) => p.crop).join('; '), harvest_lots: harvests.filter((h) => h.location === l.id).length, latest_water_reading: water.filter((w) => w.system === l.id).map((w) => w.date).sort().at(-1) ?? '' }; });
XLSX.utils.book_append_sheet(out, XLSX.utils.json_to_sheet(byLoc), 'By location');
XLSX.utils.book_append_sheet(out, XLSX.utils.json_to_sheet(pairs.map((p) => ({ plant: p.name, hydroponic_plantings: p.hydroponic.join(', '), soil_plantings: p.soil.join(', '), observations: p.observations, harvest_lots: p.harvests, plant_page: plantUrl(p.taxon_id) }))), 'Hydro vs soil');
XLSX.utils.book_append_sheet(out, XLSX.utils.json_to_sheet(tables.harvests), 'Harvest yields');
XLSX.utils.book_append_sheet(out, XLSX.utils.json_to_sheet(tables.plantings), 'Plantings');
XLSX.utils.book_append_sheet(out, XLSX.utils.json_to_sheet(tables.observations), 'Observations');
XLSX.utils.book_append_sheet(out, XLSX.utils.json_to_sheet(tables.water), 'Water');
XLSX.utils.book_append_sheet(out, XLSX.utils.json_to_sheet(tables.checks), 'Data checks');
for (const name of out.SheetNames) {
  const ws = out.Sheets[name]; const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1 });
  ws['!cols'] = (rows[0] ?? []).map((_, i) => ({ wch: Math.min(60, Math.max(10, ...rows.map((r) => String((r as unknown[])[i] ?? '').length + 2))) }));
}
XLSX.writeFile(out, path.join(OUT_DIR, 'grow-log-report.xlsx'));
fs.copyFileSync(SRC, path.join(OUT_DIR, 'grow-log.xlsx')); // the current source workbook, so staff can download, edit and re-upload it

console.log(`grow log: ${plantings.length} plantings · ${observations.length} observations · ${water.length} water · ${harvests.length} harvests · ${seeds.length} seeds · ${pairs.length} hydro/soil pairs · ${checks.filter((c) => c.level === 'warn').length} warnings, ${checks.filter((c) => c.level === 'info').length} notes → src/data/growlog.json, public/growlog/`);
