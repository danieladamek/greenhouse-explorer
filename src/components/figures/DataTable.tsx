import { useMemo, useState } from 'react';
import type { Figure, Row } from '@/types';
import Popover from '@/components/ui/Popover';
import { downloadCsv } from './download';

const prettify = (f: string) => f.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

/** Sortable, filterable table with column-header popovers (from explain[] when an entry matches the header). */
export default function DataTable({ figure, rows, inline }: { figure: Figure; rows: Row[]; inline?: boolean }) {
  type Col = { field: string; label?: string; sortable?: boolean; sort_field?: string };
  const cols: Col[] = figure.columns ?? (figure.table?.fields ?? []).map((f) => ({ field: f }));
  const [sort, setSort] = useState<{ field: string; dir: 'asc' | 'desc' } | null>(null);
  const [q, setQ] = useState('');
  const shown = useMemo(() => {
    let r = rows;
    if (q.trim()) { const needle = q.toLowerCase(); r = r.filter((row) => Object.values(row).some((v) => String(v ?? '').toLowerCase().includes(needle))); }
    if (sort) {
      const col = cols.find((c) => c.field === sort.field);
      const key = col?.sort_field ?? sort.field;
      r = [...r].sort((a, b) => { const va = a[key], vb = b[key]; const na = typeof va === 'number', nb = typeof vb === 'number'; const cmp = na && nb ? (va as number) - (vb as number) : String(va ?? '').localeCompare(String(vb ?? '')); return sort.dir === 'asc' ? cmp : -cmp; });
    }
    return r;
  }, [rows, q, sort, cols]);
  const explainFor = (label: string) => figure.explain.find((e) => label.toLowerCase().includes(e.on.toLowerCase()) || (e.on.toLowerCase().includes(label.toLowerCase().split(' ')[0]) && label.length > 3));
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 no-print">
        <label className="sr-only" htmlFor={`filter-${figure.id}`}>Filter rows</label>
        <input id={`filter-${figure.id}`} className="bx-input max-w-xs" placeholder="Filter rows…" value={q} onChange={(e) => setQ(e.target.value)} />
        <span className="text-xs bx-muted">{shown.length} of {rows.length} rows</span>
        {!inline && <button type="button" className="bx-btn ml-auto" onClick={() => downloadCsv(rows, cols.map((c) => c.field), `${figure.id}.csv`)}>CSV</button>}
      </div>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full text-sm border-collapse" data-testid={`table-${figure.id}`}>
          <caption className="sr-only">{figure.label}: {figure.title}</caption>
          <thead>
            <tr>
              {cols.map((c) => {
                const label = c.label ?? prettify(c.field);
                const ex = explainFor(label);
                const sortable = c.sortable ?? true;
                const active = sort?.field === c.field;
                return (
                  <th key={c.field} scope="col" aria-sort={active ? (sort!.dir === 'asc' ? 'ascending' : 'descending') : undefined} className="border-b-2 border-[color:var(--bx-line)] px-2 py-1.5 text-left align-bottom font-semibold bg-paper-2/60 dark:bg-night-2/60">
                    <span className="inline-flex items-center gap-1 flex-wrap">
                      {sortable ? (
                        <button type="button" className="underline decoration-dotted underline-offset-2 text-left" onClick={() => setSort((s) => (s?.field === c.field ? { field: c.field, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { field: c.field, dir: 'asc' }))} aria-label={`Sort by ${label}`}>
                          {label} <span aria-hidden="true">{active ? (sort!.dir === 'asc' ? '▲' : '▼') : '↕'}</span>
                        </button>
                      ) : <span>{label}</span>}
                      {ex && <Popover className="bx-chip !px-1.5 border border-[color:var(--bx-line)]" ariaLabel={`About ${label}`} content={<div><p className="font-semibold">{ex.on}</p><p className="mt-1 leading-6">{ex.text}</p></div>}>ⓘ</Popover>}
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {shown.map((r, i) => (
              <tr key={i} className="odd:bg-paper-card dark:odd:bg-night-2/40 align-top">
                {cols.map((c, j) => <td key={c.field} className={`border-b border-[color:var(--bx-line)] px-2 py-1.5 ${j === 0 ? 'font-semibold' : ''}`}>{String(r[c.field] ?? '')}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
