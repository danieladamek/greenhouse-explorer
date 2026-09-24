import { Link } from 'react-router-dom';
import type { TermShort } from '@/types';
import { getConcept } from '@/lib/data';
import KindChip from './KindChip';

/** The short popover body for a glossary term (short definition + full entry + 101 link). */
export default function TermCard({ term, onNavigate }: { term: TermShort; onNavigate?: () => void }) {
  const concept = getConcept(term.concept);
  return (
    <div>
      <p className="font-display text-base font-semibold leading-snug">{term.term} <KindChip kind={term.kind} /></p>
      <p className="mt-1 leading-6">{term.short}</p>
      <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
        <Link className="underline font-semibold" to={`/glossary#${term.id}`} onClick={onNavigate}>Full entry →</Link>
        {concept && <Link className="underline" to={`/concepts/${concept.id}`} onClick={onNavigate}>Learn the concept → 101</Link>}
      </p>
    </div>
  );
}
