import { Link, useParams } from 'react-router-dom';
import figuresJson from '@/data/figures.json';
import type { Figure as FigureT } from '@/types';
import FigureFrame from '@/components/figures/FigureFrame';
import NotFound from './NotFound';

const figures = figuresJson as unknown as FigureT[];

export default function Figure() {
  const { id } = useParams();
  const f = figures.find((x) => x.id === id);
  if (!f) return <NotFound />;
  const idx = figures.findIndex((x) => x.id === f.id);
  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <FigureFrame figure={f} />
      <p className="mt-6 flex flex-wrap gap-2 text-sm">
        {idx > 0 && <Link className="bx-btn" to={`/figures/${figures[idx - 1].id}`}>← {figures[idx - 1].label}</Link>}
        {idx < figures.length - 1 && <Link className="bx-btn" to={`/figures/${figures[idx + 1].id}`}>{figures[idx + 1].label} →</Link>}
        <Link className="bx-btn ml-auto" to="/figures">All figures</Link>
      </p>
    </div>
  );
}
