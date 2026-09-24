import type { Structure } from '@/types';
import { GROUP_COLORS } from './groups';

interface Props { structure: Structure; active: string[]; onChange: (ids: string[]) => void }

export default function FunctionalGroupChips({ structure, active, onChange }: Props) {
  const groups = structure.functionalGroups;
  if (!groups.length) return <p className="text-sm bx-muted">No tracked functional groups matched this structure.</p>;
  const toggle = (id: string) => onChange(active.includes(id) ? active.filter((x) => x !== id) : [...active, id]);
  return (
    <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Functional groups">
      {groups.map((g) => {
        const on = active.includes(g.id);
        const color = GROUP_COLORS[g.id] ?? '#999';
        return (
          <button key={g.id} type="button" aria-pressed={on} onClick={() => toggle(g.id)} className="bx-chip border text-xs" style={{ borderColor: color, background: on ? color : 'transparent', color: on ? '#111' : 'inherit' }} title={`${g.matches.length} match${g.matches.length > 1 ? 'es' : ''}; click to highlight`}>
            <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: color }} aria-hidden="true" />
            {g.name}{g.matches.length > 1 && <span className="opacity-70">×{g.matches.length}</span>}
          </button>
        );
      })}
      <button type="button" className="bx-btn !py-0.5 !text-xs" onClick={() => onChange(groups.map((g) => g.id))}>All</button>
      <button type="button" className="bx-btn !py-0.5 !text-xs" onClick={() => onChange([])}>None</button>
    </div>
  );
}
