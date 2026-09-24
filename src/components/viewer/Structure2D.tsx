import { assetUrl } from '@/lib/data';
import { useTheme } from '@/lib/theme';
import type { Structure } from '@/types';
import type { Highlight } from './groups';

interface Props { structure: Structure; atomCoords?: number[][] | null; alt: string; highlights?: Highlight[]; picked?: number[]; onAtomClick?: (i: number) => void; className?: string }

/** Pre-rendered RDKit SVG with an overlay of highlight circles at the build-time atom coordinates (from the detail file). */
export default function Structure2D({ structure, atomCoords = null, alt, highlights = [], picked = [], onAtomClick, className = '' }: Props) {
  const { theme } = useTheme();
  const { width, height } = structure.svg;
  const src = assetUrl(theme === 'dark' ? structure.svg.dark : structure.svg.light);
  const colorOf = new Map<number, string>();
  highlights.forEach((h) => h.atoms.forEach((a) => colorOf.set(a, h.color)));
  return (
    <div className={`relative w-full ${className}`} style={{ aspectRatio: `${width} / ${height}` }}>
      <img src={src} alt={alt} width={width} height={height} className="absolute inset-0 h-full w-full object-contain" />
      <svg viewBox={`0 0 ${width} ${height}`} className="absolute inset-0 h-full w-full" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
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
