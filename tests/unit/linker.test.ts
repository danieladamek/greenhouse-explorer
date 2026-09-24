import { describe, expect, it } from 'vitest';
import { buildMatcher, expandCitation, findAmbiguousVariants, isAllCaps, linkCitations, linkTerms, segment, unlink } from '../../scripts/lib/linker';

// Synthetic glossary in the shape of this pack's, used to exercise the matcher's rules.
const TERMS = [
  { id: 'oil', term: 'Oil', variants: ['oils'] },
  { id: 'essential-oil', term: 'Essential oil', variants: ['essential oils'] },
  { id: 'ema', term: 'EMA', variants: ['European Medicines Agency'] },
  { id: 'gpp', term: 'GPP', variants: [] },
  { id: 'terpene-synthase', term: 'Terpene synthase', variants: ['terpene synthases', 'TPS'] },
  { id: 'c5-unit', term: 'C5 unit', variants: ['C5 units'] },
];
const m = buildMatcher(TERMS);

describe('term matcher', () => {
  it('links whole words, case-insensitively, first occurrence per section only', () => {
    const r = linkTerms('An oil and another Oil; oils too.', m);
    expect(r.text).toBe('An [oil](#term:oil) and another Oil; oils too.');
    expect(r.linked).toEqual(['oil']);
    expect(r.occurrences.oil).toBe(3);
  });
  it('links every occurrence when asked', () => {
    expect(linkTerms('EMA and EMA.', m, { everyOccurrence: true }).text).toBe('[EMA](#term:ema) and [EMA](#term:ema).');
  });
  it('respects word boundaries — no match inside a word or across a hyphen', () => {
    expect(linkTerms('EMA-2013 and EMAs and BEMA.', m).text).toBe('EMA-2013 and EMAs and BEMA.');
    expect(linkTerms('The EMA.', m).text).toBe('The [EMA](#term:ema).');
  });
  it('longest match wins, and the shorter term is not linked inside the longer one', () => {
    const r = linkTerms('An essential oil is an oil.', m);
    expect(r.text).toBe('An [essential oil](#term:essential-oil) is an [oil](#term:oil).');
  });
  it('matches multi-token notation', () => {
    expect(linkTerms('Two C5 units join.', m).text).toBe('Two [C5 units](#term:c5-unit) join.');
  });
  it('skips headings, code, maths, links and HTML comments', () => {
    const md = '# EMA heading\n\nText EMA here. `EMA` code. $EMA$ maths. [EMA link](http://x) <!-- EMA --> and\n\n```\nEMA\n```\n';
    const r = linkTerms(md, m);
    expect(r.text).toContain('# EMA heading');
    expect(r.text).toContain('Text [EMA](#term:ema) here.');
    expect(r.text).toContain('`EMA` code. $EMA$ maths. [EMA link](http://x) <!-- EMA -->');
    expect(r.text).toContain('```\nEMA\n```');
    expect(r.linked).toEqual(['ema']);
  });
  it('all-caps variants are case-sensitive, so the word "tps" is not linked as TPS', () => {
    expect(isAllCaps('GPP')).toBe(true);
    expect(isAllCaps('Oil')).toBe(false);
    const r = linkTerms('The tps of a gpp line; TPS turns GPP into linalool.', m);
    expect(r.text).toBe('The tps of a gpp line; [TPS](#term:terpene-synthase) turns [GPP](#term:gpp) into linalool.');
  });
  it('matches notation across <sub> and keeps the link well-formed', () => {
    const sub = buildMatcher([{ id: 'x', term: 'CO 2', variants: [] }]);
    expect(linkTerms('Fixed CO<sub>2</sub> here.', sub).text).toBe('Fixed [CO<sub>2</sub>](#term:x) here.');
  });
  it('reports ambiguous variants across terms', () => {
    expect(findAmbiguousVariants(TERMS)).toEqual([]);
    expect(findAmbiguousVariants([...TERMS, { id: 'other', term: 'Other', variants: ['ema'] }]))
      .toEqual([{ variant: 'ema', ids: ['ema', 'other'] }]);
  });
  it('segment keeps sup/sub inside text but skips other tags', () => {
    expect(segment('a<sup>b</sup> <em>c</em>').filter((s) => s.skip).map((s) => s.text)).toEqual(['<em>', '</em>']);
  });
});

describe('citations', () => {
  it('expands lists and ranges', () => {
    expect(expandCitation('1')).toEqual([1]);
    expect(expandCitation('91,81,95')).toEqual([91, 81, 95]);
    expect(expandCitation('3–5')).toEqual([3, 4, 5]);
    expect(expandCitation('15–17,80')).toEqual([15, 16, 17, 80]);
  });
  it('links tokens outside skip zones and leaves bracketed chemistry alone', () => {
    const r = linkCitations('Claim [1,2] and [3–5]. Not `[9]`. The label [13C]glucose is not a citation.');
    expect(r.text).toBe('Claim [1,2](#cite:1,2) and [3–5](#cite:3,4,5). Not `[9]`. The label [13C]glucose is not a citation.');
    expect(r.cites).toEqual([1, 2, 3, 4, 5]);
  });
  it('unlink restores the original text', () => {
    const src = 'The EMA sets a limit for a constituent of an essential oil [1,2].';
    expect(unlink(linkCitations(linkTerms(src, m).text).text)).toBe(src);
  });
});
