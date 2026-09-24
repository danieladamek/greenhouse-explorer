/**
 * Review parser: `<!-- section: id -->` → sections[]; `<!-- figure: id -->` → figure slots;
 * `<!-- framing -->` / `<!-- synthesis -->` → per-block markers; `[n]` → citation tokens;
 * glossary terms → term links.
 *
 * Topic mode (APP-SPEC §6.1) needs block-level granularity that manuscript mode does not: the citation-coverage
 * gate is per block, and every `<!-- synthesis -->` block needs a stable id so /methods can deep-link it. So a
 * section's body is split at blank lines into blocks, and each block becomes its own `md` chunk carrying its
 * marker. A comment-only block sets the marker for the block that follows it (the shape review.md is written in).
 */
import { linkCitations, linkTerms, type Matcher } from './linker';

export type BlockMarker = 'framing' | 'synthesis' | null;

export type Chunk =
  | { kind: 'md'; md: string; hasMath: boolean; marker: BlockMarker; id: string | null }
  | { kind: 'figure'; id: string };

export interface Section {
  id: string;
  title: string;
  depth: number;         // 1 = title, 2 = top-level section, 3/4 = subsections
  number: string | null; // "2.1" etc. if the heading carries one
  chunks: Chunk[];
  terms: string[];       // glossary ids linked in this section (first occurrence each)
  cites: number[];       // reference numbers cited in this section (unique, in order)
  figures: string[];     // figure ids embedded in this section
  words: number;
  blocks: number;
  cited_blocks: number;
  framing_blocks: number;
  synthesis_blocks: number;
}

export interface SynthesisPassage { id: string; section: string; excerpt: string; words: number }

export interface UncitedBlock { section: string; words: number; excerpt: string }

export interface ParsedReview {
  sections: Section[];
  figureMarkers: string[];
  citations: number[];                 // all reference numbers cited anywhere, unique
  occurrences: Record<string, number>; // term id → whole-word occurrences across the body
  duplicateSections: string[];
  synthesis: SynthesisPassage[];
  uncited: UncitedBlock[];
  blocks: { total: number; cited: number; framing: number; synthesis: number };
}

const SECTION_RE = /<!--\s*section:\s*([a-z0-9-]+)\s*-->/g;
const MARKER_RE = /^<!--\s*(framing|synthesis)\s*-->$/;
const SLOT_RE = /^<!--\s*(figure|box):\s*([a-z0-9-]+)\s*-->$/;

export function splitSections(md: string): { id: string; body: string }[] {
  const out: { id: string; body: string }[] = [];
  const marks = [...md.matchAll(SECTION_RE)];
  for (let i = 0; i < marks.length; i++) {
    const start = marks[i].index! + marks[i][0].length;
    const end = i + 1 < marks.length ? marks[i + 1].index! : md.length;
    out.push({ id: marks[i][1], body: md.slice(start, end) });
  }
  return out;
}

export function headingOf(body: string): { title: string; depth: number; number: string | null; rest: string } {
  const lines = body.replace(/^\s*\n/, '').split('\n');
  const m = /^(#{1,6})\s+(.*)$/.exec(lines[0] ?? '');
  if (!m) return { title: '', depth: 0, number: null, rest: body };
  const text = m[2].trim();
  const num = /^(\d+(?:\.\d+)*)\.?\s+/.exec(text);
  return { title: text, depth: m[1].length, number: num ? num[1] : null, rest: lines.slice(1).join('\n') };
}

export function wordCount(md: string): number {
  return md.replace(/<!--[\s\S]*?-->/g, '').replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length;
}

/** Words the citation-coverage gate counts: alphabetic words only, comments stripped (mirrors tools/validate_pack.py). */
export function claimWords(text: string): number {
  return (text.replace(/<!--[\s\S]*?-->/g, '').match(/[A-Za-z][A-Za-z'’-]+/g) ?? []).length;
}

/** Split a section body into blank-line separated blocks, keeping fenced code together. */
export function splitBlocks(body: string): string[] {
  const out: string[] = [];
  let cur: string[] = [];
  let fence = false;
  for (const line of body.split('\n')) {
    if (line.trim().startsWith('```')) fence = !fence;
    if (!line.trim() && !fence) {
      if (cur.length) { out.push(cur.join('\n')); cur = []; }
    } else cur.push(line);
  }
  if (cur.length) out.push(cur.join('\n'));
  return out;
}

/** Maths only when a `$…$` or `$$…$$` pair is actually present — a lone "$100 million" is prose, not KaTeX. */
export function hasMath(text: string): boolean {
  return /\$\$[\s\S]*?\$\$/.test(text) || /(?<!\\)\$[^$\n]+(?<!\\)\$/.test(text);
}

export function parseReview(md: string, matcher: Matcher, opts: { everyOccurrence?: boolean; citationWordGate?: number } = {}): ParsedReview {
  const gate = opts.citationWordGate ?? 25;
  const raw = splitSections(md);
  const ids = raw.map((s) => s.id);
  const duplicateSections = ids.filter((id, i) => ids.indexOf(id) !== i);
  const figureMarkers: string[] = [];
  const citations = new Set<number>();
  const occurrences: Record<string, number> = {};
  const synthesis: SynthesisPassage[] = [];
  const uncited: UncitedBlock[] = [];
  const blocks = { total: 0, cited: 0, framing: 0, synthesis: 0 };

  const sections: Section[] = raw.map((s) => {
    const { title, depth, number, rest } = headingOf(s.body);
    const seen = new Set<string>();
    const terms: string[] = [];
    const cites: number[] = [];
    const figures: string[] = [];
    const chunks: Chunk[] = [];
    const counts = { blocks: 0, cited: 0, framing: 0, synthesis: 0 };
    let marker: BlockMarker = null;
    let synthIndex = 0;

    for (const block of splitBlocks(rest)) {
      const trimmed = block.trim();

      const markerOnly = MARKER_RE.exec(trimmed);
      if (markerOnly) { marker = markerOnly[1] as BlockMarker; continue; }

      const slot = SLOT_RE.exec(trimmed);
      if (slot) {
        if (slot[1] === 'figure') { figures.push(slot[2]); figureMarkers.push(slot[2]); chunks.push({ kind: 'figure', id: slot[2] }); }
        marker = null;
        continue;
      }

      // an inline marker on the first line of the block counts too
      let body = block;
      const inline = /^<!--\s*(framing|synthesis)\s*-->\s*/.exec(trimmed);
      if (inline) { marker = inline[1] as BlockMarker; body = trimmed.slice(inline[0].length); }

      const plain = body.replace(/<!--[\s\S]*?-->/g, '').trim();
      if (!plain) { continue; }

      const isHeadingOrTable = plain.startsWith('#') || plain.startsWith('```') || plain.startsWith('|');
      const words = claimWords(plain);
      const cited = /\[\d/.test(plain);

      if (!isHeadingOrTable) {
        blocks.total++; counts.blocks++;
        if (cited) { blocks.cited++; counts.cited++; }
        if (marker === 'framing') { blocks.framing++; counts.framing++; }
        if (marker === 'synthesis') { blocks.synthesis++; counts.synthesis++; }
        // APP-SPEC §6.1 rule 5 — uncited prose is a build error, never repaired by inventing a citation.
        if (words >= gate && !cited && marker !== 'framing') uncited.push({ section: s.id, words, excerpt: plain.slice(0, 120) });
      }

      const id = marker === 'synthesis' ? `syn-${s.id}-${++synthIndex}` : null;
      if (id) synthesis.push({ id, section: s.id, excerpt: plain.replace(/\s+/g, ' ').slice(0, 220), words });

      const linked = linkTerms(body, matcher, { everyOccurrence: opts.everyOccurrence, seen });
      for (const [tid, n] of Object.entries(linked.occurrences)) occurrences[tid] = (occurrences[tid] ?? 0) + n;
      terms.push(...linked.linked);
      const withCites = linkCitations(linked.text);
      for (const n of withCites.cites) { citations.add(n); if (!cites.includes(n)) cites.push(n); }
      chunks.push({ kind: 'md', md: withCites.text.trim(), hasMath: hasMath(body), marker, id });
      marker = null;
    }

    return {
      id: s.id, title, depth, number, chunks, terms, cites, figures, words: wordCount(rest),
      blocks: counts.blocks, cited_blocks: counts.cited, framing_blocks: counts.framing, synthesis_blocks: counts.synthesis,
    };
  });

  return {
    sections, figureMarkers, citations: [...citations].sort((a, b) => a - b), occurrences,
    duplicateSections, synthesis, uncited, blocks,
  };
}
