import { assetUrl } from '@/lib/data';
import { useTheme } from '@/lib/theme';

/**
 * Daniel's Greenhouse Explorer artwork (K5.1 §1), from public/brand/. The web files in public/brand/web/ are the
 * committed artwork resized by scripts/brand-assets.py — same crop, same colours, never recoloured by CSS. The dark
 * file is chosen by the site's own theme (the `.dark` class), not by prefers-color-scheme, so the toggle swaps it.
 */
export function Mark({ size = 30, className = '' }: { size?: number; className?: string }) {
  const { theme } = useTheme();
  const file = size <= 16 ? 32 : 64;
  return (
    <img src={assetUrl(`brand/web/mark${theme === 'dark' ? '-dark' : ''}-${file}.png`)} width={size} height={size} alt="" aria-hidden="true" className={`inline-block shrink-0 ${className}`} decoding="async" />
  );
}

export function Illustration({ maxHeight, className = '', eager = false }: { maxHeight: number; className?: string; eager?: boolean }) {
  const { theme } = useTheme();
  const d = theme === 'dark' ? '-dark' : '';
  return (
    <img
      src={assetUrl(`brand/web/illustration${d}-880.webp`)}
      srcSet={`${assetUrl(`brand/web/illustration${d}-520.webp`)} 520w, ${assetUrl(`brand/web/illustration${d}-880.webp`)} 880w`}
      sizes={`${Math.round(maxHeight * (1215 / 1185))}px`}
      width={1215} height={1185}
      style={{ maxHeight, width: 'auto', height: 'auto' }}
      alt="The Greenhouse Explorer illustration: a glasshouse gable over a plant whose stem is a DNA helix, with a ball-and-stick model of salicylic acid."
      className={`block max-w-full ${className}`}
      loading={eager ? 'eager' : 'lazy'}
      {...(eager ? { fetchpriority: 'high' } : {})}
      decoding="async"
    />
  );
}
