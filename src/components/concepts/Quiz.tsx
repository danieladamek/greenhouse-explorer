import { useState } from 'react';
import type { SelfCheck } from '@/types';

/** Self-check (Bioactive Explorer tour-quiz pattern): pick an answer to reveal the explanation. Nothing is recorded. */
export default function Quiz({ questions }: { questions: SelfCheck[] }) {
  const [revealed, setRevealed] = useState<Record<number, number>>({});
  return (
    <section aria-labelledby="quiz-h" className="mt-10">
      <p className="text-[11px] font-semibold tracking-[0.2em] bx-muted">SELF-CHECK</p>
      <h2 id="quiz-h" className="text-2xl mt-1">{questions.length === 1 ? 'One question' : `${['Two', 'Three', 'Four', 'Five'][questions.length - 2] ?? questions.length} questions`}</h2>
      <p className="bx-prose mt-1">Pick an answer to reveal the explanation. Nothing is recorded.</p>
      <ol className="mt-4 grid gap-4">
        {questions.map((q, qi) => {
          const chosen = revealed[qi];
          return (
            <li key={qi} className="bx-card p-4">
              <p className="font-semibold">{qi + 1}. {q.q}</p>
              <ul className="mt-2 grid gap-1.5">
                {q.options.map((o, oi) => {
                  const state = chosen === undefined ? '' : oi === q.answer ? 'border-green-700 bg-green-50 dark:bg-green-900/30' : oi === chosen ? 'border-red-700 bg-red-50 dark:bg-red-900/30' : 'opacity-60';
                  return (
                    <li key={oi}>
                      <button type="button" className={`w-full text-left rounded-md border border-[color:var(--bx-line)] px-3 py-2 text-sm ${state}`} onClick={() => setRevealed((r) => ({ ...r, [qi]: oi }))} disabled={chosen !== undefined} aria-pressed={chosen === oi}>
                        {String.fromCharCode(65 + oi)}. {o}{chosen !== undefined && oi === q.answer ? ' ✓' : ''}
                      </button>
                    </li>
                  );
                })}
              </ul>
              {chosen !== undefined && <p className="mt-2 text-sm" role="status">{chosen === q.answer ? 'Correct. ' : 'Not quite. '}{q.explanation}</p>}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
