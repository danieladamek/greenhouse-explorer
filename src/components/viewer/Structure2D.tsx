import { assetUrl } from '@/lib/data';
import { useTheme } from '@/lib/theme';
import type { Structure } from '@/types';
import type { Highlight } from './groups';

interface Props { structure: Structure; atomCoords?: number[][] | null; alt: string; highlights?: Highlight[]; picked?: number[]; onAtomClick?: (i: number) => void; className?: string }

/** Pre-rendered RDKit SVG with an overlay of highlight circles at the build-time atom coordinates (from the detail file). */
export default function Structure2D({ structure, atomCoords = null, alt, highlights = [], picked = [], onAtomClick, className = '' }: Props) {
  const { theme } = useTheme();
  const { width, height } = structure.svg;
  const vb = structure.svg.viewBox ?? [0, 0, width, height];
  const src = assetUrl(theme === 'dark' ? structure.svg.dark : structure.svg.light);
  const colorOf = new Map<number, string>();
  highlights.forEach((h) => h.atoms.forEach((a) => colorOf.set(a, h.color)));
  return (
    // K5.1 §4a: a 3:2 box; the depiction (tight viewBox) is drawn with object-fit: contain, and the atom overlay uses
    // the same viewBox with xMidYMid meet, so rings land on their atoms whatever the molecule's shape.
    <div className={`relative w-full aspect-[3/2] ${className}`} data-testid="structure-2d-box">
      <img src={src} alt={alt} className="absolute inset-0 h-full w-full object-contain object-center" />
      <svg viewBox={vb.join(' ')} className="absolute inset-0 h-full w-full" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
        {(atomCoords ?? []).map(([x, y], i) => {
          const c = colorOf.get(i);
          const isPicked = picked.includes(i);
          return (
            <circle
              key={i}
              cx={x}
              cy={y}
              r={c || isPicked ? 12 : 9}
              fill={c ?? 'transparent'}
              fillOpacity={c ? 0.32 : 0}
              stroke={isPicked ? '#e6a800' : 'none'}
              strokeWidth={isPicked ? 2.5 : 0}
              style={{ cursor: onAtomClick ? 'pointer' : 'default', pointerEvents: onAtomClick ? 'all' : 'none' }}
              onClick={onAtomClick ? () => onAtomClick(i) : undefined}
            />
          );
        })}
      </svg>
    </div>
  );
}
