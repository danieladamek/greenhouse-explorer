/** Notepad (APP-SPEC §3.1), ported from apps/ptsd-inflammation-critique with this app's anchors. */
import { describe, expect, it } from 'vitest';
import { emptyNotepad, fromMarkdown, groupBySection, normalise, reducer, resolveAnchor, toMarkdown, type AnchorIndex, type NotepadState } from '../../src/lib/notepad';

const now = () => '2026-09-24T10:00:00.000Z';
const L = (label: string, sections: string[] = []) => ({ label, sections });
const idx: AnchorIndex = {
  sections: [{ id: '1-what-every-plant-shares', title: '1. What every plant shares', number: '1' }, { id: '7-from-leaf-to-cup', title: '7. From leaf to cup', number: '7' }],
  terms: new Map([['chemotype', L('Chemotype', ['7-from-leaf-to-cup'])]]),
  concepts: new Map([['chemotypes', L('Chemotypes')]]),
  compounds: new Map([['menthol', L('(-)-menthol', ['1-what-every-plant-shares', '7-from-leaf-to-cup'])]]),
  taxa: new Map([['salvia-officinalis', L('Salvia officinalis', ['7-from-leaf-to-cup'])], ['lactuca-sativa', L('Lactuca sativa')]]),
  preparations: new Map([['sage-leaf-hot-infusion', L('Sage leaf, hot-water infusion')]]),
  figures: new Map([['fig-pathways', L('Figure 1')]]),
  refs: new Map([[6, L('EMA peppermint', ['7-from-leaf-to-cup'])], [99, L('Other')]]),
};

function seed(): NotepadState {
  let s = emptyNotepad();
  s = reducer(s, { type: 'add', note: { id: 'a', anchor: { type: 'section', id: '7-from-leaf-to-cup' }, quote: 'hot water', body: 'Which temperature?' } }, now);
  s = reducer(s, { type: 'add', note: { id: 'b', anchor: { type: 'compound', id: 'menthol' }, body: 'Check solubility.' } }, now);
  s = reducer(s, { type: 'add', note: { id: 'c', anchor: { type: 'taxon', id: 'lactuca-sativa' }, body: 'Profile next?' } }, now);
  s = reducer(s, { type: 'add', note: { id: 'd', anchor: { type: 'preparation', id: 'sage-leaf-hot-infusion' }, body: 'Thujone in the cup.' } }, now);
  s = reducer(s, { type: 'add', note: { id: 'e', anchor: { type: 'ref', id: '99' }, body: 'Read it.' } }, now);
  return s;
}

describe('notepad reducer', () => {
  it('adds, updates and removes notes', () => {
    let s = seed();
    expect(s.notes).toHaveLength(5);
    s = reducer(s, { type: 'update', id: 'a', body: 'Which temperature, exactly?' }, now);
    expect(s.notes.find((n) => n.id === 'a')!.body).toBe('Which temperature, exactly?');
    s = reducer(s, { type: 'remove', id: 'b' }, now);
    expect(s.notes.map((n) => n.id)).toEqual(['a', 'c', 'd', 'e']);
  });
  it('merges imported notes by id, keeping the newer', () => {
    const s = seed();
    const merged = reducer(s, { type: 'merge', notes: [{ ...s.notes[0], body: 'newer', updated: '2027-01-01' }] }, now);
    expect(merged.notes.find((n) => n.id === 'a')!.body).toBe('newer');
  });
  it('normalises a v1 single-text notepad into one unanchored note, and unknown anchor types to free', () => {
    expect(normalise({ text: 'old notes' }).notes[0].anchor.type).toBe('free');
    expect(normalise({ notes: [{ id: 'x', body: 'y', anchor: { type: 'claim', id: 'C1' } }] }).notes[0].anchor.type).toBe('free');
  });
});

describe('anchors', () => {
  it('resolves every anchor type to its page', () => {
    expect(resolveAnchor({ type: 'compound', id: 'menthol' }, idx).to).toBe('/compounds/menthol');
    expect(resolveAnchor({ type: 'taxon', id: 'salvia-officinalis' }, idx).to).toBe('/plants/salvia-officinalis');
    expect(resolveAnchor({ type: 'preparation', id: 'sage-leaf-hot-infusion' }, idx).to).toBe('/tea#sage-leaf-hot-infusion');
    expect(resolveAnchor({ type: 'term', id: 'chemotype' }, idx).to).toBe('/glossary#chemotype');
    expect(resolveAnchor({ type: 'figure', id: 'fig-pathways' }, idx).to).toBe('/figures/fig-pathways');
    expect(resolveAnchor({ type: 'ref', id: '6' }, idx).to).toBe('/references#ref-6');
  });
  it('files a catalogue note under the first primer section that mentions its object', () => {
    expect(resolveAnchor({ type: 'compound', id: 'menthol' }, idx).section).toBe('1-what-every-plant-shares');
  });
});

describe('Markdown export', () => {
  it('is organised by section in reading order, each note carrying its anchor and quote, and round-trips', () => {
    const s = seed();
    const md = toMarkdown(s, idx, { title: 'T', slug: 'greenhouse-explorer', date: '2026-09-24' });
    expect(md.indexOf('## §1 What every plant shares')).toBeLessThan(md.indexOf('## §7 From leaf to cup'));
    expect(md).toContain('> hot water\n\nWhich temperature?');
    expect(md).toContain('## Catalogue and library');
    const back = fromMarkdown(md);
    const key = (xs: typeof s.notes) => xs.map((n) => [n.id, n.anchor, n.body]).sort((a, b) => String(a[0]).localeCompare(String(b[0])));
    expect(key(back)).toEqual(key(s.notes));
  });
  it('imports a plain Markdown file as one unanchored note', () => {
    expect(fromMarkdown('just some text')[0].anchor.type).toBe('free');
  });
});

describe('notes survive a content rebuild', () => {
  it('an anchor that disappears is kept and reported as orphaned, never dropped', () => {
    const smaller: AnchorIndex = { ...idx, compounds: new Map() };
    const g = groupBySection(seed(), smaller);
    expect(g.find((x) => x.key === '_orphan')!.notes.map((n) => n.id)).toEqual(['b']);
  });
});
