import { describe, expect, it } from 'vitest';
import { angle, dihedral, distance, measure } from '@/components/viewer/measure';

describe('geometry', () => {
  it('computes distances, angles and dihedrals', () => {
    expect(distance({ x: 0, y: 0, z: 0 }, { x: 3, y: 4, z: 0 })).toBeCloseTo(5);
    expect(angle({ x: 1, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, { x: 0, y: 1, z: 0 })).toBeCloseTo(90);
    expect(dihedral({ x: 1, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 1 }, { x: 0, y: 1, z: 1 })).toBeCloseTo(-90, 0);
    expect(dihedral({ x: 1, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 1 }, { x: -1, y: 0, z: 1 })).toBeCloseTo(180, 0);
  });
  it('labels measurements by point count', () => {
    const o = { x: 0, y: 0, z: 0 };
    expect(measure([o])).toBeNull();
    expect(measure([o, { x: 1.5, y: 0, z: 0 }])?.label).toBe('1.50 Å');
    expect(measure([{ x: 1, y: 0, z: 0 }, o, { x: 0, y: 1, z: 0 }])?.label).toBe('90.0°');
    expect(measure([{ x: 1, y: 0, z: 0 }, o, { x: 0, y: 0, z: 1 }, { x: -1, y: 0, z: 1 }])?.kind).toBe('dihedral');
  });
});
