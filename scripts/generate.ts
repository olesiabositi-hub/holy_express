// Подбирает расстановку и улики для каждого дела и пишет src/story/solutions.ts.
// Требования к делу:
//  — решение ровно одно;
//  — оно находится «обеденной» логикой без перебора (logicSolve);
//  — виновный по правилу зоны совпадает с сюжетным;
//  — улики как можно «слабее» (интереснее), но решаемость сохраняется.
// Запуск: bun scripts/generate.ts
import { writeFileSync } from "node:fs";
import { CASES, type CaseDef } from "../src/story/cases";
import { hero } from "../src/story/heroes";
import {
  allSolutions, candidates, culpritOf, holds, isBlocked, logicSolve, neighbours, rc, zoneAt, kindAt,
  type Cell, type Clue, type Figure, type Layout, type Pred,
} from "../src/puzzle/engine";

let seed = 20261221;
const rand = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
const shuffle = <T,>(a: T[]) => {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

export function figuresOf(c: CaseDef): Figure[] {
  return [
    ...c.suspects.map((id) => ({ id, name: hero(id).name, gender: hero(id).gender })),
    { id: "item", name: c.item.name, gender: c.item.gender, item: true },
  ];
}

function options(l: Layout, cell: Cell, c: CaseDef, isItem: boolean): Clue[] {
  const single: Pred[] = [];
  const k = kindAt(l, cell);
  if (k?.on && c.allow.includes("on")) single.push({ t: "on", k: k.ch });
  const adjKinds = new Set(neighbours(l.n, cell).map((x) => kindAt(l, x)?.ch).filter(Boolean) as string[]);
  if (c.allow.includes("adj")) for (const ch of adjKinds) single.push({ t: "adj", k: ch });
  if (c.allow.includes("notAdj"))
    for (const kk of l.kinds) if (!adjKinds.has(kk.ch) && kk.blocked) single.push({ t: "notAdj", k: kk.ch });
  if (c.allow.includes("zone")) single.push({ t: "zone", z: zoneAt(l, cell) });
  if (c.allow.includes("notZone"))
    for (const z of l.zones) if (z.ch !== zoneAt(l, cell)) single.push({ t: "notZone", z: z.ch });
  const [r] = rc(l.n, cell);
  const win = l.windows && (r === 0 || r === l.n - 1);
  if (l.windows && win && c.allow.includes("window")) single.push({ t: "window" });
  if (l.windows && !win && c.allow.includes("notWindow")) single.push({ t: "notWindow" });

  const out: Clue[] = single.map((p) => [p]);
  if (c.pairs) {
    const pos = single.filter((p) => p.t === "on" || p.t === "adj" || p.t === "window" || p.t === "zone");
    for (let i = 0; i < pos.length; i++)
      for (let j = i + 1; j < pos.length; j++) {
        const a = pos[i], b = pos[j];
        if (a.t === b.t) continue;
        // «на верхней полке под верхней полкой» — абсурд: один предмет дважды не упоминаем
        if ("k" in a && "k" in b && a.k === b.k) continue;
        out.push([a, b]);
      }
  }
  // Улика (предмет) не «сидит» и не «держится»: оставляем ей простые формулировки.
  return isItem ? out.filter((cl) => !cl.some((p) => p.t === "notWindow")) : out;
}

const weight = (l: Layout, cl: Clue) => candidates(l, cl).length;

function tryCase(c: CaseDef) {
  const l = c.layout;
  const n = l.n;
  const figs = figuresOf(c);
  const culpritIdx = c.suspects.indexOf(c.culprit);
  let best: { pos: Cell[]; clues: Clue[]; score: number; rounds: number } | null = null;

  for (let attempt = 0; attempt < 6000; attempt++) {
    // Случайная перестановка: строка r → столбец perm[r]
    const perm = shuffle([...Array(n).keys()]);
    const cells = perm.map((col, r) => r * n + col);
    if (cells.some((x) => isBlocked(l, x))) continue;
    const pos = shuffle(cells.slice());
    if (culpritOf(l, figs, pos) !== culpritIdx) continue;
    // Виновный не должен стоять в зоне улики в одиночку слишком «очевидно»: в зоне улики должно быть ≥3 клетки.
    const opts = figs.map((f, i) => options(l, pos[i], c, !!f.item));
    if (opts.some((o) => o.length === 0)) continue;
    // Начинаем с самых сильных улик, затем ослабляем, пока решаемо.
    const ranked = opts.map((o) => o.slice().sort((a, b) => weight(l, a) - weight(l, b)));
    let pick = ranked.map((o) => o[0]);
    for (let t = 0; t < 60 && !logicSolve(l, pick); t++) pick = ranked.map((o) => o[Math.floor(rand() * Math.min(3, o.length))]);
    if (!logicSolve(l, pick)) continue;
    for (let pass = 0; pass < 6; pass++) {
      for (const f of shuffle([...figs.keys()])) {
        const sorted = opts[f].slice().sort((a, b) => weight(l, b) - weight(l, a));
        for (const cand of sorted) {
          if (weight(l, cand) <= weight(l, pick[f])) break;
          const trial = pick.slice();
          trial[f] = cand;
          if (logicSolve(l, trial)) {
            pick[f] = cand;
            break;
          }
        }
      }
    }
    const solved = logicSolve(l, pick)!;
    const sols = allSolutions(l, pick, 2);
    if (sols.length !== 1) continue;
    const types = new Set(pick.flat().map((p) => p.t)).size;
    const score = pick.reduce((s, cl) => s + Math.log(weight(l, cl)), 0) + types * 0.6 + solved.rounds * 0.3;
    if (!best || score > best.score) best = { pos, clues: pick, score, rounds: solved.rounds };
  }
  if (!best) throw new Error(`Не удалось собрать дело ${c.id}`);
  return best;
}

if (import.meta.main) main();
function main() {
const out: Record<string, { pos: Cell[]; clues: Clue[] }> = {};
for (const c of CASES) {
  const b = tryCase(c);
  out[c.id] = { pos: b.pos, clues: b.clues };
  console.log(c.id, "score", b.score.toFixed(1), "rounds", b.rounds, "cands", b.clues.map((cl) => candidates(c.layout, cl).length).join(","));
  void holds;
}
writeFileSync(
  new URL("../src/story/solutions.ts", import.meta.url),
  `// Сгенерировано scripts/generate.ts — не править руками.\nimport type { Cell, Clue } from "../puzzle/engine";\n\nexport const SOLUTIONS: Record<string, { pos: Cell[]; clues: Clue[] }> = ${JSON.stringify(out, null, 1)};\n`,
);
}
