import { lazy, Suspense, type ComponentProps } from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { rehypeSupSub } from './rehype-supsub';
import Term from './Term';
import Cite, { Paragraph } from './Cite';

// Raw HTML from the pack: only <sup>/<sub> are honoured, via rehypeSupSub; everything else is dropped.

function Anchor({ href, children }: ComponentProps<'a'>) {
  if (href?.startsWith('#term:')) return <Term id={href.slice(6)}>{children}</Term>;
  if (href?.startsWith('#cite:')) return <Cite ns={href.slice(6).split(',').map(Number)} label={String(children)} />;
  const external = !!href && /^https?:/.test(href);
  return <a href={href} className="underline" target={external ? '_blank' : undefined} rel={external ? 'noreferrer' : undefined}>{children}</a>;
}

export const readerComponents: Components = {
  a: Anchor,
  p: ({ children }) => <Paragraph>{children}</Paragraph>,
};

/** Term links without the citation fold-out machinery — used for compound-record prose. */
export const recordComponents: Components = { a: Anchor };

const MathMarkdown = lazy(() => import('./MathMarkdown'));

/** Reader/notes markdown. `math` switches to the KaTeX-enabled renderer (separate chunk). */
export default function Markdown({ md, math = false, components = readerComponents, className }: { md: string; math?: boolean; components?: Components; className?: string }) {
  if (math) return <Suspense fallback={<div className="bx-muted text-sm">Rendering maths…</div>}><MathMarkdown md={md} components={components} className={className} /></Suspense>;
  return (
    <div className={className}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSupSub]} components={components}>{md}</ReactMarkdown>
    </div>
  );
}
