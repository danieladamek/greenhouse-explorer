export interface Vec3 { x: number; y: number; z: number }

const sub = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const dot = (a: Vec3, b: Vec3) => a.x * b.x + a.y * b.y + a.z * b.z;
const cross = (a: Vec3, b: Vec3): Vec3 => ({ x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x });
const norm = (a: Vec3) => Math.sqrt(dot(a, a));
const deg = (r: number) => (r * 180) / Math.PI;

export function distance(a: Vec3, b: Vec3): number {
  return norm(sub(a, b));
}

/** Angle a–b–c at vertex b, in degrees. */
export function angle(a: Vec3, b: Vec3, c: Vec3): number {
  const u = sub(a, b);
  const v = sub(c, b);
  const cos = dot(u, v) / (norm(u) * norm(v));
  return deg(Math.acos(Math.max(-1, Math.min(1, cos))));
}

/** Dihedral a–b–c–d in degrees, signed (−180, 180]. */
export function dihedral(a: Vec3, b: Vec3, c: Vec3, d: Vec3): number {
  const b1 = sub(b, a);
  const b2 = sub(c, b);
  const b3 = sub(d, c);
  const n1 = cross(b1, b2);
  const n2 = cross(b2, b3);
  const m1 = cross(n1, { x: b2.x / norm(b2), y: b2.y / norm(b2), z: b2.z / norm(b2) });
  const x = dot(n1, n2);
  const y = dot(m1, n2);
  return deg(Math.atan2(y, x));
}

export const midpoint = (a: Vec3, b: Vec3): Vec3 => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: (a.z + b.z) / 2 });

export interface Measurement { kind: 'distance' | 'angle' | 'dihedral'; value: number; label: string }

export function measure(points: Vec3[]): Measurement | null {
  if (points.length === 2) { const v = distance(points[0], points[1]); return { kind: 'distance', value: v, label: `${v.toFixed(2)} Å` }; }
  if (points.length === 3) { const v = angle(points[0], points[1], points[2]); return { kind: 'angle', value: v, label: `${v.toFixed(1)}°` }; }
  if (points.length === 4) { const v = dihedral(points[0], points[1], points[2], points[3]); return { kind: 'dihedral', value: v, label: `${v.toFixed(1)}°` }; }
  return null;
}
