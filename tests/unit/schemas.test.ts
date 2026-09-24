/**
 * Pack schemas (KICKOFF §5): the real pack validates, and a fixture with one deliberate error per rule fails the
 * content build with the right message. Each fixture is a copy of content-pack/ with a single mutation, run through
 * scripts/build-content.ts itself (BX_PACK_DIR / BX_OUT_ROOT), so the test exercises exactly the code that ships.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import yaml from 'js-yaml';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  CompoundsSchema, FORBIDDEN_KEYS, ManifestSchema, PreparationsSchema, ReferencesSchema, ScopeSchema, TaxaFileSchema, TaxaSafetySchema,
  scanForbiddenKeys, zodErrors,
} from '../../scripts/lib/schemas';

const ROOT = path.resolve(__dirname, '../..');
const PACK = path.join(ROOT, 'content-pack');
const load = (f: string) => yaml.load(fs.readFileSync(path.join(PACK, f), 'utf8'));
const msgs = (r: { success: boolean; error?: unknown }) => (r.success ? [] : zodErrors('x', r.error as never).map((e) => `${e.where}: ${e.message}`));

interface BuildError { where: string; message: string }

/** Copy the pack, apply one mutation, run the content build against it; return its errors. */
function buildWith(mutate: (dir: string) => void): BuildError[] {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gx-pack-'));
  const pack = path.join(tmp, 'content-pack');
  fs.cpSync(PACK, pack, { recursive: true });
  fs.rmSync(path.join(pack, 'BUILD-ERRORS.md'), { force: true });
  mutate(pack);
  const out = path.join(tmp, 'out');
  try {
    execFileSync(path.join(ROOT, 'node_modules/.bin/tsx'), [path.join(ROOT, 'scripts/build-content.ts')], { env: { ...process.env, BX_PACK_DIR: pack, BX_OUT_ROOT: out }, stdio: 'pipe' });
  } catch { /* a non-zero exit is the point; the errors are in the output */ }
  return JSON.parse(fs.readFileSync(path.join(out, 'src/data/build-errors.json'), 'utf8')) as BuildError[];
}
const editYaml = (dir: string, f: string, fn: (doc: never) => void) => {
  const p = path.join(dir, f);
  const doc = yaml.load(fs.readFileSync(p, 'utf8')) as never;
  fn(doc);
  fs.writeFileSync(p, yaml.dump(doc, { lineWidth: -1 }));
};
const has = (errs: BuildError[], where: RegExp, message: RegExp) => errs.some((e) => where.test(e.where) && message.test(e.message));

describe('the real pack', () => {
  it('passes every catalogue-extension schema', () => {
    expect(msgs(ManifestSchema.safeParse(load('manifest.yaml')))).toEqual([]);
    expect(msgs(ReferencesSchema.safeParse(load('references.yaml')))).toEqual([]);
    expect(msgs(ScopeSchema.safeParse(load('scope.yaml')))).toEqual([]);
    expect(msgs(CompoundsSchema.safeParse(load('compounds.yaml')))).toEqual([]);
    expect(msgs(TaxaFileSchema.safeParse(load('taxa.yaml')))).toEqual([]);
    expect(msgs(PreparationsSchema.safeParse(load('preparations.yaml')))).toEqual([]);
    expect(msgs(TaxaSafetySchema.safeParse(load('taxa_safety_evidence.yaml')))).toEqual([]);
  });
  it('the forbidden-key scan finds none of dose, dosage, indication, serving, frequency anywhere', () => {
    const hits = fs.readdirSync(PACK).filter((f) => /\.ya?ml$/.test(f)).flatMap((f) => scanForbiddenKeys(load(f), FORBIDDEN_KEYS, f));
    expect(hits).toEqual([]);
  });
  it('the scanner itself does find a nested forbidden key', () => {
    expect(scanForbiddenKeys([{ a: { Dosage: 1 } }])).toEqual(['[0]/a/Dosage']);
  });
});

describe('one deliberate error per rule fails the content build with the right message', () => {
  let baseline: BuildError[] = [];
  beforeAll(() => { baseline = buildWith(() => {}); }, 60_000);
  it('baseline: the unmodified copy reports only the known teucrin A taxon error', () => {
    expect(baseline.map((e) => e.where)).toEqual(['compounds/teucrin-a/occurrences/0']);
  });
  it('an occurrence row with no basis', () => {
    const errs = buildWith((d) => editYaml(d, 'compounds.yaml', (doc: { occurrences: { basis?: string }[] }[]) => { delete doc[0].occurrences[0].basis; }));
    expect(has(errs, /^compounds\/0\/occurrences\/0\/basis$/, /basis is required/)).toBe(true);
  }, 30_000);
  it('an evidence row with no test article', () => {
    const errs = buildWith((d) => editYaml(d, 'compounds.yaml', (doc: { id: string; evidence: { test_article?: string }[] }[]) => { delete doc.find((c) => c.id === 'estragole')!.evidence[0].test_article; }));
    expect(has(errs, /evidence\/0\/test_article$/, /must name its test article/)).toBe(true);
  }, 30_000);
  it('a forbidden key in preparations.yaml', () => {
    const errs = buildWith((d) => editYaml(d, 'preparations.yaml', (doc: Record<string, unknown>[]) => { doc[0].dose = 'x'; }));
    expect(has(errs, /^preparations\/peppermint-leaf-hot-infusion$/, /key "dose" is not allowed — preparations.yaml has a closed schema/)).toBe(true);
    expect(has(errs, /^forbidden-key$/, /dose/)).toBe(true);
  }, 30_000);
  it('a planting with an unknown taxon', () => {
    const errs = buildWith((d) => { const p = path.join(d, 'plantings.csv'); fs.writeFileSync(p, fs.readFileSync(p, 'utf8').replace(',eruca-vesicaria,current', ',eruca-nonexistent,current')); });
    expect(has(errs, /^plantings\/GH-001$/, /taxon_id eruca-nonexistent is not in taxa.yaml/)).toBe(true);
  }, 30_000);
  it('a <!-- synthesis --> marker stripped leaves an uncited long block, which fails', () => {
    const errs = buildWith((d) => {
      const p = path.join(d, 'review.md');
      const md = fs.readFileSync(p, 'utf8');
      // strip the first synthesis marker and the citations of the block it marked
      const i = md.indexOf('<!-- synthesis -->');
      const end = md.indexOf('\n\n', i + 20);
      const block = md.slice(i, end).replace('<!-- synthesis -->\n', '').replace(/\s*\[[\d,–-]+\]/g, '');
      fs.writeFileSync(p, md.slice(0, i) + block + md.slice(end));
    });
    expect(has(errs, /^review\.md\//, /uncited block of \d+ words/)).toBe(true);
  }, 30_000);
  it('an unknown compound in a preparation', () => {
    const errs = buildWith((d) => editYaml(d, 'preparations.yaml', (doc: { what_it_extracts: string[] }[]) => { doc[0].what_it_extracts.push('not-a-compound'); }));
    expect(has(errs, /^preparations\/peppermint-leaf-hot-infusion$/, /what_it_extracts: not-a-compound is not a compound record/)).toBe(true);
  }, 30_000);
  it('an evidence grade that does not match its population', () => {
    const errs = buildWith((d) => editYaml(d, 'compounds.yaml', (doc: { id: string; evidence: { population: string }[] }[]) => { doc.find((c) => c.id === 'estragole')!.evidence[0].population = 'human'; }));
    expect(has(errs, /evidence\/0\/population$/, /grade D implies population animal/)).toBe(true);
  }, 30_000);
});
