# Greenhouse Explorer — prototype for critique

A catalogue of every plant grown in the **UAH MARS Research Greenhouse** and its curated chemical constituents, with a
short commissioned primer, built so colleagues can critique a working version.

> **PROTOTYPE FOR CRITIQUE — NOT PEER REVIEWED, NOT AN OFFICIAL UAH RESOURCE.** Written by an AI research builder (the
> Manuscript Interrogator) from the sources it cites; no external scientific review. Content is current as of
> **23 September 2026**. Nothing on the site is medical advice, and it gives no dosing: preparation appears only as
> extraction chemistry.

Every page carries a **Critique this page** button that opens a GitHub issue with the page in the title.

## This is a prototype

Thin where it says it is thin, honest everywhere. 47 taxon records (36 of them "profile in progress" stubs), 11
profiled; 49 compound records; 83 sourced occurrence rows, each with its basis; 49 graded evidence rows, each with its
test article; 6 preparations; one primer chapter; 2 synthesised figures; 100 references; 260 open items in
`content-pack/todo.yaml`, every one listed on `/methods`. Hit counts for the search log were not recorded and the site
says so rather than showing numbers. Extraction was single-pass. The schema extensions it runs on
(`compounds.yaml`, `taxa.yaml`, `plantings.csv`, `preparations.yaml`, `taxa_safety_evidence.yaml`) are a pilot for a
future `mode: catalogue`.

## Quick start

```bash
npm ci
npm run build:content   # validate content-pack/ → src/data/*.json + public/provenance.json
npm run dev             # http://localhost:5173
```

| Command | What it does |
|---|---|
| `npm run build:content` | Validates the pack (zod), links terms, parses the primer, builds the catalogue indexes; **fails loudly** |
| `npm run build:structures` | `scripts/build-data.py` — RDKit + PubChem structure build (see below) |
| `npm run build` | `tsc -b && vite build` → static `dist/` (`BASE_PATH=/greenhouse-explorer/` for GitHub Pages) |
| `npm test` | Vitest: pack schemas (one deliberate error per rule, run through the real content build), term matcher, parser, notepad, geometry, catalogue rules |
| `npm run test:e2e` | Playwright against `dist/` on :4173 (`npm run build` first) |
| `npm run preview` | Serves `dist/`; locally the notepad also autosaves to `notes/notepad.md` |

## Editing the content pack

`content-pack/` is the **only** source of scientific content. The app restructures, links and renders it; it never
adds facts, and a null field renders amber rather than being filled.

1. Edit the pack. Standard files follow `docs/CONTENT-PACK.md` (topic mode); the five catalogue files follow
   KICKOFF §4b–4d. `preparations.yaml` has a **closed schema**: any key other than the fifteen listed fails the build,
   and the build scans the whole pack for `dose`, `dosage`, `indication`, `serving` and `frequency` keys.
2. Run `npm run build:content`. It exits non-zero on a schema violation (including an occurrence row with no basis
   and an evidence row with no test article), an unresolved `[n]`, an unknown term/concept/compound/taxon id, a
   planting whose taxon is not in `taxa.yaml`, an uncited block of ≥ 25 words, or a claim resting on an unverified
   reference. Errors go to `content-pack/BUILD-ERRORS.md` and `/methods`; whatever validated is still emitted.
3. If you changed a SMILES or added a compound, re-run the structure build (below).
4. Commit `src/data/*.json`, `public/provenance.json` and `public/structures/`.

### Known build errors (the CI gate)

The pack currently has **one** known content-build error: teucrin A's germander occurrence row names
`teucrium-chamaedrys`, which has no `taxa.yaml` record (germander is not grown in the greenhouse; the row documents
the skullcap adulteration story). The build reports it, `/methods` publishes it, and the row renders with a "no
taxa.yaml record" label. CI runs the content build with `BX_KNOWN_ERRORS` pointing at the committed
`src/data/build-errors.json`, so it **fails on any new error** but ships with the known, published one. Locally,
without the variable, any error fails the build.

## The structure build

`scripts/build-data.py` is Bioactive Explorer's build step, ported to read `content-pack/compounds.yaml`:

```bash
python3 -m venv .venv && .venv/bin/pip install rdkit pyyaml requests
npm run build:structures            # network the first time; cached in scripts/.cache/
.venv/bin/python scripts/build-data.py --offline   # cache / RDKit only
```

RDKit parses each SMILES, recomputes the formula and InChIKey and **fails on any mismatch** with the pack, recomputes
the molecular weight (shown beside the pack's), fetches the PubChem 3D conformer by InChIKey (re-checked by InChIKey;
RDKit ETKDGv3 + MMFF94 if none exists), and writes `public/structures/{2d,3d,data}/` plus `summary.json`. A record
with no SMILES takes the "No single structure" path. `public/structures/` is committed, so CI needs neither RDKit nor
PubChem, and the site never fetches anything at runtime.

## Provenance

- `public/provenance.json` (also shown on `/methods`) counts everything: blocks and citations, synthesis passages,
  taxa by identity status and profile depth, plantings collapsed onto taxa, occurrence rows by basis and by
  verification, evidence rows by grade and test article, the forbidden-key scan, and the structure-build summary.
- **Basis rule.** An amount never loses its basis; `unstated` and `presence_only` rows are never charted; `/compare`
  refuses rows of different bases (and different units within a basis) on one axis. Nothing is averaged or converted.
- **Evidence rule.** Every health statement renders with its grade (A–E, T) and its test article together, under the
  heading "Evidence".
- **Tours** (`src/tours/*.json`) are written by the builder from pack fields only; each step names the field it
  paraphrases and keeps its citations, and the content build validates every route and `[n]` in them.

## Stack

Vite 5 + React 18 + TypeScript (strict) + Tailwind 3, react-router 6, react-markdown + KaTeX, Recharts, d3, 3Dmol.js
(bundled), smiles-drawer, zod, js-yaml, papaparse; Vitest + Playwright. The notepad is the standard one ported from
`ptsd-inflammation-critique`; the structure viewer, tours, heatmap and shared-compound diagram are ported from
Bioactive Explorer; the reader, glossary, figures and comparison scaffolding come from Psychedelics Explorer.

Deployed to GitHub Pages by `.github/workflows/deploy.yml` on every push to `main`.
