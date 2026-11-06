import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { assetUrl } from '@/lib/data';
import { ACTIONS_URL, UPLOAD_URL, loadGrowLog, methodLabel, type GLPlanting, type GrowLog as GL } from '@/lib/growlog';
import { useAsync } from '@/lib/heavy';
import { MethodChip } from '@/components/catalogue/GrowLogBits';
import { TaxonName } from '@/components/catalogue/Chips';
import GrowLogEntry from '@/components/catalogue/GrowLogEntry';
import { readDrafts, withDrafts, type Draft } from '@/lib/growlog-local';

const Local = ({ show }: { show: boolean }) => (show ? <span className="bx-chip !bg-sky-100 text-sky-900 dark:!bg-sky-900/40 dark:text-sky-100 ml-1" title="Saved in this browser only — not yet in the workbook">saved in this browser</span> : null);

const dash = <span className="bx-muted">—</span>;
const v = (x: string | number | null | undefined, unit = '') => (x == null || x === '' ? dash : `${x}${unit}`);

function Plant({ p }: { p: GLPlanting }) {
  return p.taxon_id
    ? <><TaxonName id={p.taxon_id} /><span className="block text-xs bx-muted">{p.crop}</span></>
    : <><span>{p.crop}</span>{p.scientific_as_entered && <i className="block text-xs bx-muted">{p.scientific_as_entered}</i>}<span className="bx-todo mt-0.5">not in the catalogue yet</span></>;
}

function Stat({ n, label }: { n: number | string; label: string }) {
  return <div className="bx-card p-3"><div className="text-2xl font-semibold tabular-nums">{n}</div><div className="text-xs bx-muted">{label}</div></div>;
}

function Downloads({ g }: { g: GL }) {
  return (
    <div className="flex flex-wrap gap-2 text-sm" data-testid="growlog-downloads">
      <a className="bx-btn-primary" href={assetUrl(g.reports.xlsx)} download>⬇ Spreadsheet report (.xlsx)</a>
      {g.reports.csv.map((c) => <a key={c} className="bx-btn" href={assetUrl(c)} download>{c.split('/').pop()}</a>)}
    </div>
  );
}

/**
 * /grow-log — the greenhouse's own records (manager lane), built from growlog/grow-log.xlsx. It shows the workflow
 * end to end: staff edit one workbook, upload it, the site rebuilds, and reports come back out as spreadsheets.
 * Every planting with a catalogue taxon links to its plant page; harvest lots link to Tea Time.
 */
export default function GrowLog() {
  const base = useAsync(loadGrowLog);
  const [drafts, setDrafts] = useState<Draft[]>(() => readDrafts());
  const { hash } = useLocation();
  useEffect(() => { document.title = 'Grow log · Greenhouse Explorer'; }, []);
  useEffect(() => { if (base && hash) document.getElementById(decodeURIComponent(hash.slice(1)))?.scrollIntoView({ block: 'center' }); }, [base, hash]);
  if (!base) return <div className="mx-auto max-w-6xl px-4 py-8"><h1 className="text-3xl sm:text-4xl">Grow log</h1><p className="mt-4 bx-muted" role="status">Loading the grow log…</p></div>;
  const g = withDrafts(base, drafts);
  const loc = (id: string) => g.localIds.has(id);

  const byId = new Map(g.plantings.map((p) => [p.id, p]));
  const warns = g.checks.filter((c) => c.level === 'warn');
  const notes = g.checks.filter((c) => c.level === 'info');
  const dry = Math.round(g.harvests.reduce((a, h) => a + (h.dry_g ?? 0), 0) * 10) / 10;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <p className="text-[11px] font-semibold tracking-[0.2em] bx-muted">GREENHOUSE RECORDS · MANAGER LANE</p>
      <h1 className="text-3xl sm:text-4xl mt-1">Grow log</h1>
      <p className="bx-prose mt-2 max-w-3xl">
        What the greenhouse team records as it grows: which plants are where, grown how, how they are doing, what the hydroponic water reads, and what was harvested and dried.
        This page is built from one workbook that greenhouse staff keep and upload; each upload rebuilds the page and the downloadable reports.
        Seeded from Barbara Comer's medicinal-plant inventory (October 2026).
      </p>
      <p className="mt-2 text-sm bx-muted">Latest entry {g.latest_entry ?? '—'} · built {g.built} · these are greenhouse records, not scientific claims, and nothing here feeds an evidence grade.</p>

      <div className="mt-5 grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
        <Stat n={g.plantings.length} label="plantings" />
        <Stat n={g.locations.length} label="locations" />
        <Stat n={g.pairs.length} label="plants grown both hydroponically and in soil" />
        <Stat n={g.observations.length} label="observations" />
        <Stat n={`${dry} g`} label={`dried, in ${g.harvests.length} harvest lots`} />
        <Stat n={warns.length} label="data checks to look at" />
      </div>

      <section className="mt-6 bx-card p-4 sm:p-5 border-l-4 border-l-[color:var(--bx-accent)]" aria-labelledby="how-h" data-testid="growlog-how">
        <h2 id="how-h" className="text-xl">How the grow log works</h2>
        <ol className="mt-2 grid gap-2 sm:grid-cols-4 text-sm">
          <li><span className="font-semibold">1 · Edit.</span> Staff keep one workbook — plantings, observations, water, harvests, seeds, locations. <a className="underline" href={assetUrl(g.reports.source)} download>Download the current workbook</a>.</li>
          <li><span className="font-semibold">2 · Upload.</span> On GitHub, <a className="underline" href={UPLOAD_URL} target="_blank" rel="noreferrer">upload it to the growlog folder</a> with the same name, and commit.</li>
          <li><span className="font-semibold">3 · Rebuild.</span> The site rebuilds in a few minutes (<a className="underline" href={ACTIONS_URL} target="_blank" rel="noreferrer">progress</a>). Problems in the data show under Data checks; they never break the site.</li>
          <li><span className="font-semibold">4 · Report.</span> Every build writes a fresh spreadsheet report and CSVs, linked to the plant pages.</li>
        </ol>
        <div className="mt-3"><Downloads g={g} /></div>
        <p className="mt-2 text-xs bx-muted">No GitHub access? Use <a className="underline" href="#entry-h">Add an entry</a> below: entries are kept in your browser and can be handed on as a workbook.</p>
      </section>

      <GrowLogEntry g={g} drafts={drafts} setDrafts={setDrafts} />

      <section className="mt-10" aria-labelledby="where-h">
        <h2 id="where-h" className="text-2xl">Where things grow</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {g.locations.map((l) => {
            const ps = g.plantings.filter((p) => p.location === l.id);
            const w = g.water.filter((x) => x.system === l.id).sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''))[0];
            return (
              <article key={l.id} className="bx-card p-3 text-sm" data-testid="growlog-location">
                <div className="flex items-center gap-2"><h3 className="text-lg font-mono">{l.id}</h3><MethodChip method={l.kind === 'hydroponic' ? 'hydroponic' : l.kind === 'soil' ? 'soil' : null} /></div>
                <p className="text-xs bx-muted">{l.label}{l.note ? ` · ${l.note}` : ''}</p>
                <ul className="mt-2 grid gap-0.5">{ps.length ? ps.map((p) => <li key={p.id}><a className="font-mono text-xs underline mr-1" href={`#${p.id}`}>{p.id}</a>{p.taxon_id ? <Link className="underline decoration-dotted" to={`/plants/${p.taxon_id}`}>{p.crop}</Link> : p.crop}</li>) : <li className="bx-muted">no plantings recorded</li>}</ul>
                {w && <p className="mt-2 text-xs"><span className="font-semibold">Water {w.date}: </span>EC {v(w.ec)}{w.ec_unit ? ` ${w.ec_unit}` : ''} · {v(w.water_temp_c, ' °C')}{w.ph != null && ` · pH ${w.ph}`}</p>}
              </article>
            );
          })}
        </div>
      </section>

      <section className="mt-10" aria-labelledby="pairs-h" data-testid="growlog-pairs">
        <h2 id="pairs-h" className="text-2xl">Hydroponic vs soil</h2>
        <p className="bx-prose mt-1 max-w-3xl">Plants the greenhouse is growing both ways — the start of a side-by-side comparison. Observations and harvest lots recorded against each planting are what will make the comparison mean something.</p>
        <div className="mt-2 overflow-x-auto">
          <table className="bx-table">
            <thead><tr><th scope="col">Plant</th><th scope="col">Hydroponic</th><th scope="col">Soil</th><th scope="col">Observations</th><th scope="col">Harvest lots</th></tr></thead>
            <tbody>
              {g.pairs.map((p) => (
                <tr key={p.name}>
                  <td>{p.taxon_id ? <TaxonName id={p.taxon_id} withCommon /> : <>{p.crop} <i className="bx-muted">{p.name}</i></>}</td>
                  <td>{p.hydroponic.map((id) => <a key={id} className="font-mono text-xs underline mr-1" href={`#${id}`}>{id} ({byId.get(id)?.location ?? '?'})</a>)}</td>
                  <td>{p.soil.map((id) => <a key={id} className="font-mono text-xs underline mr-1" href={`#${id}`}>{id} ({byId.get(id)?.location ?? '?'})</a>)}</td>
                  <td className="tabular-nums">{p.observations}</td><td className="tabular-nums">{p.harvests}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-10" aria-labelledby="plantings-h">
        <h2 id="plantings-h" className="text-2xl">Plantings</h2>
        <div className="mt-2 overflow-x-auto">
          <table className="bx-table" data-testid="growlog-plantings">
            <thead><tr><th scope="col">Id</th><th scope="col">Plant</th><th scope="col">Cultivar</th><th scope="col">Location</th><th scope="col">Method</th><th scope="col">Planted</th><th scope="col">Inventoried</th><th scope="col">Condition</th></tr></thead>
            <tbody>
              {g.plantings.map((p) => (
                <tr key={p.id} id={p.id} className="scroll-mt-40">
                  <td className="font-mono text-xs whitespace-nowrap">{p.id}<Local show={loc(p.id)} /></td><td><Plant p={p} /></td><td className="text-xs">{v(p.cultivar)}</td>
                  <td className="text-xs">{p.location ?? <span className="bx-todo">not recorded</span>}{p.location_note && <span className="block bx-muted">{p.location_note}</span>}</td>
                  <td><MethodChip method={p.method} /></td><td className="text-xs whitespace-nowrap">{v(p.date_planted)}</td><td className="text-xs whitespace-nowrap">{v(p.date_inventoried)}</td>
                  <td className="text-xs">{v(p.condition)}{p.condition_notes && <span className="block bx-muted">{p.condition_notes}</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-10" aria-labelledby="obs-h">
        <h2 id="obs-h" className="text-2xl">Observations</h2>
        <ul className="mt-2 grid gap-2">
          {[...g.observations].sort((a, b) => (b.date ?? '').localeCompare(a.date ?? '')).map((o) => {
            const p = o.planting_id ? byId.get(o.planting_id) : undefined;
            return (
              <li key={o.id} id={o.id} className="bx-card p-3 text-sm scroll-mt-40 flex flex-wrap gap-x-4 gap-y-1" data-testid="growlog-observation">
                <span className="font-mono text-xs w-24">{o.date ?? 'no date'}<Local show={loc(o.id)} /></span>
                <span className="font-semibold">{p?.taxon_id ? <Link className="underline decoration-dotted" to={`/plants/${p.taxon_id}`}>{o.plant}</Link> : o.plant}</span>
                {p && <a className="font-mono text-xs underline" href={`#${p.id}`}>{p.id} · {p.location} · {methodLabel(p.method)}</a>}
                <span>{o.condition}</span>{o.pest_disease && <span className="bx-todo">{o.pest_disease}</span>}
                {(o.stem_height_cm != null || o.stem_diameter_mm != null) && <span className="text-xs">stem {v(o.stem_height_cm, ' cm')} · ⌀ {v(o.stem_diameter_mm, ' mm')}</span>}
                <span className="text-xs bx-muted ml-auto">{o.observer ? `observed by ${o.observer}` : 'observer not recorded'}</span>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="mt-10" aria-labelledby="harv-h">
        <h2 id="harv-h" className="text-2xl">Harvest and drying</h2>
        <p className="bx-prose mt-1 max-w-3xl">Each lot is a harvest from one planting: the part taken, its weight fresh and dried, how it was dried and stored. Where a Tea Time preparation uses the plant, the lot links to it.</p>
        <div className="mt-2 overflow-x-auto">
          <table className="bx-table" data-testid="growlog-harvests">
            <thead><tr><th scope="col">Lot</th><th scope="col">Date</th><th scope="col">Plant</th><th scope="col">From planting</th><th scope="col">Part</th><th scope="col">Fresh</th><th scope="col">Dry</th><th scope="col">Water lost</th><th scope="col">Drying · storage</th><th scope="col">Tea Time</th></tr></thead>
            <tbody>
              {g.harvests.map((h) => (
                <tr key={h.id} id={h.id} className="scroll-mt-40">
                  <td className="font-mono text-xs whitespace-nowrap">{h.id}<Local show={loc(h.id)} /></td><td className="text-xs whitespace-nowrap">{v(h.date)}</td>
                  <td>{h.taxon_id ? <TaxonName id={h.taxon_id} /> : h.plant}<span className="block text-xs bx-muted">{h.plant}</span></td>
                  <td className="text-xs">{h.planting_id ? <a className="underline font-mono" href={`#${h.planting_id}`}>{h.planting_id}</a> : <span className="bx-todo">not recorded</span>}{h.method && <span className="block">{methodLabel(h.method)} · {h.location}</span>}</td>
                  <td className="text-xs">{v(h.part)}</td><td className="text-xs tabular-nums">{v(h.fresh_g, ' g')}</td><td className="text-xs tabular-nums">{v(h.dry_g, ' g')}</td>
                  <td className="text-xs tabular-nums">{h.water_lost_pct != null ? `${h.water_lost_pct} %` : dash}</td>
                  <td className="text-xs">{v(h.drying)}{h.storage && <span className="block bx-muted">{h.storage}</span>}</td>
                  <td className="text-xs">{h.preparations.length ? h.preparations.map((p, i) => <span key={p.id}>{i ? '; ' : ''}<Link className="underline" to={`/tea#${p.id}`}>{p.name}</Link></span>) : dash}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="mt-10 grid gap-6 lg:grid-cols-2">
        <section aria-labelledby="water-h">
          <h2 id="water-h" className="text-2xl">Water quality</h2>
          <table className="bx-table mt-2">
            <thead><tr><th scope="col">Date</th><th scope="col">System</th><th scope="col">EC</th><th scope="col">Water temp</th><th scope="col">pH</th><th scope="col">Additions · changes</th></tr></thead>
            <tbody>{g.water.map((w) => <tr key={w.id} id={w.id}><td className="text-xs">{v(w.date)}<Local show={loc(w.id)} /></td><td className="font-mono text-xs">{v(w.system)}</td><td className="text-xs">{v(w.ec)} {w.ec_unit ?? <span className="bx-todo">unit?</span>}</td><td className="text-xs">{v(w.water_temp_c, ' °C')}</td><td className="text-xs">{v(w.ph)}</td><td className="text-xs">{[w.nutrient_additions, w.water_change].filter(Boolean).join(' · ') || dash}</td></tr>)}</tbody>
          </table>
        </section>
        <section aria-labelledby="seeds-h">
          <h2 id="seeds-h" className="text-2xl">Seeds on hand</h2>
          <table className="bx-table mt-2">
            <thead><tr><th scope="col">Lot</th><th scope="col">Plant</th><th scope="col">Cultivar</th><th scope="col">Supplier</th></tr></thead>
            <tbody>{g.seeds.map((s) => <tr key={s.id} id={s.id}><td className="font-mono text-xs">{s.id}</td><td>{s.taxon_id ? <TaxonName id={s.taxon_id} /> : <>{s.plant} <i className="bx-muted text-xs">{s.scientific_as_entered}</i></>}</td><td className="text-xs">{v(s.cultivar)}</td><td className="text-xs">{v(s.supplier)}</td></tr>)}</tbody>
          </table>
        </section>
      </div>

      <section className="mt-10" aria-labelledby="checks-h" data-testid="growlog-checks">
        <h2 id="checks-h" className="text-2xl">Data checks</h2>
        <p className="bx-prose mt-1 max-w-3xl">Light checks run on every upload. They point at things worth a second look — a missing id, a location the Locations sheet doesn't know, a harvest with no planting — and never stop the site from publishing.</p>
        {warns.length ? (
          <ul className="mt-2 grid gap-1 text-sm">{warns.map((c, i) => <li key={i}><span className="bx-todo">{c.sheet}{c.id ? ` · ${c.id}` : ''}</span> {c.message}</li>)}</ul>
        ) : <p className="mt-2 text-sm">Nothing to look at.</p>}
        {notes.length > 0 && (
          <details className="mt-3 text-sm">
            <summary className="cursor-pointer bx-muted">{notes.length} notes (import corrections, plants not yet in the catalogue)</summary>
            <ul className="mt-2 grid gap-1">{notes.map((c, i) => <li key={i}><span className="bx-status">{c.sheet}{c.id ? ` · ${c.id}` : ''}</span> {c.message}</li>)}</ul>
          </details>
        )}
      </section>

      <p className="mt-10 text-sm bx-muted">Related: <Link className="underline" to="/greenhouse">the catalogue inventory</Link> · <Link className="underline" to="/tea">Tea Time</Link> · <Link className="underline" to="/plants">all plants</Link></p>
    </div>
  );
}
