import { Link } from 'react-router-dom';
import { getCompoundMeta, getTaxonMeta } from '@/lib/data';
import { TRAY_MAX, useTray, type TrayKind } from '@/lib/tray';

/** Sticky tray (feature E2): compounds collected from any page, plants from any plant page. */
export default function CompareTray() {
  const tray = useTray();
  if (!tray.compounds.length && !tray.plants.length) return null;
  const lane = (kind: TrayKind, ids: string[], label: (id: string) => string, to: string) => ids.length > 0 && (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="font-semibold">{kind === 'compounds' ? 'Compounds' : 'Plants'} ({ids.length}/{TRAY_MAX}):</span>
      {ids.map((id) => (
        <span key={id} className="bx-chip border border-[color:var(--bx-line)] bg-white/70 dark:bg-night/70 font-normal">
          {label(id)}
          <button type="button" className="ml-0.5 rounded px-1 hover:bg-paper-2 dark:hover:bg-night" aria-label={`Remove ${label(id)} from the tray`} onClick={() => tray.remove(kind, id)}>×</button>
        </span>
      ))}
      {ids.length >= 2
        ? <Link to={to} className="bx-btn-primary !py-1">Compare {kind}</Link>
        : <span className="text-xs bx-muted">add one more to compare</span>}
      <button type="button" className="bx-btn !py-0.5 !text-xs" onClick={() => tray.clear(kind)}>Clear</button>
    </div>
  );
  return (
    <aside aria-label="Compare tray" className="sticky bottom-0 z-30 border-t border-[color:var(--bx-line)] bg-paper-2/95 dark:bg-night-2/95 backdrop-blur no-print" data-testid="compare-tray">
      <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-2 text-sm">
        {lane('compounds', tray.compounds, (id) => getCompoundMeta(id)?.name ?? id, `/compare?ids=${tray.compounds.join(',')}`)}
        {lane('plants', tray.plants, (id) => getTaxonMeta(id)?.common_names[0] ?? getTaxonMeta(id)?.accepted_name ?? id, `/compare?plants=${tray.plants.join(',')}`)}
      </div>
    </aside>
  );
}
