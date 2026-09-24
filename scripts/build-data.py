#!/usr/bin/env python3
"""
build-data.py — Greenhouse Explorer structure build (ported from Bioactive Explorer's scripts/build-data.py).

Reads   content-pack/compounds.yaml            (KICKOFF §4b; the only source of structures)
Writes  public/structures/2d/<id>.svg and <id>.dark.svg   (RDKit 2D depictions, light + dark)
        public/structures/3d/<id>.sdf                     (PubChem 3D conformer, or RDKit ETKDGv3+MMFF94)
        public/structures/data/<id>.json                  (per-atom records + 2D atom coordinates, fetched on demand)
        public/structures/summary.json                    (per-compound descriptors + the build summary; read by
                                                           scripts/build-content.ts, never by the app at runtime)

What it does (unchanged from Bioactive Explorer except where noted)
  1. Builds an RDKit molecule from every `identity.smiles`, computes the molecular formula and InChIKey and
     FAILS LOUDLY if either differs from the pack's value.
  2. Recomputes the average molecular weight and writes it beside the pack's `identity.mw` (`mw_source` says
     which one was hand-entered); a difference > 0.05 g/mol is reported, not repaired.
  3. Verifies `pubchem_cid` by InChIKey lookup (PUG-REST) and `chebi_id` by the ChEBI web service (warn-only).
  4. Fetches a PubChem 3D conformer SDF by InChIKey; if none exists generates one with RDKit (ETKDGv3 + MMFF94)
     and records the fallback. Heavy atoms are renumbered first so heavy-atom indices agree in SDF, SVG and JSON.
  5. Computes descriptors, per-atom Gasteiger charges / CIP labels / hybridisation, and SMARTS functional-group
     matches (greenhouse additions: ketone, aldehyde, alcohol, methoxy, glycoside, lactone, allyl, isopropyl).
  6. A record with `identity.smiles: null` takes the "No single structure" path (feature C7) — nothing is drawn.

Usage
  .venv/bin/python scripts/build-data.py            # full build (network required the first time)
  .venv/bin/python scripts/build-data.py --offline  # no PubChem/ChEBI calls; cache or RDKit only
  .venv/bin/python scripts/build-data.py --no-cache # ignore scripts/.cache and refetch everything

Idempotent: PubChem responses are cached under scripts/.cache/ (git-ignored), RDKit embedding uses a fixed seed,
and files are only rewritten when their content changes. public/structures/ is committed, so CI needs neither
RDKit nor PubChem.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
import time
from pathlib import Path

import yaml
from rdkit import Chem, RDLogger
from rdkit.Chem import AllChem, Crippen, Descriptors, Draw, Lipinski, rdCIPLabeler, rdMolDescriptors
from rdkit.Chem.Draw import rdMolDraw2D

try:
    import requests
except ImportError:  # pragma: no cover
    requests = None

RDLogger.DisableLog("rdApp.warning")

ROOT = Path(__file__).resolve().parent.parent
PACK = ROOT / "content-pack"
PUB = ROOT / "public" / "structures"
PUB2D = PUB / "2d"
PUB3D = PUB / "3d"
PUBDATA = PUB / "data"
CACHE = ROOT / "scripts" / ".cache"

# SMARTS functional groups. Each match is stored as a list of atom-index tuples.
FUNCTIONAL_GROUPS = [
    ("phenol", "Phenol OH", "[OX2H][c]"),
    ("catechol", "Catechol (1,2-diol)", "[OX2H]c:c[OX2H]"),
    ("pyrogallol", "Pyrogallol (1,2,3-triol)", "[OX2H]c:c([OX2H]):c[OX2H]"),
    ("alcohol", "Aliphatic alcohol", "[OX2H][CX4]"),
    ("methoxy", "Methoxy (aryl methyl ether)", "[CH3][OX2]c"),
    ("ketone", "Ketone", "[#6][CX3](=O)[#6]"),
    ("aldehyde", "Aldehyde", "[CX3H1](=O)[#6]"),
    ("carboxylic-acid", "Carboxylic acid / carboxylate", "[CX3](=O)[OX2H1,OX1-]"),
    ("ester", "Ester", "[#6][CX3](=O)[OX2][#6]"),
    ("lactone", "Lactone (cyclic ester)", "[#6;R][CX3;R](=O)[OX2;R][#6;R]"),
    ("glycoside", "Sugar (glycoside / glucuronide)", "[OX2;R]1[CX4;R][CX4;R]([OX2])[CX4;R]([OX2])[CX4;R]([OX2])[CX4;R]1"),
    ("allyl", "Allyl side chain", "[CH2]=[CH][CH2]c"),
    ("isopropyl", "Isopropyl group", "[CH3][CX4H1]([CH3])[#6]"),
    ("cinnamoyl", "α,β-Unsaturated acid (cinnamoyl)", "c-[CX3]=[CX3]-[CX3](=O)[#8]"),
    ("chromone", "Chromone (flavone core)", "O=c1cc(-c)oc2ccccc12"),
    ("furan", "Furan ring", "[o]1cccc1"),
    ("cis-alkene", "cis-Alkene", None),  # computed from bond stereo
]

DESCRIPTOR_HELP = {
    "heavyAtoms": "Non-hydrogen atom count: a rough measure of molecular size.",
    "rings": "Total ring count (SSSR). Rigid ring systems limit conformational freedom.",
    "aromaticRings": "Aromatic rings are flat, stack with proteins and DNA, and absorb UV.",
    "hbd": "Hydrogen-bond donors (O–H, N–H). Many donors mean high water solubility and poor membrane crossing.",
    "hba": "Hydrogen-bond acceptors (N, O). Lipinski's rule of five uses ≤10 as a drug-likeness cutoff.",
    "rotatableBonds": "Flexibility. Rigid molecules (few rotatable bonds) bind more selectively; long chains are floppy.",
    "logP": "Crippen octanol/water partition estimate, computed by RDKit from the structure (not a measured logP).",
    "tpsa": "Topological polar surface area (Å²), computed from the structure.",
    "fsp3": "Fraction of sp³ carbons. Flat aromatic molecules have low Fsp³; 3D-shaped natural products have high Fsp³.",
    "stereocenters": "Number of defined stereocentres in the SMILES.",
    "charge": "Net formal charge.",
}


class BuildError(Exception):
    pass


def log(msg: str) -> None:
    print(msg, flush=True)


def write_if_changed(path: Path, content: str) -> bool:
    path.parent.mkdir(parents=True, exist_ok=True)
    if path.exists() and path.read_text(encoding="utf-8") == content:
        return False
    path.write_text(content, encoding="utf-8")
    return True


# ──────────────────────────────────────────── network ────────────────────────────────────────────
class PubChem:
    BASE = "https://pubchem.ncbi.nlm.nih.gov/rest/pug"

    def __init__(self, offline: bool, use_cache: bool):
        self.offline = offline
        self.use_cache = use_cache
        CACHE.mkdir(parents=True, exist_ok=True)
        self.last = 0.0

    def _get(self, url: str) -> tuple[int, str]:
        key = hashlib.sha1(url.encode()).hexdigest()
        cpath = CACHE / f"{key}.json"
        if self.use_cache and cpath.exists():
            d = json.loads(cpath.read_text())
            return d["status"], d["text"]
        if self.offline or requests is None:
            return -1, ""
        # be polite: ≤ 5 requests/s
        dt = time.time() - self.last
        if dt < 0.25:
            time.sleep(0.25 - dt)
        for attempt in range(3):
            try:
                r = requests.get(url, timeout=60)
                self.last = time.time()
                if r.status_code in (503, 429) and attempt < 2:
                    time.sleep(2 * (attempt + 1))
                    continue
                cpath.write_text(json.dumps({"url": url, "status": r.status_code, "text": r.text}))
                return r.status_code, r.text
            except requests.RequestException as ex:  # pragma: no cover
                if attempt == 2:
                    log(f"  ! network error for {url}: {ex}")
                    return -1, ""
                time.sleep(2)
        return -1, ""

    def cids_for_inchikey(self, key: str) -> list[int] | None:
        status, text = self._get(f"{self.BASE}/compound/inchikey/{key}/cids/JSON")
        if status == 200:
            return list(text and json.loads(text)["IdentifierList"]["CID"] or [])
        if status == 404:
            return []
        return None

    def sdf3d_for_inchikey(self, key: str) -> str | None:
        """Returns molblock text, '' if PubChem has no 3D record, None if unreachable."""
        status, text = self._get(f"{self.BASE}/compound/inchikey/{key}/SDF?record_type=3d")
        if status == 200:
            return text
        if status == 404:
            return ""
        return None

    def chebi_inchikey(self, chebi_id: str) -> str | None:
        num = chebi_id.split(":")[-1]
        status, text = self._get(f"https://www.ebi.ac.uk/chebi/backend/api/public/compound/{num}/")
        if status != 200:
            return None
        try:
            doc = json.loads(text)
        except ValueError:
            return ""

        def find(node):  # the key sits under default_structure; search recursively to be safe
            if isinstance(node, dict):
                if isinstance(node.get("standard_inchi_key"), str):
                    return node["standard_inchi_key"]
                for v in node.values():
                    r = find(v)
                    if r:
                        return r
            elif isinstance(node, list):
                for v in node:
                    r = find(v)
                    if r:
                        return r
            return None

        return find(doc) or ""


# ──────────────────────────────────────────── chemistry ────────────────────────────────────────────
def heavy_first(mol: Chem.Mol) -> Chem.Mol:
    """Renumber so all heavy atoms precede all hydrogens (order otherwise preserved)."""
    order = [a.GetIdx() for a in mol.GetAtoms() if a.GetAtomicNum() > 1] + [
        a.GetIdx() for a in mol.GetAtoms() if a.GetAtomicNum() == 1
    ]
    return Chem.RenumberAtoms(mol, order)


def inchikey_of(mol: Chem.Mol) -> str:
    return Chem.MolToInchiKey(mol)


def rdkit_conformer(smiles: str, seed: int = 0xF00D) -> Chem.Mol:
    mol = Chem.AddHs(Chem.MolFromSmiles(smiles))
    params = AllChem.ETKDGv3()
    params.randomSeed = seed
    params.useRandomCoords = False
    if AllChem.EmbedMolecule(mol, params) != 0:
        params.useRandomCoords = True
        if AllChem.EmbedMolecule(mol, params) != 0:
            raise BuildError(f"ETKDG embedding failed for {smiles}")
    props = AllChem.MMFFGetMoleculeProperties(mol, mmffVariant="MMFF94")
    if props is None:
        raise BuildError(f"MMFF94 could not type {smiles}")
    ff = AllChem.MMFFGetMoleculeForceField(mol, props)
    ff.Minimize(maxIts=2000)
    Chem.AssignStereochemistryFrom3D(mol)
    return mol


def keys_match(mol: Chem.Mol, expected_key: str, strict: bool) -> bool:
    """Full InChIKey match, or connectivity-block match when the reference SMILES leaves
    stereocentres unspecified (a 3D structure always implies full stereo)."""
    key = inchikey_of(mol)
    if key == expected_key:
        return True
    return (not strict) and key.split("-")[0] == expected_key.split("-")[0]


def has_unspecified_stereo(mol: Chem.Mol) -> bool:
    centers = Chem.FindMolChiralCenters(mol, includeUnassigned=True, useLegacyImplementation=False)
    return any(lab == "?" for _, lab in centers)


def load_pubchem_sdf(molblock: str, expected_key: str, strict: bool) -> Chem.Mol | None:
    mol = Chem.MolFromMolBlock(molblock, removeHs=False, sanitize=True)
    if mol is None:
        return None
    if mol.GetNumConformers() == 0:
        return None
    Chem.AssignStereochemistryFrom3D(mol)
    if not keys_match(mol, expected_key, strict):
        return None
    return mol


def atom_records(molH: Chem.Mol) -> list[dict]:
    AllChem.ComputeGasteigerCharges(molH)
    rdCIPLabeler.AssignCIPLabels(molH)
    out = []
    for a in molH.GetAtoms():
        q = a.GetDoubleProp("_GasteigerCharge") if a.HasProp("_GasteigerCharge") else 0.0
        if q != q:  # NaN guard
            q = 0.0
        out.append({
            "i": a.GetIdx(),
            "el": a.GetSymbol(),
            "hyb": str(a.GetHybridization()).lower(),
            "chg": a.GetFormalCharge(),
            "arom": a.GetIsAromatic(),
            "nH": a.GetTotalNumHs(includeNeighbors=True),
            "q": round(q, 4),
            "cip": a.GetProp("_CIPCode") if a.HasProp("_CIPCode") else None,
        })
    return out


def functional_groups(mol_heavy: Chem.Mol) -> list[dict]:
    groups = []
    for gid, name, smarts in FUNCTIONAL_GROUPS:
        if smarts is None:  # cis-alkene
            matches = []
            for b in mol_heavy.GetBonds():
                if b.GetBondType() == Chem.BondType.DOUBLE and b.GetStereo() in (
                    Chem.BondStereo.STEREOZ, Chem.BondStereo.STEREOCIS
                ):
                    matches.append([b.GetBeginAtomIdx(), b.GetEndAtomIdx()])
        else:
            patt = Chem.MolFromSmarts(smarts)
            matches = [list(m) for m in mol_heavy.GetSubstructMatches(patt, uniquify=True)]
        if matches:
            groups.append({"id": gid, "name": name, "matches": matches})
    return groups


def descriptors(mol_heavy: Chem.Mol) -> dict:
    stereo = Chem.FindMolChiralCenters(mol_heavy, includeUnassigned=False, useLegacyImplementation=False)
    return {
        "heavyAtoms": mol_heavy.GetNumHeavyAtoms(),
        "rings": rdMolDescriptors.CalcNumRings(mol_heavy),
        "aromaticRings": rdMolDescriptors.CalcNumAromaticRings(mol_heavy),
        "hbd": Lipinski.NumHDonors(mol_heavy),
        "hba": Lipinski.NumHAcceptors(mol_heavy),
        "rotatableBonds": Lipinski.NumRotatableBonds(mol_heavy),
        "logP": round(Crippen.MolLogP(mol_heavy), 2),
        "tpsa": round(rdMolDescriptors.CalcTPSA(mol_heavy), 1),
        "fsp3": round(rdMolDescriptors.CalcFractionCSP3(mol_heavy), 2),
        "stereocenters": len(stereo),
        "charge": Chem.GetFormalCharge(mol_heavy),
    }


def draw_2d(mol_heavy: Chem.Mol, dark: bool, width=380, height=300) -> tuple[str, list[list[float]]]:
    m = Chem.Mol(mol_heavy)
    AllChem.Compute2DCoords(m)
    Chem.rdDepictor.StraightenDepiction(m)
    d = rdMolDraw2D.MolDraw2DSVG(width, height)
    opts = d.drawOptions()
    opts.clearBackground = False
    opts.padding = 0.08
    opts.bondLineWidth = 1.6
    opts.fixedFontSize = 14
    opts.addStereoAnnotation = False
    if dark:
        opts.setBackgroundColour((0.08, 0.075, 0.06, 0))
        opts.updateAtomPalette({
            -1: (0.92, 0.90, 0.86),  # default (carbon)
            6: (0.92, 0.90, 0.86), 7: (0.45, 0.62, 1.0), 8: (1.0, 0.45, 0.45),
            1: (0.75, 0.75, 0.75), 16: (0.95, 0.85, 0.3), 17: (0.3, 0.9, 0.3),
        })
    else:
        opts.updateAtomPalette({
            -1: (0.12, 0.10, 0.09), 6: (0.12, 0.10, 0.09), 7: (0.1, 0.25, 0.8),
            8: (0.8, 0.1, 0.1), 1: (0.4, 0.4, 0.4),
        })
    d.DrawMolecule(m)
    d.FinishDrawing()
    svg = d.GetDrawingText()
    # per-atom draw coordinates for client-side highlight overlays
    coords = []
    for a in m.GetAtoms():
        p = d.GetDrawCoords(a.GetIdx())
        coords.append([round(p.x, 1), round(p.y, 1)])
    # strip the XML prolog so the SVG can be inlined
    svg = re.sub(r"<\?xml[^>]*\?>\s*", "", svg)
    return svg, coords


def build_structure(cid_label: str, smiles: str, expected_key: str, expected_formula: str,
                    pubchem: PubChem, offline: bool, errors: list[str], fallbacks: list[str]) -> dict:
    mol0 = Chem.MolFromSmiles(smiles)
    if mol0 is None:
        raise BuildError(f"{cid_label}: SMILES does not parse")
    formula = rdMolDescriptors.CalcMolFormula(mol0)
    if formula != expected_formula:
        errors.append(f"FORMULA MISMATCH {cid_label}: hand-entered {expected_formula}, RDKit {formula}")
    key = inchikey_of(mol0)
    if key != expected_key:
        errors.append(f"INCHIKEY MISMATCH {cid_label}: hand-entered {expected_key}, RDKit {key}")

    # 3D conformer
    source = None
    molH = None
    strict = not has_unspecified_stereo(mol0)
    if not strict:
        log(f"  · {cid_label}: reference SMILES has unspecified stereocentres; conformer checked on connectivity only")
    sdf = pubchem.sdf3d_for_inchikey(expected_key)
    if sdf:
        molH = load_pubchem_sdf(sdf, expected_key, strict)
        if molH is None:
            log(f"  ! {cid_label}: PubChem 3D record failed InChIKey re-check; using RDKit conformer")
        else:
            source = "pubchem"
    elif sdf is None and not offline:
        log(f"  ! {cid_label}: PubChem unreachable; using RDKit conformer")
    if molH is None:
        molH = rdkit_conformer(smiles)
        source = "rdkit"
        fallbacks.append(cid_label)
    molH = heavy_first(molH)
    molH.SetProp("_Name", cid_label)
    molH.SetProp("conformerSource", source)
    if not keys_match(molH, expected_key, strict):
        raise BuildError(f"{cid_label}: conformer InChIKey mismatch after processing")

    mol_heavy = Chem.RemoveHs(molH, sanitize=True)
    # RemoveHs keeps heavy-atom order → indices identical to molH[0:nHeavy]
    assert mol_heavy.GetNumAtoms() == molH.GetNumHeavyAtoms()

    svg_light, coords = draw_2d(mol_heavy, dark=False)
    svg_dark, _ = draw_2d(mol_heavy, dark=True)

    return {
        "formulaComputed": formula,
        "inchikeyComputed": key,
        "canonicalSmiles": Chem.MolToSmiles(mol0),
        "monoisotopicMass": round(Descriptors.ExactMolWt(mol0), 4),
        "averageMass": round(Descriptors.MolWt(mol0), 3),
        "descriptors": descriptors(mol_heavy),
        "atomCount": molH.GetNumAtoms(),
        "heavyAtomCount": mol_heavy.GetNumAtoms(),
        "functionalGroups": functional_groups(mol_heavy),
        "conformerSource": source,
        "sdf": f"structures/3d/{cid_label}.sdf",
        "svg": {"light": f"structures/2d/{cid_label}.svg", "dark": f"structures/2d/{cid_label}.dark.svg",
                "width": 380, "height": 300},
        "detail": f"structures/data/{cid_label}.json",
        "_files": {"sdf": Chem.MolToMolBlock(molH) + f">  <conformerSource>\n{source}\n\n$$$$\n",
                   "svg": svg_light, "svgDark": svg_dark,
                   "detail": json.dumps({"id": cid_label, "atoms": atom_records(molH), "atomCoords": coords}, separators=(",", ":")) + "\n"},
    }


# ──────────────────────────────────────────── main ────────────────────────────────────────────
def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--offline", action="store_true", help="no network; cache or RDKit conformers only")
    ap.add_argument("--no-cache", action="store_true", help="ignore scripts/.cache")
    args = ap.parse_args()

    with open(PACK / "compounds.yaml", encoding="utf-8") as fh:
        entries = yaml.safe_load(fh)
    if not isinstance(entries, list):
        raise BuildError("content-pack/compounds.yaml must be a list")

    pubchem = PubChem(offline=args.offline, use_cache=not args.no_cache)
    mismatches: list[str] = []
    fallbacks: list[str] = []
    warnings: list[str] = []
    mw_diffs: list[dict] = []
    no_structure: list[str] = []
    records: dict[str, dict] = {}
    written = 0

    for e in entries:
        cid = e["id"]
        ident = e.get("identity") or {}
        smi = ident.get("smiles")
        if not smi:
            log(f"• {cid}: no SMILES — 'No single structure' path (C7)")
            no_structure.append(cid)
            records[cid] = {"id": cid, "structure": None}
            continue
        log(f"• {cid}")
        try:
            s = build_structure(cid, smi, ident.get("inchikey") or "", ident.get("formula") or "",
                                pubchem, args.offline, mismatches, fallbacks)
        except BuildError as ex:
            mismatches.append(str(ex))
            records[cid] = {"id": cid, "structure": None, "error": str(ex)}
            continue
        pc = ident.get("pubchem_cid")
        if pc is not None:
            cids = pubchem.cids_for_inchikey(ident["inchikey"])
            if cids is None:
                warnings.append(f"{cid}: could not verify pubchem_cid {pc} (network)")
            elif int(pc) not in cids:
                warnings.append(f"{cid}: pubchem_cid {pc} not among the CIDs its InChIKey resolves to {cids[:5]}")
        chebi = ident.get("chebi_id")
        if chebi:
            ck = pubchem.chebi_inchikey(str(chebi))
            if ck is None:
                warnings.append(f"{cid}: could not verify {chebi} (network)")
            elif ck and ck != ident["inchikey"]:
                warnings.append(f"{cid}: {chebi} has InChIKey {ck!r}, pack says {ident['inchikey']}")
        mw_pack = ident.get("mw")
        mw_rdkit = s["averageMass"]
        if isinstance(mw_pack, (int, float)) and abs(mw_pack - mw_rdkit) > 0.05:
            mw_diffs.append({"id": cid, "pack": mw_pack, "rdkit": mw_rdkit, "mw_source": ident.get("mw_source")})
        files = s.pop("_files")
        written += write_if_changed(PUB3D / f"{cid}.sdf", files["sdf"])
        written += write_if_changed(PUB2D / f"{cid}.svg", files["svg"])
        written += write_if_changed(PUB2D / f"{cid}.dark.svg", files["svgDark"])
        written += write_if_changed(PUBDATA / f"{cid}.json", files["detail"])
        s["mwPack"] = mw_pack
        s["mwSource"] = ident.get("mw_source")
        records[cid] = {"id": cid, "structure": s}

    formula_mm = [m for m in mismatches if m.startswith("FORMULA")]
    key_mm = [m for m in mismatches if m.startswith("INCHIKEY")]
    summary = {
        "generator": "scripts/build-data.py",
        "rdkitVersion": __import__("rdkit").__version__,
        "compounds": len(entries),
        "structures": sum(1 for r in records.values() if r.get("structure")),
        "noSingleStructure": no_structure,
        "formulaMismatches": formula_mm,
        "inchikeyMismatches": key_mm,
        "otherErrors": [m for m in mismatches if m not in formula_mm and m not in key_mm],
        "rdkitConformers": sorted(fallbacks),
        "pubchemConformers": sorted(k for k, r in records.items() if (r.get("structure") or {}).get("conformerSource") == "pubchem"),
        "mwDifferences": mw_diffs,
        "warnings": warnings,
        "functionalGroups": [{"id": g, "name": n} for g, n, _ in FUNCTIONAL_GROUPS],
        "descriptorHelp": DESCRIPTOR_HELP,
    }
    text = json.dumps({"summary": summary, "records": records}, ensure_ascii=False, indent=1) + "\n"
    write_if_changed(PUB / "summary.json", text)
    log("")
    log(f"{written} structure file(s) (re)written under public/structures/")
    log(f"Structures: {summary['structures']} / {len(entries)}; no single structure: {', '.join(no_structure) or 'none'}")
    log(f"Formula mismatches: {len(formula_mm)} · InChIKey mismatches: {len(key_mm)}")
    log(f"PubChem conformers: {len(summary['pubchemConformers'])} · RDKit conformer fallbacks ({len(fallbacks)}): {', '.join(sorted(fallbacks)) or 'none'}")
    for d in mw_diffs:
        log(f"  · mw {d['id']}: pack {d['pack']} ({d['mw_source']}) vs RDKit {d['rdkit']}")
    for w in warnings:
        log("  ⚠ " + w)
    if mismatches:
        for m in mismatches:
            log("  ✗ " + m)
        raise BuildError(f"{len(mismatches)} identity mismatch(es) — the pack's identity block disagrees with its SMILES")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except BuildError as ex:
        log(f"\nBUILD FAILED: {ex}")
        sys.exit(1)
