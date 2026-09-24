import { Link, useParams } from 'react-router-dom';
import { familyColour, getCompoundMeta, getFamily, getSection, getTaxonMeta, shortSectionTitle } from '@/lib/data';
import { ClassIcon, DepthChip, IdentityChip, TaxonName } from '@/components/catalogue/Chips';
import NotFound from './NotFound';

/** /families/:family — a card per botanical family (KICKOFF §4c). Built from the catalogue; no family chapter yet. */
export default function Family() {
  const { family } = useParams();
  const f = getFamily(family);
  if (!f) return <NotFound />;
  const c = familyColour(f.family);
  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <p className="text-[11px] font-semibold tracking-[0.2em] bx-muted">BOTANICAL FAMILY</p>
      <h1 className="text-3xl sm:text-4xl mt-1 flex items-center gap-3"><span className="inline-block h-5 w-5 rounded-full" style={{ background: c }} aria-hidden="true" />{f.family}</h1>
      <p className="bx-prose mt-2">{f.taxa.length} taxa on the inventory, {f.plantings} plantings, {f.profiled.length} profiled.</p>
      <p className="mt-3 text-sm bx-card p-3"><span className="font-semibold">No family chapter yet.</span> Family chapters are planned after this prototype; this card is built from the plant and compound records alone.</p>

      <section className="mt-8" aria-labelledby="members-h">
        <h2 id="members-h" className="text-2xl">Members</h2>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {f.taxa.map((id) => { const t = getTaxonMeta(id)!; return (
            <li key={id} className="bx-card p-3">
              <p><TaxonName id={id} /> <span className="bx-muted text-sm">{t.common_names.join(', ')}</span></p>
              <p className="mt-1 flex flex-wrap gap-1 text-xs"><IdentityChip status={t.identity_status} /><DepthChip depth={t.profile_depth} /><span className="bx-status">{t.n_plantings} planting{t.n_plantings === 1 ? '' : 's'}</span></p>
            </li>
          ); })}
        </ul>
      </section>

      <section className="mt-8" aria-labelledby="shared-h">
        <h2 id="shared-h" className="text-2xl">Curated compounds shared within the family</h2>
        {!f.shared_compounds.length ? <p className="mt-2 text-sm bx-muted">{f.compounds.length ? 'No curated compound is recorded in more than one member of this family.' : 'No member of this family is profiled yet, so it has no curated compounds.'}</p> : (
          <ul className="mt-3 grid gap-2 text-sm">
            {f.shared_compounds.map((s) => { const m = getCompoundMeta(s.id); return (
              <li key={s.id} className="flex flex-wrap items-center gap-2"><Link to={`/compounds/${s.id}`} className="underline inline-flex items-center gap-1.5 font-semibold">{m && <ClassIcon cls={m.class} />}{m?.name ?? s.id}</Link><span className="bx-muted">in</span>{s.taxa.map((t, i) => <span key={t}>{i ? ', ' : ''}<TaxonName id={t} link={false} /></span>)}</li>
            ); })}
          </ul>
        )}
        {f.compounds.length > 0 && <p className="mt-3 text-sm"><Link className="underline" to={`/compounds?families=${f.id}`}>All {f.compounds.length} curated compounds recorded in this family →</Link></p>}
      </section>

      <section className="mt-8" aria-labelledby="fprimer-h">
        <h2 id="fprimer-h" className="text-2xl">In the primer</h2>
        {!f.primer_sections.length ? <p className="mt-2 text-sm bx-muted">The primer does not name this family.</p> : (
          <ul className="mt-2 flex flex-wrap gap-2 text-sm">{f.primer_sections.map((id) => { const s = getSection(id); return <li key={id}><Link className="bx-btn" to={`/read#${id}`}>{s ? `§${s.number ?? ''} ${shortSectionTitle(s)}` : id}</Link></li>; })}</ul>
        )}
      </section>
      <p className="mt-8 text-sm"><Link className="underline" to="/families">All families and the shared-compound diagram →</Link></p>
    </div>
  );
}
