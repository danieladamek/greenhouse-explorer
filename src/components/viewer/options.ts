/** Viewer options, split out of MolViewer so pages can read and write them without loading the viewer chunk. */
export type StyleName = 'ballstick' | 'stick' | 'spacefill' | 'wireframe';
export type SurfaceMode = 'none' | 'element' | 'charge';

export interface ViewerOptions {
  style: StyleName;
  hydrogens: boolean;
  labels: boolean;
  cip: boolean;
  spin: boolean;
  surface: SurfaceMode;
  surfaceOpacity: number;
}

export const DEFAULT_VIEWER_OPTIONS: ViewerOptions = {
  style: 'ballstick', hydrogens: true, labels: false, cip: false, spin: false, surface: 'none', surfaceOpacity: 0.7,
};

