import { assetUrl } from '@/lib/data';
import { useTheme } from '@/lib/theme';
import type { StructureSvg } from '@/types';

/**
 * A 2D depiction that always fits whole and centred (K5.1 §4a): an aspect-ratio box, the SVG (tight viewBox, no fixed
 * size) drawn with object-fit: contain. Long molecules fill the width; compact ones are capped at 80 % of the box's
 * height and at ~1.6× their natural size, so thymol is not blown up to fill a card.
 */
export default function StructureThumb({ svg, name, aspect = '4 / 3', className = '', eager = false }: { svg: StructureSvg; name: string; aspect?: string; className?: string; eager?: boolean }) {
  const { theme } = useTheme();
  return (
    <div className={`relative w-full overflow-hidden ${className}`} style={{ aspectRatio: aspect }} data-testid="structure-box">
      <img
        src={assetUrl(theme === 'dark' ? svg.dark : svg.light)}
        alt={`2D structure of ${name}`}
        // absolutely centred with explicit size: the drawing (object-fit: contain) can never leave the box, and the
        // element's own box is centred exactly, whatever the molecule's aspect
        className="absolute inset-0 m-auto block object-contain object-center"
        style={{ height: '80%', width: `min(calc(100% - 24px), ${Math.round(svg.width * 1.6)}px)` }}
        loading={eager ? 'eager' : 'lazy'}
        decoding="async"
      />
    </div>
  );
}
