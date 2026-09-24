import { Link } from 'react-router-dom';
import { INVENTORY_DATE, getSection, shortSectionTitle } from '@/lib/data';
import type { Planting, Taxon } from '@/types';
import { IdentityChip } from './Chips';

export function Identifiers({ t }: { t: Taxon }) {
  const i = t.identifiers;
  return (
    <dl className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm" aria-label="Database identifiers">
      <div><dt className="inline bx-muted">POWO </dt><dd className="inline">{i.powo_id ? <a className="underline" href={`https://powo.science.kew.org/taxon/${i.powo_id}`} target="_blank" rel="noreferrer">{i.powo_id.replace('urn:lsid:ipni.org:names:', '')}</a> : <span className="bx-todo">none</span>}</dd></div>
      <div><dt className="inline bx-muted">GBIF </dt><dd className="inline">{i.gbif_key ? <a className="underline" href={`https://www.gbif.org/species/${i.gbif_key}`} target="_blank" rel="noreferrer">{i.gbif_key}</a> : <span className="bx-todo">none</span>}</dd></div>
      <div><dt className="inline bx-muted">NCBI </dt><dd className="inline">{i.ncbi_taxid ? <a className="underline" href={`https://www.ncbi.nlm.nih.gov/Taxonomy/Browser/wwwtax.cgi?id=${i.ncbi_taxid}`} target="_blank" rel="noreferrer">{i.ncbi_taxid}</a> : <span className="bx-todo">none</span>}</dd></div>
      <div><dt className="inline bx-muted">WFO </dt><dd className="inline">{i.wfo_id ?? <span className="bx-todo">not available — World Flora Online unreachable at build</span>}</dd></div>
    </dl>
  );
}

/** "Grown here" (KICKOFF §4c): the inventory's own cultivars, per-cultivar identity status and notes, n plantings. */
export function GrownHere({ t, plantings }: { t: Taxon; plantings: Planting[] }) {
  const mine = plantings.filter((p) => p.taxon_id === t.id);
  return (
    <section aria-labelledby="grown-h" className="mt-8" id="grown-here">
      <h2 id="grown-h" className="text-2xl">Grown here</h2>
      {!t.cultivars.length ? (
        <p className="mt-2 bx-prose">
          Not planted under this name. {t.candidate_of
            ? <>This record exists as one of the candidate identities for the inventory entry <Link className="underline" to={`/plants/${t.candidate_of}`}>{t.candidate_of === 'scutellaria-sp' ? 'Skullcap' : t.candidate_of}</Link>, which the inventory does not resolve.</>
            : null}
        </p>
      ) : (
        <>
          <p className="mt-1 text-sm bx-muted">
            {t.n_plantings} planting{t.n_plantings === 1 ? '' : 's'} in the greenhouse inventory dated {INVENTORY_DATE} (status: {t.statuses.join(', ') || 'none'}).
            {t.n_plantings > 1 && ' Inventory rows that name the same species are collapsed onto this one record.'}
          </p>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {t.cultivars.map((c) => {
              const p = mine.find((x) => x.id === c.crop_id);
              return (
                <li key={c.crop_id} className="bx-card p-3 text-sm" data-testid="cultivar">
                  <div className="flex flex-wrap items-baseline gap-2">
                    <span className="font-semibold">{c.name ?? <span className="bx-muted font-normal">cultivar not recorded</span>}</span>
                    <span className="bx-muted text-xs font-mono">{c.crop_id}</span>
                    <IdentityChip status={c.identity_status} />
                  </div>
                  {c.type && <p className="text-xs bx-muted mt-0.5">{c.type}</p>}
                  <p className="text-xs mt-1">As written in the inventory: “{p?.original_entry ?? c.name_as_given}”{c.name_as_given && <> · named <i>{c.name_as_given}</i></>}</p>
                  {c.note && <p className="text-xs mt-1"><span className="font-semibold">Inventory note: </span>{c.note}</p>}
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
}

export function PrimerLinks({ sections }: { sections: string[] }) {
  return (
    <section aria-labelledby="primer-h" className="mt-8">
      <h2 id="primer-h" className="text-2xl">In the primer</h2>
      {!sections.length ? <p className="mt-2 text-sm bx-muted">The primer does not name this plant.</p> : (
        <ul className="mt-2 flex flex-wrap gap-2 text-sm">
          {sections.map((id) => { const s = getSection(id); return <li key={id}><Link className="bx-btn" to={`/read#${id}`}>{s ? `§${s.number ?? ''} ${shortSectionTitle(s)}` : id}</Link></li>; })}
        </ul>
      )}
    </section>
  );
}
