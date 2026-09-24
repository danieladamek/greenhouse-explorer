import { useEffect, useRef, useState } from 'react';
import { useTheme } from '@/lib/theme';

/**
 * 2D structure drawn from the pack's own `identity.smiles` with smiles-drawer, in the browser.
 * Nothing is fetched from an external structure service (KICKOFF §2): every depiction in this app is a
 * rendering of a SMILES string that was cross-checked and RDKit-verified when the pack was built.
 * The library is imported lazily so only the pages that draw structures pay for it.
 */

type Tree = unknown;
interface SvgDrawerLike { draw: (tree: Tree, target: SVGSVGElement, theme: string) => void }
interface SmilesDrawerNS {
  SvgDrawer: new (options: Record<string, unknown>) => SvgDrawerLike;
  parse: (smiles: string, ok: (tree: Tree) => void, err?: (e: Error) => void) => void;
}

let libPromise: Promise<SmilesDrawerNS> | null = null;
const lib = (): Promise<SmilesDrawerNS> => {
  if (!libPromise) libPromise = import('smiles-drawer').then((m) => (m.default ?? m) as unknown as SmilesDrawerNS);
  return libPromise;
};

interface Props { smiles: string; name: string; width?: number; height?: number; className?: string; testId?: string }

export default function Structure({ smiles, name, width = 360, height = 260, className = '', testId }: Props) {
  const ref = useRef<SVGSVGElement>(null);
  const { theme } = useTheme();
  const [state, setState] = useState<'loading' | 'drawn' | 'error'>('loading');

  useEffect(() => {
    let live = true;
    setState('loading');
    lib().then((SmilesDrawer) => {
      if (!live || !ref.current) return;
      const svg = ref.current;
      svg.innerHTML = ''; // redraws (theme change, navigation) replace rather than stack
      const drawer = new SmilesDrawer.SvgDrawer({ width, height, padding: 12, compactDrawing: false, terminalCarbons: true, explicitHydrogens: false });
      SmilesDrawer.parse(
        smiles,
        (tree) => {
          if (!live || !ref.current) return;
          try { drawer.draw(tree, svg, theme === 'dark' ? 'dark' : 'light'); setState('drawn'); }
          catch { setState('error'); }
        },
        () => { if (live) setState('error'); },
      );
    }).catch(() => { if (live) setState('error'); });
    return () => { live = false; };
  }, [smiles, theme, width, height]);

  return (
    <div className={`bx-structure relative ${className}`} data-testid={testId} data-structure-state={state}>
      <svg
        ref={ref}
        viewBox={`0 0 ${width} ${height}`}
        width="100%"
        style={{ height: 'auto', maxWidth: '100%' }}
        role="img"
        aria-label={`Two-dimensional chemical structure of ${name}, drawn from its SMILES string`}
        data-smiles={smiles}
      />
      {state === 'loading' && <p className="absolute inset-0 grid place-items-center text-sm bx-muted" role="status">Drawing structure…</p>}
      {state === 'error' && (
        <p className="absolute inset-0 grid place-items-center p-2 text-center text-sm">
          <span className="bx-todo">structure could not be drawn from the recorded SMILES</span>
        </p>
      )}
    </div>
  );
}
