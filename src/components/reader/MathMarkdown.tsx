import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { rehypeSupSub } from './rehype-supsub';
import 'katex/dist/katex.min.css';

/** KaTeX-enabled markdown (101 pages, and any block that carries $…$). Loaded lazily. */
export default function MathMarkdown({ md, components, className }: { md: string; components?: Components; className?: string }) {
  return (
    <div className={className}>
      <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeSupSub, [rehypeKatex, { output: 'html' }]]} components={components}>{md}</ReactMarkdown>
    </div>
  );
}
