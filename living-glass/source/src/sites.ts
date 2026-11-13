// Qwen 3.8's verified smoke-test module; coordinator added TypeScript types.
// Seeded site generator reused from a verified local-model experiment.
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function generateSites(count: number, seed: number): { id: number; x: number; y: number }[] {
  const n = Number.isInteger(count) && count >= 0 ? count : 0;
  const s = Number.isInteger(seed) ? seed : 0;
  const rand = mulberry32(s);
  const sites = [];
  for (let i = 0; i < n; i++) {
    sites.push({ id: i, x: rand(), y: rand() });
  }
  return sites;
}