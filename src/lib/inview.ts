import { useEffect, useRef, useState } from 'react';

/**
 * True once the element has come within `margin` of the viewport (and stays true). The 3D viewer mounts only then,
 * so a page whose viewer starts below the fold does not pay for WebGL and 3Dmol before the reader gets there.
 */
export function useInView<T extends Element>(margin = '200px'): [React.RefObject<T>, boolean] {
  const ref = useRef<T>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || seen) return;
    if (typeof IntersectionObserver === 'undefined') { setSeen(true); return; }
    const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { setSeen(true); io.disconnect(); } }, { rootMargin: margin });
    io.observe(el);
    return () => io.disconnect();
  }, [seen, margin]);
  return [ref, seen];
}
