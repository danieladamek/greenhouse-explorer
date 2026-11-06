import { useState } from 'react';
import { taxaIndex } from '@/lib/data';
import type { GrowLog } from '@/lib/growlog';
import { downloadDraftsCsv, downloadMergedWorkbook, nextId, writeDrafts, type Draft, type DraftSheet } from '@/lib/growlog-local';

type Field = { key: string; label: string; type?: 'text' | 'date' | 'number' | 'select'; options?: [string, string][]; required?: boolean; step?: string };
const today = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);

function fields(sheet: DraftSheet, g: GrowLog): Field[] {
  const plantings: [string, string][] = g.plantings.map((p) => [p.id, `${p.id} · ${p.crop}${p.location ? ` · ${p.location}` : ''}`]);
  const locs: [string, string][] = g.locations.map((l) => [l.id, `${l.id} (${l.kind})`]);
  switch (sheet) {
    case 'Observations': return [
      { key: 'planting_id', label: 'Planting', type: 'select', options: plantings, required: true }, { key: 'date', label: 'Date', type: 'date', required: true },
      { key: 'condition', label: 'Condition', required: true }, { key: 'pest_disease', label: 'Pests or disease' },
      { key: 'stem_height_cm', label: 'Stem height (cm)', type: 'number', step: '0.1' }, { key: 'leaf_flower', label: 'Leaf / flower stage' }, { key: 'observer', label: 'Observer' },
    ];
    case 'Harvests': return [
      { key: 'planting_id', label: 'Planting', type: 'select', options: plantings, required: true }, { key: 'date', label: 'Date', type: 'date', required: true },
      { key: 'part', label: 'Part harvested', type: 'select', options: ['leaves', 'leaves and stem', 'flowers', 'aerial parts', 'root', 'seeds', 'whole plant'].map((x) => [x, x]), required: true },
      { key: 'fresh_g', label: 'Fresh weight (g)', type: 'number', step: '0.1' }, { key: 'dry_g', label: 'Dry weight (g)', type: 'number', step: '0.1' },
      { key: 'drying', label: 'Drying method' }, { key: 'storage', label: 'Storage' },
    ];
    case 'Water': return [
      { key: 'system', label: 'System', type: 'select', options: locs, required: true }, { key: 'date', label: 'Date', type: 'date', required: true },
      { key: 'ec', label: 'EC', type: 'number', step: '1' }, { key: 'ec_unit', label: 'EC unit', type: 'select', options: [['µS/cm', 'µS/cm'], ['mS/cm', 'mS/cm']] },
      { key: 'water_temp_c', label: 'Water temp (°C)', type: 'number', step: '0.1' }, { key: 'ph', label: 'pH', type: 'number', step: '0.1' }, { key: 'nutrient_additions', label: 'Nutrient additions' },
    ];
    case 'Plantings': return [
      { key: 'crop_as_entered', label: 'Crop (common name)', required: true }, { key: 'taxon_id', label: 'Catalogue plant', type: 'select', options: [['', '— not in the catalogue —'], ...taxaIndex.map((t) => [t.id, `${t.accepted_name} · ${t.common_names[0] ?? ''}`] as [string, string])] },
      { key: 'scientific_as_entered', label: 'Scientific name (as on label)' }, { key: 'cultivar', label: 'Cultivar' },
      { key: 'location', label: 'Location', type: 'select', options: locs, required: true }, { key: 'method', label: 'Method', type: 'select', options: [['hydroponic', 'hydroponic'], ['soil', 'soil']], required: true },
      { key: 'date_planted', label: 'Date planted', type: 'date' }, { key: 'condition', label: 'Condition' },
    ];
  }
}

const LABEL: Record<DraftSheet, string> = { Observations: 'Observation', Harvests: 'Harvest', Water: 'Water reading', Plantings: 'New planting' };

/** /grow-log: add entries in this browser (no GitHub access needed), then hand them on as a workbook or CSV. */
export default function GrowLogEntry({ g, drafts, setDrafts }: { g: GrowLog; drafts: Draft[]; setDrafts: (d: Draft[]) => void }) {
  const [sheet, setSheet] = useState<DraftSheet>('Observations');
  const [vals, setVals] = useState<Record<string, string>>({ date: today() });
  const [msg, setMsg] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const fs = fields(sheet, g);
  const update = (d: Draft[]) => { setDrafts(d); if (!writeDrafts(d)) setMsg('This browser is not letting the page store data (private window or blocked site data). Download your entries before leaving the page.'); };

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const missing = fs.filter((f) => f.required && !vals[f.key]);
    if (missing.length) { setMsg(`Fill in: ${missing.map((f) => f.label).join(', ')}.`); return; }
    const id = nextId(sheet, g, drafts);
    const row: Draft['row'] = { id };
    for (const f of fs) { const v = vals[f.key]; row[f.key] = v === undefined || v === '' ? null : f.type === 'number' ? Number(v) : v; }
    if (sheet === 'Observations') { const p = g.plantings.find((x) => x.id === row.planting_id); row.plant_as_entered = p?.crop ?? null; row.location_as_entered = p?.location ?? null; }
    if (sheet === 'Harvests') { const p = g.plantings.find((x) => x.id === row.planting_id); row.plant_as_entered = p?.crop ?? null; row.taxon_id = p?.taxon_id ?? null; }
    update([...drafts, { sheet, row, saved_at: new Date().toISOString() }]);
    setVals({ date: today() });
    setMsg(`${LABEL[sheet]} ${id} saved in this browser.`);
  }

  return (
    <section className="mt-10 bx-card p-4 sm:p-5" aria-labelledby="entry-h" data-testid="growlog-entry">
      <h2 id="entry-h" className="text-2xl">Add an entry</h2>
      <p className="bx-prose mt-1 max-w-3xl text-sm">
        No GitHub access needed. Entries are <strong>saved in this browser only</strong> and appear on this page marked “saved in this browser”. When you're done, download the workbook with your entries merged in and send it to someone who can upload it — or download just your entries as a CSV.
      </p>
      <div className="mt-3 flex flex-wrap gap-1" role="tablist" aria-label="Entry type">
        {(['Observations', 'Harvests', 'Water', 'Plantings'] as DraftSheet[]).map((s) => (
          <button key={s} type="button" role="tab" aria-selected={sheet === s} className={`bx-btn ${sheet === s ? 'bx-btn-on' : ''}`} onClick={() => { setSheet(s); setVals({ date: today() }); setMsg(null); }}>{LABEL[s]}</button>
        ))}
      </div>
      <form className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-sm" onSubmit={submit}>
        {fs.map((f) => (
          <label key={f.key} className="grid gap-1">
            <span className="font-semibold">{f.label}{f.required && <span aria-hidden="true"> *</span>}</span>
            {f.type === 'select' ? (
              <select className="bx-input" value={vals[f.key] ?? ''} onChange={(e) => setVals({ ...vals, [f.key]: e.target.value })} required={f.required}>
                {!f.options?.some(([v]) => v === '') && <option value="">Choose…</option>}
                {f.options?.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            ) : (
              <input className="bx-input" type={f.type ?? 'text'} step={f.step} value={vals[f.key] ?? ''} onChange={(e) => setVals({ ...vals, [f.key]: e.target.value })} required={f.required} />
            )}
          </label>
        ))}
        <div className="flex items-end"><button type="submit" className="bx-btn-primary" data-testid="growlog-save">Save in this browser</button></div>
      </form>
      {msg && <p className="mt-2 text-sm" role="status" data-testid="growlog-msg">{msg}</p>}

      {drafts.length > 0 && (
        <div className="mt-5 border-t border-[color:var(--bx-line)] pt-4" data-testid="growlog-drafts">
          <h3 className="text-lg">Your entries in this browser ({drafts.length})</h3>
          <ul className="mt-2 grid gap-1 text-sm">
            {drafts.map((d, i) => (
              <li key={i} className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs">{String(d.row.id)}</span><span className="bx-status">{LABEL[d.sheet]}</span>
                <span className="text-xs">{[d.row.date ?? d.row.date_planted, d.row.plant_as_entered ?? d.row.crop_as_entered ?? d.row.system, d.row.condition ?? d.row.part ?? (d.row.ec != null ? `EC ${d.row.ec}` : null)].filter(Boolean).join(' · ')}</span>
                <button type="button" className="text-xs underline bx-muted" onClick={() => update(drafts.filter((_, j) => j !== i))}>remove</button>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex flex-wrap gap-2 text-sm">
            <button type="button" className="bx-btn-primary" onClick={() => downloadMergedWorkbook(g.reports.source, drafts).catch(() => setMsg('Could not build the workbook — download your entries as CSV instead.'))} data-testid="growlog-download-merged">⬇ Workbook with my entries (.xlsx)</button>
            <button type="button" className="bx-btn" onClick={() => downloadDraftsCsv(drafts)}>⬇ My entries only (.csv)</button>
            <button type="button" className="bx-btn" onClick={() => { if (confirming) { update([]); setConfirming(false); } else setConfirming(true); }}>{confirming ? 'Click again to clear them all' : 'Clear my entries'}</button>
          </div>
          <p className="mt-2 text-xs bx-muted">Once the workbook has been uploaded, clear your entries so they are not counted twice.</p>
        </div>
      )}
    </section>
  );
}
