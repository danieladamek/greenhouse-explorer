import { lazy, Suspense } from 'react';
import type { Figure } from '@/types';
import PathwayDiagram from './PathwayDiagram';
import DataTable from './DataTable';
import Todo from '@/components/ui/Todo';

const Charts = lazy(() => import('./Charts'));

function ChartFor({ figure, inline }: { figure: Figure; inline?: boolean }) {
  const spec = figure.chart;
  const rows = figure.chart_rows ?? figure.table?.rows ?? [];
  const fields = figure.table?.fields ?? (rows[0] ? Object.keys(rows[0]) : []);
  if (!spec) return null;
  const props = { id: figure.id, spec, rows, fields, inline };
  const fallback = <div className="bx-muted text-sm" style={{ minHeight: inline ? 320 : 420 }} role="status">Loading figure…</div>;
  if (['scatter', 'bar', 'grouped-bar', 'stacked-bar', 'line', 'area', 'step'].includes(spec.type)) {
    return <Suspense fallback={fallback}><Charts {...props} /></Suspense>;
  }
  return <p><Todo>chart type “{spec.type}” is not yet supported by the builder; the values are in the table below</Todo></p>;
}

/** One component per figure kind (APP-SPEC §4). `inline` = the compact variant embedded in the reader. */
export default function FigureBody({ figure, inline }: { figure: Figure; inline?: boolean }) {
  switch (figure.kind) {
    case 'pathway':
    case 'network':
      return figure.graph ? <PathwayDiagram figure={figure} graph={figure.graph} inline={inline} /> : <Todo>no node/edge data for {figure.id}</Todo>;
    case 'table':
      return <DataTable figure={figure} rows={figure.table?.rows ?? []} inline={inline} />;
    case 'chart':
      return (
        <div>
          <ChartFor figure={figure} inline={inline} />
          {figure.table && (
            <details className="mt-3 text-sm" open={false}>
              <summary className="cursor-pointer bx-muted">Every value in this figure, with its own source ({figure.table.rows.length} rows)</summary>
              <div className="mt-2"><DataTable figure={figure} rows={figure.table.rows} inline={inline} /></div>
            </details>
          )}
        </div>
      );
    case 'image':
      return <Todo>this pack reproduces no published figure images; nothing to show for {figure.id}</Todo>;
  }
}
