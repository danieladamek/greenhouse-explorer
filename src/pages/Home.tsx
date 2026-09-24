import { Link } from 'react-router-dom';
import { AS_OF, INVENTORY_DATE, PREBUILT, families, familyColour, getCompoundMeta, getTaxonMeta, manifest, primaryCompounds, provenance, taxaIndex, tours } from '@/lib/data';
import { ClassIcon, DepthChip, TaxonName } from '@/components/catalogue/Chips';
import StructureThumb from '@/components/viewer/StructureThumb';
import { Illustration } from '@/components/Brand';

/** / — the front door (KICKOFF §4): what's growing now, a featured plant and compound, two comparisons, the primer. */
export default function Home() {
  const featured = (manifest as unknown as { featured: { plant: string | null; compound: string | null } }).featured;
  const plant = getTaxonMeta(featured.plant);
  const compound = getCompoundMeta(featured.compound);
  const growing = [...families].filter((f) => f.plantings > 0).sort((a, b) => b.plantings - a.plantings);
  const totalPlantings = growing.reduce((a, f) => a + f.plantings, 0);
  const max = Math.max(...growing.map((f) => f.plantings));
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
        <div className="order-2 lg:order-1 min-w-0">
        <p className="flex flex-wrap items-center gap-2">
          <span className="bx-chip border border-[color:var(--bx-line)] font-semibold">PROTOTYPE FOR CRITIQUE</span>
          <span className="bx-chip border border-[color:var(--bx-line)] bx-muted">COMMISSIONED REVIEW — NOT PEER REVIEWED</span>
          <span className="bx-asof">Current as of {AS_OF}</span>
        </p>
        <h1 className="text-3xl sm:text-5xl mt-3 leading-tight max-w-4xl">The plants of the UAH Greenhouse, and what is in them</h1>
        <p className="mt-2 text-sm bx-muted max-w-3xl">{manifest.venue}</p>

        <section className="bx-card mt-5 p-4 border-l-4 border-l-[color:var(--bx-accent)] max-w-4xl" aria-labelledby="question-h">
          <p id="question-h" className="text-[11px] font-semibold tracking-[0.15em] bx-muted">THE QUESTION THIS PROTOTYPE ASKS</p>
          <p className="mt-1 leading-7">{manifest.question}</p>
        </section>
        </div>
        <div className="order-1 lg:order-2 flex justify-center" data-testid="hero-illustration">
          <Illustration maxHeight={440} eager className="max-h-[260px] sm:max-h-[340px] lg:max-h-[440px]" />
        </div>
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        <Link to="/read" className="bx-btn-primary !px-4 !py-2 !text-base">Start with the primer →</Link>
        <Link to="/greenhouse" className="bx-btn !px-4 !py-2 !text-base">What's growing</Link>
        <Link to="/plants" className="bx-btn !px-4 !py-2 !text-base">All {taxaIndex.length} plant records</Link>
        <Link to="/compounds" className="bx-btn !px-4 !py-2 !text-base">{primaryCompounds.length} compounds</Link>
        <Link to="/tea" className="bx-btn !px-4 !py-2 !text-base">Tea Time</Link>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <section className="bx-card p-5" aria-labelledby="growing-h" data-testid="growing-now">
          <h2 id="growing-h" className="text-2xl">What's growing now</h2>
          <p className="text-sm bx-muted mt-1">{totalPlantings} plantings in {growing.length} families, from the inventory dated {INVENTORY_DATE}.</p>
          <ul className="mt-3 grid gap-1.5 text-sm">
            {growing.map((f) => (
              <li key={f.id} className="grid grid-cols-[8.5rem_minmax(0,1fr)_2rem] items-center gap-2">
                <Link to={`/families/${f.id}`} className="underline decoration-dotted">{f.family}</Link>
                <span className="h-3 rounded" style={{ width: `${(f.plantings / max) * 100}%`, background: familyColour(f.family) }} aria-hidden="true" />
                <span className="tabular-nums text-right">{f.plantings}</span>
              </li>
            ))}
          </ul>
          <Link to="/greenhouse" className="bx-btn mt-4">The full inventory →</Link>
        </section>

        <div className="grid gap-6">
          {plant && (
            <section className="bx-card p-5" aria-labelledby="fp-h">
              <p className="text-[11px] font-semibold tracking-[0.15em] bx-muted">FEATURED PLANT</p>
              <h2 id="fp-h" className="text-2xl mt-1"><TaxonName id={plant.id} /></h2>
              <p className="text-sm">{plant.common_names.join(', ')} · {plant.family}</p>
              <p className="mt-2 flex flex-wrap gap-1 text-xs"><DepthChip depth={plant.profile_depth} /><span className="bx-status">{plant.compounds.length} curated compounds</span>{plant.has_safety && <span className="bx-status">safety block</span>}</p>
              <Link to={`/plants/${plant.id}`} className="bx-btn-primary mt-3">Open the profile →</Link>
            </section>
          )}
          {compound && (
            <section className="bx-card p-5" aria-labelledby="fc-h">
              <p className="text-[11px] font-semibold tracking-[0.15em] bx-muted">FEATURED COMPOUND</p>
              <div className="mt-1 flex gap-3 items-start">
                {compound.svg && <div className="w-[140px] shrink-0 rounded border border-[color:var(--bx-line)]"><StructureThumb svg={compound.svg} name={compound.name} /></div>}
                <div className="min-w-0">
                  <h2 id="fc-h" className="text-2xl flex items-center gap-2"><ClassIcon cls={compound.class} size={14} />{compound.name}</h2>
                  <p className="text-sm mt-1">{compound.one_liner}</p>
                </div>
              </div>
              <Link to={`/compounds/${compound.id}`} className="bx-btn-primary mt-3">Open the record →</Link>
            </section>
          )}
        </div>
      </div>

      <section className="mt-8" aria-labelledby="cmp-h">
        <h2 id="cmp-h" className="text-2xl">Two comparisons to start from</h2>
        <ul className="mt-3 grid gap-3 sm:grid-cols-2">
          {PREBUILT.map((c) => <li key={c.to}><Link to={c.to} className="bx-card block p-4 hover:shadow-md h-full" data-testid="prebuilt"><span className="font-display text-lg">{c.title}</span><span className="block text-sm bx-muted mt-1">{c.blurb}</span></Link></li>)}
        </ul>
      </section>

      <section className="mt-8" aria-labelledby="tours-h">
        <h2 id="tours-h" className="text-2xl">Guided tours</h2>
        <ul className="mt-3 grid gap-3 sm:grid-cols-2">
          {tours.map((t) => <li key={t.id}><Link to={`/tours/${t.id}`} className="bx-card block p-4 hover:shadow-md h-full"><span className="font-display text-lg">{t.title}</span><span className="block text-sm bx-muted mt-1">{t.steps.length} steps · about {t.minutes} min</span></Link></li>)}
        </ul>
      </section>

      <section className="bx-card mt-8 p-5 max-w-4xl" aria-labelledby="plain-h">
        <h2 id="plain-h" className="text-xl">In plain language</h2>
        <p className="bx-prose mt-2">{manifest.plain_abstract}</p>
        <p className="mt-2 text-xs bx-muted">Written by the builder, as the rest of the site's prose is. {provenance.references.total} references · {provenance.catalogue.evidence_rows} graded evidence rows · {provenance.catalogue.occurrence_rows} sourced occurrence rows · {provenance.todo.count} recorded gaps — see <Link className="underline" to="/methods">Methods</Link>.</p>
      </section>
    </div>
  );
}
