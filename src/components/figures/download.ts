/** Download helpers: SVG → PNG via canvas; rows → CSV. */
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function svgToPng(svg: SVGSVGElement, filename: string, scale = 2) {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  const css = getComputedStyle(document.body);
  clone.style.fontFamily = css.fontFamily;
  clone.style.color = css.color;
  const rect = svg.getBoundingClientRect();
  const w = Math.max(1, Math.round(rect.width)); const h = Math.max(1, Math.round(rect.height));
  clone.setAttribute('width', String(w)); clone.setAttribute('height', String(h));
  const src = new XMLSerializer().serializeToString(clone);
  const img = new Image();
  img.onload = () => {
    const canvas = document.createElement('canvas');
    canvas.width = w * scale; canvas.height = h * scale;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = css.backgroundColor || '#faf8f4';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.scale(scale, scale);
    ctx.drawImage(img, 0, 0);
    canvas.toBlob((b) => { if (b) downloadBlob(b, filename); }, 'image/png');
  };
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(src);
}

export function downloadSvg(svg: SVGSVGElement, filename: string) {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  const css = getComputedStyle(document.body);
  clone.style.fontFamily = css.fontFamily; clone.style.color = css.color; clone.style.background = css.backgroundColor;
  downloadBlob(new Blob([new XMLSerializer().serializeToString(clone)], { type: 'image/svg+xml' }), filename);
}

export function toCsv(rows: Record<string, unknown>[], fields: string[]): string {
  const esc = (v: unknown) => { const s = v === null || v === undefined ? '' : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  return [fields.join(','), ...rows.map((r) => fields.map((f) => esc(r[f])).join(','))].join('\n') + '\n';
}

export function downloadCsv(rows: Record<string, unknown>[], fields: string[], filename: string) {
  downloadBlob(new Blob([toCsv(rows, fields)], { type: 'text/csv;charset=utf-8' }), filename);
}
