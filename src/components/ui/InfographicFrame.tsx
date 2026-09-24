import { useRef, type ReactNode } from 'react';
import { downloadSvg } from '@/components/figures/download';

/** Title + caption + legend + "Download SVG" for every infographic (feature E4, ported from Bioactive Explorer). */
export default function InfographicFrame({ title, caption, legend, filename, children, controls }: { title: string; caption: ReactNode; legend?: ReactNode; filename: string; children: ReactNode; controls?: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const download = () => { const svg = ref.current?.querySelector('svg'); if (svg) downloadSvg(svg as SVGSVGElement, filename); };
  return (
    <figure className="bx-card p-4 sm:p-6">
      <div className="flex flex-wrap items-start gap-3">
        <div className="flex-1 min-w-[16rem]">
          <h2 className="text-2xl">{title}</h2>
          <figcaption className="bx-muted text-sm mt-1">{caption}</figcaption>
        </div>
        <div className="flex flex-wrap gap-2 items-center">{controls}<button type="button" className="bx-btn" onClick={download} data-testid="download-svg">Download SVG</button></div>
      </div>
      <div ref={ref} className="mt-4 overflow-x-auto">{children}</div>
      {legend && <div className="mt-4 border-t border-[color:var(--bx-line)] pt-3 text-sm">{legend}</div>}
    </figure>
  );
}
