import { Link } from 'react-router-dom';
import { AS_OF, asOfLong, manifest, provenance } from '@/lib/data';
import { critiqueHref } from '@/components/Layout';
import { Illustration } from '@/components/Brand';

/** /about (APP-SPEC §2 topic mode; KICKOFF §4e): the prototype statement in full, who built it, how to report an error. */
export default function About() {
  const issues = manifest.critique?.issues_url.replace(/\/new$/, '') ?? '';
  return (
    <div className="mx-auto max-w-3xl px-4 py-8 bx-prose text-ink dark:text-night-ink">
      <h1 className="text-3xl sm:text-4xl">About this site</h1>
      <p className="mt-2 flex flex-wrap items-center gap-2"><span className="bx-chip border border-[color:var(--bx-line)] font-semibold">PROTOTYPE FOR CRITIQUE</span><span className="bx-asof">Content current as of {AS_OF}</span></p>

      <section className="mt-5 bx-card p-4 border-l-4 border-l-[color:var(--bx-accent)]" aria-labelledby="stmt-h" data-testid="prototype-statement">
        <h2 id="stmt-h" className="text-xl">What this is</h2>
        <p className="mt-2 font-semibold">{manifest.venue}</p>
        {manifest.banner && <p className="mt-2">{manifest.banner.text}</p>}
        <p className="mt-2">
          Greenhouse Explorer is a <strong>prototype built for critique</strong>: a catalogue of the plants of the UAH Greenhouse and their curated
          constituents, and a short commissioned primer. It is <strong>not peer reviewed</strong>, has had <strong>no external scientific review</strong>, and is
          <strong> not an official UAH resource</strong>. Its content is current as of {asOfLong()}.
        </p>
      </section>

      <figure className="mt-8 flex flex-col items-center text-center" data-testid="about-illustration">
        <Illustration maxHeight={260} />
        <figcaption className="mt-2 text-sm bx-muted max-w-md">A glasshouse, a plant, its DNA and one of its molecules — salicylic acid, the signal every plant makes.</figcaption>
      </figure>

      <h2 className="text-2xl mt-8">Who wrote it</h2>
      <p className="mt-2">
        The primer and every record were written by an AI research builder, the {manifest.builder.name} ({manifest.builder.version}), from the sources it cites; this site
        was built from that content pack by Claude Code, which structured, linked and rendered it without adding facts.
        It was commissioned so that colleagues could critique a working version. The chemical structures are drawn by RDKit from the pack's SMILES strings and the 3D models are PubChem conformers, re-checked at build.
        The figures are synthesised by the builder, not reproduced.
      </p>
      <p className="mt-2 text-sm bx-muted">Permissions: {manifest.permissions.text}. Figures: {manifest.permissions.figures}.</p>

      <h2 className="text-2xl mt-8">What it is not</h2>
      <ul className="list-disc pl-5 mt-2">
        <li>Not medical advice. Preparation is described only as extraction chemistry, and this site gives no dosing.</li>
        <li>Not a measurement of the greenhouse's own plants. Every amount is a published value for the species, or for a study cultivar that the record names.</li>
        <li>Not complete. {provenance.taxa.by_profile_depth.stub} plant records are still stubs, and {provenance.todo.count} open items are listed on <Link className="underline" to="/methods#todo">Methods</Link>.</li>
      </ul>

      <h2 className="text-2xl mt-8">How to report an error or critique a page</h2>
      <p className="mt-2">
        Every page carries a <strong>Critique this page</strong> button in the banner under the header. It opens a new issue on the project's GitHub repository with
        the page's address in the title and a short template: what is wrong, what you expected, and your role (public, student, researcher or greenhouse staff).
      </p>
      <p className="mt-3 flex flex-wrap gap-2">
        <a className="bx-btn-primary" href={critiqueHref('/about')} target="_blank" rel="noreferrer">Critique this page ↗</a>
        <a className="bx-btn" href={issues} target="_blank" rel="noreferrer">All critique issues ↗</a>
        <Link className="bx-btn" to="/methods">How it was built — Methods</Link>
      </p>

      <h2 className="text-2xl mt-8">Version</h2>
      <p className="mt-2 text-sm">Builder {manifest.builder.version} · content current as of {AS_OF} · site built {provenance.built} · {provenance.build_errors} known content-build error{provenance.build_errors === 1 ? '' : 's'}, listed on <Link className="underline" to="/methods">Methods</Link>.</p>
    </div>
  );
}
