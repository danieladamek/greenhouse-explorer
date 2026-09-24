import { Link } from 'react-router-dom';
import { CLASSES, families, familyColour } from '@/lib/data';
import { loadOccurrences, useAsync } from '@/lib/heavy';
import InfographicFrame from '@/components/ui/InfographicFrame';
import SharedDiagram from '@/components/catalogue/SharedDiagram';
import { ClassIcon, TaxonName } from '@/components/catalogue/Chips';

function Legend() {
  return (
    <div className="flex flex-wrap gap-x-6 gap-y-2">
      <span className="inline-flex flex-wrap gap-2 items-center"><span className="font-semibold">Plant families:</span>{families.filter((f) => f.compounds.length).map((f) => <span key={f.id} className="inline-flex items-center gap-1"><span className="inline-block h-3 w-3 rounded-full" style={{ background: familyColour(f.family) }} aria-hidden="true" />{f.family}</span>)}</span>
      <span className="inline-flex flex-wrap gap-2 items-center"><span className="font-semibold">Compound classes:</span>{CLASSES.map((c) => <span key={c.id} className="inline-flex items-center gap-1"><ClassIcon cls={c.id} />{c.label}</span>)}</span>
    </div>
  );
}

/** /families (KICKOFF §4c, feature A5): the shared-compound diagram re-keyed on taxa, and one card per botanical family. */
export default function Families() {
  const rows = useAsync(loadOccurrences);
  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="text-3xl sm:text-4xl">Families</h1>
      <p className="bx-prose mt-2 max-w-3xl">Which curated compounds are shared across which profiled plants, and a card for each of the {families.length} botanical families on the inventory. No family chapter exists yet — the family chapters come after this prototype; each card below is built from the catalogue alone.</p>
      <div className="mt-6">
        <InfographicFrame
          title="What the profiled plants share"
          caption={<>Rows are curated compounds, grouped by how many plants carry them; columns are the profiled plants, coloured by family. A dot means the catalogue has at least one occurrence row for that plant — presence, not amount. An empty column spot means “no row in this prototype”, not “absent”. Click a row or a plant to open it.</>}
          filename="greenhouse-explorer-shared-compounds.svg"
          legend={<Legend />}
        >
          {rows ? <SharedDiagram rows={rows} /> : <p className="bx-muted" role="status">Loading…</p>}
        </InfographicFrame>
      </div>
      <h2 className="text-2xl mt-10">The families</h2>
      <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {families.map((f) => (
          <li key={f.id} className="bx-card p-4 border-l-4" style={{ borderLeftColor: familyColour(f.family) }}>
            <h3 className="text-xl"><Link to={`/families/${f.id}`} className="underline decoration-dotted">{f.family}</Link></h3>
            <p className="text-sm bx-muted">{f.taxa.length} taxa · {f.plantings} plantings · {f.profiled.length} profiled · {f.compounds.length} curated compounds</p>
            <p className="text-xs mt-2">{f.taxa.slice(0, 8).map((t, i) => <span key={t}>{i ? ', ' : ''}<TaxonName id={t} link={false} /></span>)}{f.taxa.length > 8 ? ` and ${f.taxa.length - 8} more` : ''}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
