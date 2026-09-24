import { Link } from 'react-router-dom';
import { tours } from '@/lib/data';
import { tourStepUrl } from '@/components/TourCard';

/** /tours (feature A8): the two prototype tours, ported from Bioactive Explorer's tour format. */
export default function Tours() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-3xl sm:text-4xl">Guided tours</h1>
      <p className="bx-prose mt-2">Each tour walks through a few pages of the site with a step card, then ends with a self-check taken from one of the concept pages. Every step paraphrases a field of the content pack and names it; a step with no source in the pack does not exist.</p>
      <ul className="mt-6 grid gap-4">
        {tours.map((t) => (
          <li key={t.id} className="bx-card p-5">
            <h2 className="text-2xl"><Link to={`/tours/${t.id}`} className="hover:underline">{t.title}</Link></h2>
            <p className="bx-prose mt-1">{t.subtitle}</p>
            <p className="text-sm bx-muted mt-2">{t.steps.length} steps · about {t.minutes} min · self-check</p>
            <div className="mt-3 flex gap-2"><Link to={tourStepUrl(t, 0)} className="bx-btn-primary">Start</Link><Link to={`/tours/${t.id}`} className="bx-btn">Overview</Link></div>
          </li>
        ))}
      </ul>
    </div>
  );
}
