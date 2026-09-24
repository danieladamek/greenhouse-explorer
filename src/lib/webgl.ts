let cached: boolean | null = null;

/** True when the browser can create a WebGL context (3Dmol needs it). */
export function hasWebGL(): boolean {
  if (cached !== null) return cached;
  try {
    const c = document.createElement('canvas');
    cached = !!(c.getContext('webgl2') || c.getContext('webgl') || c.getContext('experimental-webgl'));
  } catch {
    cached = false;
  }
  return cached;
}
