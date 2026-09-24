import { useTheme } from '@/lib/theme';
import type { StyleName, SurfaceMode, ViewerOptions } from './options';

interface Props {
  options: ViewerOptions;
  onChange: (o: ViewerOptions) => void;
  onReset: () => void;
  onFullscreen: () => void;
  onDownload: () => void;
  onClearMeasurements: () => void;
  hasMeasurements: boolean;
  groupsOn: boolean;
  onToggleGroups: () => void;
  hasStereo: boolean;
  compact?: boolean;
}

const STYLES: { id: StyleName; label: string }[] = [
  { id: 'ballstick', label: 'Ball & stick' }, { id: 'stick', label: 'Stick' }, { id: 'spacefill', label: 'Space-filling' }, { id: 'wireframe', label: 'Wireframe' },
];
const SURFACES: { id: SurfaceMode; label: string }[] = [
  { id: 'none', label: 'No surface' }, { id: 'element', label: 'Surface by element' }, { id: 'charge', label: 'Surface by partial charge' },
];

export default function ViewerControls({ options, onChange, onReset, onFullscreen, onDownload, onClearMeasurements, hasMeasurements, groupsOn, onToggleGroups, hasStereo, compact = false }: Props) {
  const { reducedMotion } = useTheme();
  const set = <K extends keyof ViewerOptions>(k: K, v: ViewerOptions[K]) => onChange({ ...options, [k]: v });
  const Toggle = ({ k, label }: { k: 'hydrogens' | 'labels' | 'cip' | 'spin'; label: string }) => (
    <button type="button" className={`bx-btn ${options[k] ? 'bx-btn-on' : ''}`} aria-pressed={options[k]} onClick={() => set(k, !options[k])} disabled={k === 'spin' && reducedMotion} title={k === 'spin' && reducedMotion ? 'Disabled: reduced motion is on' : undefined}>{label}</button>
  );
  return (
    <div className={`flex flex-col gap-2 ${compact ? 'text-xs' : 'text-sm'}`}>
      <div role="radiogroup" aria-label="Rendering style" className="flex flex-wrap gap-1">
        {STYLES.map((s) => (
          <button key={s.id} type="button" role="radio" aria-checked={options.style === s.id} className={`bx-btn ${options.style === s.id ? 'bx-btn-on' : ''}`} onClick={() => set('style', s.id)}>{s.label}</button>
        ))}
      </div>
      <div className="flex flex-wrap gap-1">
        <Toggle k="hydrogens" label="Hydrogens" />
        <Toggle k="labels" label="Atom labels" />
        {hasStereo && <Toggle k="cip" label="R/S labels" />}
        <button type="button" className={`bx-btn ${groupsOn ? 'bx-btn-on' : ''}`} aria-pressed={groupsOn} onClick={onToggleGroups}>Highlight groups</button>
        <Toggle k="spin" label="Spin" />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <label className="inline-flex items-center gap-1">
          <span className="sr-only">Surface</span>
          <select className="bx-input !w-auto" value={options.surface} onChange={(e) => set('surface', e.target.value as SurfaceMode)} aria-label="Molecular surface">
            {SURFACES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </label>
        {options.surface !== 'none' && (
          <label className="inline-flex items-center gap-1">Opacity
            <input type="range" min={0.1} max={1} step={0.05} value={options.surfaceOpacity} onChange={(e) => set('surfaceOpacity', Number(e.target.value))} aria-label="Surface opacity" />
          </label>
        )}
      </div>
      <div className="flex flex-wrap gap-1">
        <button type="button" className="bx-btn" onClick={onReset}>Reset view</button>
        <button type="button" className="bx-btn" onClick={onFullscreen}>Fullscreen</button>
        <button type="button" className="bx-btn" onClick={onDownload}>Download PNG</button>
        <button type="button" className="bx-btn" onClick={onClearMeasurements} disabled={!hasMeasurements}>Clear measurements</button>
      </div>
    </div>
  );
}
