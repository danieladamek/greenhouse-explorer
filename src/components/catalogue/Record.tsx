import { Link } from 'react-router-dom';
import Markdown, { readerComponents } from '@/components/reader/Markdown';
import { useEffect, useState } from 'react';
import { loadReferences } from '@/lib/heavy';
import { useInView } from '@/lib/inview';
import type { Reference } from '@/types';
import { useNotepad } from '@/lib/notepad-context';
import type { Anchor } from '@/lib/notepad';
import { doiUrl } from '@/lib/data';

/**
 * Catalogue prose, rendered as written (KICKOFF §1): the build has only added term links and citation links.
 * Citations open the same fold-out as in the reader.
 */
export function Prose({ md, className = '' }: { md: string | null | undefined; className?: string }) {
  if (!md) return null;
  return <Markdown md={md} components={readerComponents} className={`bx-record ${className}`} />;
}

/** Numbered source list for a record; each entry links to /references#ref-n. */
export function Sources({ refs, title = 'Sources' }: { refs: number[]; title?: string }) {
  // the reference list is below the fold on every record page; load it when the reader gets near it
  const [ref, near] = useInView<HTMLElement>('600px');
  const [all, setAll] = useState<Reference[] | undefined>(undefined);
  useEffect(() => { if (near && !all) loadReferences().then(setAll); }, [near, all]);
  if (!refs.length) return null;
  return (
    <section ref={ref} aria-labelledby="sources-h" className="mt-8">
      <h2 id="sources-h" className="text-2xl">{title}</h2>
      <ol className="mt-3 grid gap-1.5 text-sm">
        {[...new Set(refs)].sort((a, b) => a - b).map((n) => {
          const r = all?.find((x) => x.n === n);
          return (
            <li key={n} className="flex gap-2">
              <Link to={`/references#ref-${n}`} className="font-mono text-xs bx-muted underline shrink-0 w-10">[{n}]</Link>
              <span className="min-w-0">
                {r ? r.citation : '…'}
                {r?.doi && <> <a className="underline bx-muted" href={doiUrl(r.doi)} target="_blank" rel="noreferrer">doi</a></>}
                {r && !r.doi && r.url && <> <a className="underline bx-muted" href={r.url} target="_blank" rel="noreferrer">link</a></>}
                {r && !r.verified && <> <span className="bx-todo">not verified — summary from abstract/metadata only</span></>}
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

/** "✎ Note" on any catalogue page: opens the notepad with a new note anchored to this object (APP-SPEC §3.1). */
export function AddNoteButton({ anchor, label }: { anchor: Anchor; label: string }) {
  const np = useNotepad();
  return (
    <button type="button" className="bx-btn" onClick={() => { np.addNote(anchor); np.setOpen(true); }} aria-label={`Add a note on ${label}`} data-testid="add-note-here">
      <span aria-hidden="true">✎</span> Note
    </button>
  );
}

/** A labelled field whose value may be null: null renders amber and says so, never blank and never filled. */
export function Field({ label, value, md, missing }: { label: string; value?: string | null; md?: string | null; missing: string }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] sm:grid-cols-[12rem_minmax(0,1fr)] gap-x-4 gap-y-1 py-2 border-b border-[color:var(--bx-line)] last:border-0">
      <dt className="text-sm font-semibold">{label}</dt>
      <dd className="text-sm leading-6 min-w-0 break-words [overflow-wrap:anywhere]">
        {md ? <Prose md={md} className="bx-inline" /> : value ? value : <span className="bx-todo" data-todo="author">{missing}</span>}
      </dd>
    </div>
  );
}
