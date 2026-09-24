import Popover from '@/components/ui/Popover';
import type { EvidenceRow } from '@/types';
import { GradeBadge, GradeLegend, POPULATION_LABEL, TestArticleChip } from './Chips';
import { Prose } from './Record';

/** Citation link markup, same form the build writes: [1,2](#cite:1,2). */
export const citeMd = (refs: number[]) => (refs.length ? `[${refs.join(',')}](#cite:${refs.join(',')})` : '');

/** Link the [n] tokens in a raw pack string (fields the build does not pre-link), leaving the words as written. */
export const citeLinks = (text: string) => text.replace(/\[(\d+(?:\s*[,–-]\s*\d+)*)\](?!\()/g, (_m, g: string) => `[${g}](#cite:${g.split(',').map((x) => x.trim()).join(',')})`);

export interface EvidenceItem extends EvidenceRow { md?: { claim: string; outcome_summary: string } }

/** Rows for rendering; exported so the unit test can prove every rendered row has a grade and a test article. */
export function evidenceRowsForRender(rows: EvidenceItem[]) {
  return rows.filter((r) => !!r.grade && !!r.test_article).map((r) => ({
    ...r,
    claimMd: r.md?.claim ?? r.claim,
    outcomeMd: r.md?.outcome_summary ?? r.outcome_summary,
    refsMd: citeMd(r.refs),
  }));
}

/**
 * The Evidence table (KICKOFF §1, §4b). Heading is "Evidence" — never "benefits" or "effects". Every row carries
 * its grade badge and its test article together, and says its population; a row missing either is not rendered
 * (the schema already makes that a build error). Null results are rendered as written.
 */
export default function EvidenceTable({ rows, id = 'evidence', title = 'Evidence', empty }: { rows: EvidenceItem[]; id?: string; title?: string; empty: string }) {
  const view = evidenceRowsForRender(rows);
  return (
    <section aria-labelledby={`${id}-h`} className="mt-8" id={id}>
      <div className="flex flex-wrap items-baseline gap-3">
        <h2 id={`${id}-h`} className="text-2xl">{title}</h2>
        <Popover className="bx-btn !py-0.5 !text-xs" content={<div className="max-w-sm"><GradeLegend /></div>} testId="grade-legend">What the grades mean</Popover>
      </div>
      {!view.length ? (
        <p className="mt-2"><span className="bx-todo" data-todo="author">{empty}</span></p>
      ) : (
        <ul className="mt-3 grid gap-3" data-testid="evidence-rows">
          {view.map((r, i) => (
            <li key={i} className="bx-card p-3" data-testid="evidence-row" data-grade={r.grade} data-test-article={r.test_article}>
              <div className="flex flex-wrap items-center gap-1.5 text-xs">
                <GradeBadge grade={r.grade} />
                <TestArticleChip article={r.test_article} detail={r.test_article_detail} />
                <span className="bx-status">in {POPULATION_LABEL[r.population]}</span>
              </div>
              <div className="mt-2 text-[15px] font-semibold leading-6"><Prose md={r.claimMd} className="bx-inline" /></div>
              <p className="mt-1 text-xs bx-muted"><span className="font-semibold">Tested: </span>{r.test_article_detail}</p>
              <div className="mt-1 text-sm leading-6"><span className="font-semibold">Outcome: </span><Prose md={r.outcomeMd} className="bx-inline" /> <Prose md={r.refsMd} className="bx-inline" /></div>
              {r.note && <p className="mt-1 text-xs bx-muted">Note: {r.note}</p>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
