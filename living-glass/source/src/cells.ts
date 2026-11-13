// Coordinator implementation. Site generation is Qwen 3.8's verified module.
import { generateSites } from './sites.ts';

type Point = [number, number];
export type Cell = { id: number; center: Point; polygon: Point[] };

/** Clip a convex polygon to nx*x + ny*y <= limit. */
function clip(poly: Point[], nx: number, ny: number, limit: number): Point[] {
  const result: Point[] = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    const da = nx * a[0] + ny * a[1] - limit;
    const db = nx * b[0] + ny * b[1] - limit;
    if (da <= 0) result.push(a);
    if ((da <= 0) !== (db <= 0)) {
      const t = da / (da - db);
      result.push([a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])]);
    }
  }
  return result.filter((p, i) => {
    const q = result[(i + result.length - 1) % result.length];
    return Math.hypot(p[0] - q[0], p[1] - q[1]) > 1e-10;
  });
}

/** Deterministic Voronoi tiling of the square, with jittered-grid sites. */
export function generateCells(count: number, seed: number): Cell[] {
  if (!Number.isInteger(count) || count < 0 || count > 200) {
    throw new RangeError('count must be an integer from 0 to 200');
  }
  if (!count) return [];
  const columns = Math.ceil(Math.sqrt(count));
  const rows = Math.ceil(count / columns);
  const sites: Point[] = generateSites(count, seed).map(({ id, x, y }) => {
    const row = Math.floor(id / columns);
    const inRow = Math.min(columns, count - row * columns);
    return [
      -1 + ((id % columns + 0.2 + x * 0.6) / inRow) * 2,
      -1 + ((row + 0.2 + y * 0.6) / rows) * 2,
    ];
  });
  return sites.map((center, id) => {
    let polygon: Point[] = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
    for (let j = 0; j < sites.length && polygon.length; j++) {
      if (j === id) continue;
      const other = sites[j];
      const nx = other[0] - center[0], ny = other[1] - center[1];
      const limit = (other[0] ** 2 + other[1] ** 2 - center[0] ** 2 - center[1] ** 2) / 2;
      polygon = clip(polygon, nx, ny, limit);
    }
    return { id, center, polygon };
  });
}