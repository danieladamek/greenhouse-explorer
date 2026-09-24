import type { Element, Parents, Root, RootContent } from 'hast';

/**
 * Turns raw `<sup>…</sup>` / `<sub>…</sub>` markers (left by remark as `raw` nodes) into real elements, so the
 * text honours chemical and receptor notation without rehype-raw (no HTML parser in the bundle).
 * Any other raw HTML is dropped by react-markdown, which is the sanitisation we want.
 */
export function rehypeSupSub() {
  return (tree: Root) => { walk(tree); };
}

function walk(parent: Parents) {
  const out: RootContent[] = [];
  const kids = parent.children as RootContent[];
  for (let i = 0; i < kids.length; i++) {
    const k = kids[i];
    const open = k.type === 'raw' ? /^<(sup|sub)>$/.exec(k.value.trim()) : null;
    if (open) {
      const tag = open[1];
      const close = kids.findIndex((c, j) => j > i && c.type === 'raw' && c.value.trim() === `</${tag}>`);
      if (close > i) {
        const inner = kids.slice(i + 1, close);
        const el: Element = { type: 'element', tagName: tag, properties: {}, children: inner as Element['children'] };
        walk(el);
        out.push(el);
        i = close;
        continue;
      }
    }
    if ('children' in k) walk(k as Parents);
    out.push(k);
  }
  parent.children = out as typeof parent.children;
}
