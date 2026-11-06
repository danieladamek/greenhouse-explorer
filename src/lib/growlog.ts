/**
 * The grow log (manager lane): greenhouse records built from growlog/grow-log.xlsx by scripts/build-growlog.ts.
 * Greenhouse records, not scientific claims — nothing here feeds evidence grades or occurrence rows.
 */
export interface GLLocation { id: string; kind: string; label: string; note: string | null }
export interface GLPlanting {
  id: string; crop: string; scientific_as_entered: string | null; taxon_id: string | null; accepted_name: string | null; family: string | null;
  cultivar: string | null; location: string | null; location_note: string | null; location_kind: string | null; method: string | null;
  date_planted: string | null; date_inventoried: string | null; condition: string | null; condition_notes: string | null; last_checked: string | null;
}
export interface GLObservation { id: string; date: string | null; planting_id: string | null; taxon_id: string | null; plant: string | null; condition: string | null; pest_disease: string | null; stem_height_cm: number | null; stem_diameter_mm: number | null; leaf_flower: string | null; observer: string | null }
export interface GLWater { id: string; date: string | null; system: string | null; ec: number | null; ec_unit: string | null; water_temp_c: number | null; ph: number | null; nutrient_additions: string | null; water_change: string | null }
export interface GLHarvest {
  id: string; date: string | null; planting_id: string | null; taxon_id: string | null; plant: string | null; part: string | null;
  fresh_g: number | null; dry_g: number | null; water_lost_pct: number | null; drying: string | null; storage: string | null;
  location: string | null; method: string | null; preparations: { id: string; name: string }[];
}
export interface GLSeed { id: string; date_inventoried: string | null; plant: string | null; scientific_as_entered: string | null; taxon_id: string | null; cultivar: string | null; supplier: string | null }
export interface GLPair { taxon_id: string | null; name: string; crop: string; hydroponic: string[]; soil: string[]; observations: number; harvests: number }
export interface GLCheck { level: 'warn' | 'info'; sheet: string; id: string | null; message: string }
export interface GrowLog {
  source: string; built: string; latest_entry: string | null;
  locations: GLLocation[]; plantings: GLPlanting[]; observations: GLObservation[]; water: GLWater[]; harvests: GLHarvest[]; seeds: GLSeed[];
  pairs: GLPair[]; checks: GLCheck[]; reports: { source: string; xlsx: string; csv: string[] };
}

let cached: Promise<GrowLog> | null = null;
export const loadGrowLog = () => (cached ??= import('@/data/growlog.json').then((m) => m.default as unknown as GrowLog));

/** Where staff upload a new version of the workbook (GitHub's web upload into growlog/ on main). */
export const UPLOAD_URL = 'https://github.com/danieladamek/greenhouse-explorer/upload/main/growlog';
export const ACTIONS_URL = 'https://github.com/danieladamek/greenhouse-explorer/actions';

export const methodLabel = (m: string | null) => (m === 'hydroponic' ? 'Hydroponic' : m === 'soil' ? 'Soil' : 'Method not recorded');

/** Everything in the grow log about one catalogue taxon (and, for the unresolved skullcap, its candidates). */
export function forTaxa(g: GrowLog, ids: string[]) {
  const plantings = g.plantings.filter((p) => p.taxon_id && ids.includes(p.taxon_id));
  const pIds = new Set(plantings.map((p) => p.id));
  return {
    plantings,
    observations: g.observations.filter((o) => (o.planting_id && pIds.has(o.planting_id)) || (o.taxon_id && ids.includes(o.taxon_id))),
    harvests: g.harvests.filter((h) => (h.planting_id && pIds.has(h.planting_id)) || (h.taxon_id && ids.includes(h.taxon_id))),
    seeds: g.seeds.filter((s) => s.taxon_id && ids.includes(s.taxon_id)),
  };
}
