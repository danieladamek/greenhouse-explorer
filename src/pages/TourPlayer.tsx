import { Link, useParams, useSearchParams } from 'react-router-dom';
import { getConcept, getTour } from '@/lib/data';
import { tourStepUrl } from '@/components/TourCard';
import Quiz from '@/components/concepts/Quiz';

/** Tour intro (no step) and the closing self-check (?step=quiz); the steps render on their own routes with the TourCard overlay. */
export default function TourPlayer() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const tour = getTour(id);
  if (!tour) return <div className="mx-auto max-w-3xl px-4 py-12"><h1 className="text-3xl">Tour not found</h1><Link className="underline" to="/tours">All tours</Link></div>;
  const concept = getConcept(tour.quiz_from);

  if (params.get('step') === 'quiz') {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8" data-testid="tour-quiz">
        <p className="text-xs font-semibold tracking-[0.2em] bx-muted">SELF-CHECK · {tour.title.toUpperCase()}</p>
        <h1 className="text-3xl sm:text-4xl mt-1">Check yourself</h1>
        <p className="bx-prose mt-2">These questions are the self-check of the concept page <Link className="underline" to={`/concepts/${tour.quiz_from}`}>{concept?.title ?? tour.quiz_from}</Link>.</p>
        {concept && <Quiz questions={concept.self_check} />}
        <div className="mt-6 flex gap-2"><Link to={tourStepUrl(tour, tour.steps.length - 1)} className="bx-btn">← Last step</Link><Link to="/tours" className="bx-btn-primary">All tours</Link></div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <p className="text-xs font-semibold tracking-[0.2em] bx-muted">GUIDED TOUR · {tour.steps.length} STEPS · ABOUT {tour.minutes} MIN</p>
      <h1 className="text-3xl sm:text-4xl mt-1">{tour.title}</h1>
      <p className="bx-prose mt-3">{tour.subtitle}</p>
      <ol className="mt-6 grid gap-2 list-decimal pl-5 bx-prose">
        {tour.steps.map((s, i) => <li key={i}><Link to={tourStepUrl(tour, i)} className="underline">{s.title}</Link> <span className="text-xs">— from {s.source}</span></li>)}
        <li><Link to={`/tours/${tour.id}?step=quiz`} className="underline">Self-check questions</Link></li>
      </ol>
      <Link to={tourStepUrl(tour, 0)} className="bx-btn-primary mt-6 !px-4 !py-2 !text-base" data-testid="tour-begin">Begin</Link>
    </div>
  );
}
