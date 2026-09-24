import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';
import { describe, expect, it } from 'vitest';
import { buildMatcher, unlink } from '../../scripts/lib/linker';
import { claimWords, hasMath, headingOf, parseReview, splitBlocks, splitSections } from '../../scripts/lib/parse';

const ROOT = path.resolve(__dirname, '../..');
const PACK = path.join(ROOT, 'content-pack');
const glossaryOf = (dir: string) => yaml.load(fs.readFileSync(path.join(dir, 'glossary.yaml'), 'utf8')) as { id: string; term: string; variants: string[] }[];

// A two-section review in this pack's shape, written for the test.
const MINI_MD = [
  '<!-- section: 1-what-every-plant-shares -->', '# What every plant shares', '',
  '<!-- framing -->', 'This opening block carries no claim of fact and so is marked as framing, which lets it through the citation gate that every other long block has to pass.', '',
  'Every plant builds cell walls from cellulose, a polymer of glucose, and every one of them fixes carbon with Rubisco [1]. Some make an essential oil in `glands`.', '',
  '<!-- section: 5-pathways -->', '## 5. Pathways', '',
  'Terpenes come from two routes [2].', '',
  '<!-- figure: fig-pathways -->', '',
  'The MEP route supplies monoterpenes [1,2].', '',
  '<!-- synthesis -->', 'So the chemotype of a greenhouse plant is unknown until its own oil is analysed [2].', '',
].join('\n');
const MINI_TERMS = [{ id: 'cellulose', term: 'Cellulose', variants: [] }, { id: 'essential-oil', term: 'Essential oil', variants: ['essential oils'] }];

describe('section and block parser (fixture)', () => {
  const md = MINI_MD;
  const parsed = parseReview(md, buildMatcher(MINI_TERMS));

  it('splits sections with ids, titles and depths', () => {
    expect(splitSections(md).map((s) => s.id)).toEqual(['1-what-every-plant-shares', '5-pathways']);
    expect(parsed.sections.map((s) => [s.id, s.title, s.depth, s.number])).toEqual([['1-what-every-plant-shares', 'What every plant shares', 1, null], ['5-pathways', '5. Pathways', 2, '5']]);
    expect(headingOf('\n### 3.2.1. Signalling\nbody').number).toBe('3.2.1');
  });
  it('resolves figure markers into slots and citations into tokens', () => {
    const sec = parsed.sections[1];
    expect(sec.chunks.map((c) => c.kind)).toEqual(['md', 'figure', 'md', 'md']);
    expect(sec.figures).toEqual(['fig-pathways']);
    expect(parsed.figureMarkers).toEqual(['fig-pathways']);
    expect(parsed.citations).toEqual([1, 2]);
  });
  it('marks framing and synthesis blocks, and gives every synthesis block a stable id', () => {
    expect(parsed.sections[0].chunks[0]).toMatchObject({ kind: 'md', marker: 'framing', id: null });
    expect(parsed.sections[1].chunks.at(-1)).toMatchObject({ kind: 'md', marker: 'synthesis', id: 'syn-5-pathways-1' });
    expect(parsed.synthesis).toHaveLength(1);
    expect(parsed.blocks).toEqual({ total: 5, cited: 4, framing: 1, synthesis: 1 });
  });
  it('links the first occurrence of each term per section, and not inside code', () => {
    const second = parsed.sections[0].chunks[1];
    if (second.kind !== 'md') throw new Error('expected markdown');
    expect(second.md).toContain('[cellulose](#term:cellulose)');
    expect(second.md).toContain('[essential oil](#term:essential-oil)');
    expect(second.md).toContain('`glands`');
  });
  it('a long block with no citation and no framing marker is reported as uncited', () => {
    const p = parseReview(md.replace('<!-- framing -->\n', ''), buildMatcher(MINI_TERMS));
    expect(p.uncited).toHaveLength(1);
    expect(p.uncited[0].section).toBe('1-what-every-plant-shares');
    expect(p.uncited[0].excerpt).toMatch(/This opening block carries no claim of fact/);
  });
  it('a short uncited aside is below the 25-word gate and passes', () => {
    const p = parseReview('<!-- section: s -->\n# S\n\nA short aside.\n', buildMatcher([]));
    expect(p.uncited).toEqual([]);
    // the gate counts words of two letters or more, exactly as tools/validate_pack.py does, so "A" is not one
    expect(claimWords('A short aside.')).toBe(2);
    expect(claimWords('comments are stripped <!-- like this one --> before counting')).toBe(5);
  });

  it('splits blocks at blank lines and keeps fenced code together', () => {
    expect(splitBlocks('a\n\nb\n\n```\nx\n\ny\n```\n')).toEqual(['a', 'b', '```\nx\n\ny\n```']);
  });
  it('detects maths only when a $…$ pair is present, so a lone dollar amount is prose', () => {
    expect(hasMath('more than $100 million allocated')).toBe(false);
    expect(hasMath('the ratio $K_i$ here')).toBe(true);
    expect(hasMath('$$S(t) = P(T > t)$$')).toBe(true);
  });
});

describe('the real pack', () => {
  const md = fs.readFileSync(path.join(PACK, 'review.md'), 'utf8');
  const parsed = parseReview(md, buildMatcher(glossaryOf(PACK)));

  it('parses 8 sections with no duplicate ids', () => {
    expect(parsed.sections).toHaveLength(8);
    expect(parsed.duplicateSections).toEqual([]);
  });
  it('holds the citation gate at zero uncited blocks', () => {
    expect(parsed.uncited).toEqual([]);
    expect(parsed.blocks).toEqual({ total: 37, cited: 31, framing: 6, synthesis: 4 });
  });
  it('gives all 4 synthesis passages an id that deep-links into the reader', () => {
    expect(parsed.synthesis).toHaveLength(4);
    for (const s of parsed.synthesis) {
      expect(s.id).toMatch(/^syn-[a-z0-9-]+-\d+$/);
      expect(parsed.sections.some((sec) => sec.id === s.section)).toBe(true);
    }
    expect(new Set(parsed.synthesis.map((s) => s.id)).size).toBe(4);
  });
  it('renders the builder’s prose as written — stripping the links returns the original text', () => {
    const raw = md.replace(/<!--[\s\S]*?-->/g, '').replace(/^#{1,6} .*$/gm, '').replace(/\s+/g, ' ').trim();
    const rebuilt = parsed.sections
      .flatMap((s) => s.chunks.filter((c) => c.kind === 'md').map((c) => (c as { md: string }).md))
      .map(unlink).join(' ').replace(/\s+/g, ' ').trim();
    expect(rebuilt).toBe(raw);
  });
  it('every figure marker in the review names a figure in the pack', () => {
    const figures = yaml.load(fs.readFileSync(path.join(PACK, 'figures.yaml'), 'utf8')) as { id: string }[];
    const ids = new Set(figures.map((f) => f.id));
    expect(parsed.figureMarkers).toEqual(['fig-pathways', 'fig-extraction']);
    for (const id of parsed.figureMarkers) expect(ids.has(id)).toBe(true);
  });
});
