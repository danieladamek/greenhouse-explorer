import { Link } from 'react-router-dom';
import gradesJson from '@/data/grades.json';
import Popover from '@/components/ui/Popover';
import { BASIS_LABEL, type Basis } from '@/lib/basis';
import { DEPTH_LABEL, IDENTITY_LABEL, classMeta, familyColour, getTaxonMeta, type IconShape } from '@/lib/data';
import type { Grade, Population, TestArticle } from '@/types';

export const grades = gradesJson as { rule: string; grades: { grade: Grade; basis: string }[]; example: string };

export const TEST_ARTICLE_LABEL: Record<TestArticle, string> = {
  whole_herb: 'whole herb', named_extract: 'named extract', essential_oil: 'essential oil', isolated_compound: 'isolated compound', multi_herb_formula: 'multi-herb formula',
};
export const POPULATION_LABEL: Record<Population, string> = { human: 'people', animal: 'animals', in_vitro: 'cells / in vitro', traditional: 'traditional use (monograph)' };

/** The grade legend, from scope.yaml — one click from every evidence table and in full on /methods. */
export function GradeLegend({ compact = false }: { compact?: boolean }) {
  return (
    <div className="text-sm">
      <table className="bx-table">
        <tbody>
          {grades.grades.map((g) => (
            <tr key={g.grade}><th scope="row" className="!p-1.5"><span className="bx-grade">{g.grade}</span></th><td className="!p-1.5">{g.basis}</td></tr>
          ))}
        </tbody>
      </table>
      {!compact && <p className="mt-2 text-xs bx-muted">{grades.rule}</p>}
      <p className="mt-2 text-xs"><Link className="underline" to="/methods#grades">The grade table and the test-article rule on Methods →</Link></p>
    </div>
  );
}

/** A grade badge. Always rendered next to its test article (EvidenceTable enforces the pairing). */
export function GradeBadge({ grade }: { grade: Grade }) {
  const g = grades.grades.find((x) => x.grade === grade);
  return (
    <Popover className="bx-grade hover:bg-paper-2 dark:hover:bg-night-2" ariaLabel={`Evidence grade ${grade}: ${g?.basis ?? ''}. Open the grade legend`} content={<div className="max-w-sm"><p className="font-semibold mb-1">Grade {grade}: {g?.basis}</p><GradeLegend compact /></div>} testId={`grade-${grade}`}>
      {grade}
    </Popover>
  );
}

export function TestArticleChip({ article, detail }: { article: TestArticle; detail?: string | null }) {
  return (
    <span className="bx-status" data-testid="test-article" title={detail ?? undefined}>
      <span className="sr-only">Test article: </span>{TEST_ARTICLE_LABEL[article]}
    </span>
  );
}

export function BasisChip({ basis }: { basis: Basis }) {
  if (basis === 'unstated') return <span className="bx-todo" data-basis={basis}>basis not stated in source</span>;
  return <span className="bx-basis" data-basis={basis}>{BASIS_LABEL[basis]}</span>;
}

export function IdentityChip({ status }: { status: string }) {
  const cls = status === 'confirmed' ? 'bx-status' : 'bx-todo';
  return <span className={cls} data-testid="identity-chip">{IDENTITY_LABEL[status] ?? status}</span>;
}

export function DepthChip({ depth }: { depth: string }) {
  return <span className={depth === 'stub' ? 'bx-status border-dashed' : 'bx-status'} data-testid="depth-chip">{DEPTH_LABEL[depth] ?? depth}</span>;
}

export function FamilyChip({ family, link = true }: { family: string; link?: boolean }) {
  const c = familyColour(family);
  const inner = <><span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: c }} aria-hidden="true" />{family}</>;
  const cls = 'bx-chip border font-medium';
  return link
    ? <Link to={`/families/${family.toLowerCase()}`} className={`${cls} hover:underline`} style={{ borderColor: c }}>{inner}</Link>
    : <span className={cls} style={{ borderColor: c }}>{inner}</span>;
}

/** Botanical name in italics (hybrid sign and "sp." kept roman). */
export function TaxonName({ id, name, withCommon = false, link = true }: { id?: string; name?: string; withCommon?: boolean; link?: boolean }) {
  const t = getTaxonMeta(id);
  const n = name ?? t?.accepted_name ?? id ?? '';
  const parts = n.split(/(\s×\s|\ssp\.$|\s×)/);
  const it = <>{parts.map((p, i) => (/×|sp\./.test(p) ? <span key={i}>{p}</span> : <i key={i}>{p}</i>))}</>;
  const label = <>{it}{withCommon && t?.common_names[0] ? <span className="bx-muted"> · {t.common_names[0]}</span> : null}</>;
  if (!link || !id || !t) return <span>{label}</span>;
  return <Link to={`/plants/${id}`} className="underline decoration-dotted hover:decoration-solid">{label}</Link>;
}

export function ClassIcon({ cls, size = 12 }: { cls: string; size?: number }) {
  const m = classMeta(cls);
  return <ShapeIcon shape={m.icon} color={m.color} size={size} />;
}

export function ClassChip({ cls }: { cls: string }) {
  const m = classMeta(cls);
  return <span className="bx-chip border border-[color:var(--bx-line)] font-medium"><ClassIcon cls={cls} />{m.label}</span>;
}

export function ShapeIcon({ shape, color, size = 12 }: { shape: IconShape; color: string; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 10 10" aria-hidden="true" className="inline-block shrink-0"><ShapePath shape={shape} color={color} /></svg>;
}

/** Geometric icon inside a 10×10 box (usable inside another SVG), from Bioactive Explorer's family icons. */
export function ShapePath({ shape, color }: { shape: IconShape; color: string }) {
  switch (shape) {
    case 'square': return <rect x={1} y={1} width={8} height={8} fill={color} />;
    case 'diamond': return <polygon points="5,0 10,5 5,10 0,5" fill={color} />;
    case 'triangle': return <polygon points="5,0.5 10,9.5 0,9.5" fill={color} />;
    case 'triangleDown': return <polygon points="0,0.5 10,0.5 5,9.5" fill={color} />;
    case 'star': return <polygon points="5,0 6.4,3.5 10,3.8 7.3,6.2 8.1,10 5,8 1.9,10 2.7,6.2 0,3.8 3.6,3.5" fill={color} />;
    case 'pentagon': return <polygon points="5,0 10,3.6 8.1,9.5 1.9,9.5 0,3.6" fill={color} />;
    case 'hexagon': return <polygon points="5,0 9.3,2.5 9.3,7.5 5,10 0.7,7.5 0.7,2.5" fill={color} />;
    case 'plus': return <path d="M3.5,1 h3 v2.5 h2.5 v3 h-2.5 v2.5 h-3 v-2.5 h-2.5 v-3 h2.5 z" fill={color} />;
    case 'halfCircle': return <><path d="M5,1 a4,4 0 0 1 0,8 z" fill={color} /><circle cx={5} cy={5} r={4} fill="none" stroke={color} strokeWidth={1} /></>;
    case 'bar': return <rect x={1} y={3} width={8} height={4} rx={1} fill={color} />;
    case 'ring': return <circle cx={5} cy={5} r={3.5} fill="none" stroke={color} strokeWidth={2} />;
    case 'grid': return <><rect x={1} y={1} width={3.5} height={3.5} fill={color} /><rect x={5.5} y={5.5} width={3.5} height={3.5} fill={color} /><rect x={5.5} y={1} width={3.5} height={3.5} fill={color} opacity={0.45} /><rect x={1} y={5.5} width={3.5} height={3.5} fill={color} opacity={0.45} /></>;
    case 'cross': return <path d="M2,2 L8,8 M8,2 L2,8" stroke={color} strokeWidth={2} strokeLinecap="round" />;
    case 'chevron': return <path d="M1,3 L5,7 L9,3" stroke={color} strokeWidth={2} fill="none" strokeLinecap="round" />;
    default: return <circle cx={5} cy={5} r={4} fill={color} />;
  }
}

export function AsOf({ date }: { date: string }) {
  return <span className="bx-asof">Current as of {date}</span>;
}

/** Amber "missing" marker for a null pack field — never filled (APP-SPEC §6). Listed on /methods. */
export function Missing({ what }: { what: string }) {
  return <span className="bx-todo" data-todo="author">TODO(author): {what}</span>;
}
