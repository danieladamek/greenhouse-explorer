import type { AtomRecord, Structure } from '@/types';
import { groupsOfAtom } from './groups';
import type { Measurement } from './measure';

interface Props { structure: Structure; atoms: AtomRecord[] | null; picked: number[]; measurement: Measurement | null; onClear: () => void }

const HYB: Record<string, string> = { sp: 'sp', sp2: 'sp²', sp3: 'sp³', s: 's', unspecified: '—', other: 'other' };

export default function AtomInfoPanel({ structure, atoms, picked, measurement, onClear }: Props) {
  const last = picked.length && atoms ? atoms[picked[picked.length - 1]] : null;
  return (
    <div className="bx-card p-3 text-sm" aria-live="polite" data-testid="atom-info">
      {!last ? (
        <p className="bx-muted">Click an atom to inspect it. Click two atoms for a distance, three for an angle, four for a dihedral.</p>
      ) : (
        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
          <div className="col-span-2 font-semibold">Atom {last.el}{last.i}</div>
          <span className="bx-muted">Element</span><span>{last.el}</span>
          <span className="bx-muted">Hybridisation</span><span>{HYB[last.hyb] ?? last.hyb}</span>
          <span className="bx-muted">Formal charge</span><span>{last.chg > 0 ? `+${last.chg}` : last.chg}</span>
          <span className="bx-muted">Aromatic</span><span>{last.arom ? 'yes' : 'no'}</span>
          <span className="bx-muted">Attached H</span><span>{last.nH}</span>
          <span className="bx-muted">Gasteiger charge</span><span>{last.q.toFixed(3)} e</span>
          {last.cip && (<><span className="bx-muted">CIP</span><span>{last.cip}</span></>)}
          <span className="bx-muted">Groups</span><span>{groupsOfAtom(structure, last.i).join(', ') || '—'}</span>
        </div>
      )}
      {picked.length >= 2 && measurement && (
        <p className="mt-2 border-t border-[color:var(--bx-line)] pt-2">
          <span className="bx-muted">{measurement.kind === 'distance' ? 'Distance' : measurement.kind === 'angle' ? 'Angle' : 'Dihedral'} ({picked.map((i) => `${atoms?.[i]?.el ?? ''}${i}`).join('–')}):</span>{' '}
          <strong data-testid="measurement">{measurement.label}</strong>
        </p>
      )}
      {picked.length > 0 && <button type="button" className="bx-btn mt-2 !text-xs" onClick={onClear}>Clear selection</button>}
    </div>
  );
}
