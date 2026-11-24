// Движок мурдоку. Без three.js и DOM: только правила, чтобы всё проверялось тестами.
//
// Правила одного дела:
// 1. Поле N×N, на нём N фигур: подозреваемые и улика.
// 2. В каждой строке и в каждом столбце ровно одна фигура.
// 3. На «занятые» клетки (стеллаж, стол, плита) встать нельзя.
// 4. У каждой фигуры одна улика-показание: где она была.
// 5. Виновный — единственный подозреваемый, оказавшийся в одной зоне с уликой.

export type Posture = "sit" | "stand" | "lie";
export type Gender = "m" | "f";

export type ObjKind = {
  ch: string; // символ в плане
  name: string; // «нижняя полка» — подпись в легенде
  icon: string; // эмодзи на поле
  blocked?: boolean; // встать нельзя
  posture: Posture; // как на ней находятся: сидят, стоят, лежат
  on?: string; // «на нижней полке» — для улики «сидела на нижней полке»
  near: string; // «рядом с розеткой»
};

export type Region = { ch: string; name: string; in: string }; // in: «в серверном углу»

export type Layout = {
  n: number;
  regions: string[]; // N строк по N символов — зоны
  objects: string[]; // N строк по N символов — предметы, «.» пусто
  kinds: ObjKind[];
  zones: Region[];
  windows: boolean; // верхний и нижний ряды у окон
};

export type Pred =
  | { t: "on"; k: string }
  | { t: "adj"; k: string }
  | { t: "notAdj"; k: string }
  | { t: "zone"; z: string }
  | { t: "notZone"; z: string }
  | { t: "window" }
  | { t: "notWindow" };

export type Clue = Pred[]; // все условия сразу («на нижней полке у окна»)

export type Figure = { id: string; name: string; gender: Gender; item?: boolean };

export type Cell = number; // r * n + c

export const rc = (n: number, cell: Cell) => [Math.floor(cell / n), cell % n] as const;

export function kindAt(l: Layout, cell: Cell): ObjKind | undefined {
  const [r, c] = rc(l.n, cell);
  const ch = l.objects[r][c];
  return ch === "." ? undefined : l.kinds.find((k) => k.ch === ch);
}
export const zoneAt = (l: Layout, cell: Cell) => {
  const [r, c] = rc(l.n, cell);
  return l.regions[r][c];
};
export const isBlocked = (l: Layout, cell: Cell) => !!kindAt(l, cell)?.blocked;

export function neighbours(n: number, cell: Cell): Cell[] {
  const [r, c] = rc(n, cell);
  const out: Cell[] = [];
  if (r > 0) out.push(cell - n);
  if (r < n - 1) out.push(cell + n);
  if (c > 0) out.push(cell - 1);
  if (c < n - 1) out.push(cell + 1);
  return out;
}

export function holds(l: Layout, cell: Cell, p: Pred): boolean {
  const [r] = rc(l.n, cell);
  switch (p.t) {
    case "on":
      return kindAt(l, cell)?.ch === p.k;
    case "adj":
      return neighbours(l.n, cell).some((x) => kindAt(l, x)?.ch === p.k);
    case "notAdj":
      return !neighbours(l.n, cell).some((x) => kindAt(l, x)?.ch === p.k);
    case "zone":
      return zoneAt(l, cell) === p.z;
    case "notZone":
      return zoneAt(l, cell) !== p.z;
    case "window":
      return l.windows && (r === 0 || r === l.n - 1);
    case "notWindow":
      return !(l.windows && (r === 0 || r === l.n - 1));
  }
}

export const satisfies = (l: Layout, cell: Cell, clue: Clue) =>
  !isBlocked(l, cell) && clue.every((p) => holds(l, cell, p));

export function candidates(l: Layout, clue: Clue): Cell[] {
  const out: Cell[] = [];
  for (let i = 0; i < l.n * l.n; i++) if (satisfies(l, i, clue)) out.push(i);
  return out;
}

// ---------- Решатели ----------

/** Все решения полным перебором (N ≤ 7, это быстро). */
export function allSolutions(l: Layout, clues: Clue[], limit = 2): Cell[][] {
  const n = l.n;
  const cands = clues.map((c) => candidates(l, c));
  const order = cands.map((_, i) => i).sort((a, b) => cands[a].length - cands[b].length);
  const rows = new Array(n).fill(false);
  const cols = new Array(n).fill(false);
  const pos: Cell[] = new Array(clues.length);
  const out: Cell[][] = [];
  const go = (k: number) => {
    if (out.length >= limit) return;
    if (k === order.length) {
      out.push(pos.slice());
      return;
    }
    const f = order[k];
    for (const cell of cands[f]) {
      const [r, c] = rc(n, cell);
      if (rows[r] || cols[c]) continue;
      rows[r] = cols[c] = true;
      pos[f] = cell;
      go(k + 1);
      rows[r] = cols[c] = false;
    }
  };
  go(0);
  return out;
}

export type Step = { figure: number; cell: Cell; why: "only" | "row" | "col" };

/**
 * Решатель «за обедом»: только приёмы, которые человек делает в уме.
 * — У фигуры осталась одна клетка — ставим.
 * — Все клетки фигуры в одной строке (столбце) — эту строку (столбец) другим нельзя.
 * — В строке (столбце) может стоять только одна фигура — она там.
 * Возвращает порядок, в котором фигуры становятся на места, или null, если без перебора не решить.
 */
export function logicSolve(l: Layout, clues: Clue[]): { steps: Step[]; rounds: number } | null {
  const n = l.n;
  const cand = clues.map((c) => new Set(candidates(l, c)));
  const placed = new Array(clues.length).fill(false);
  const steps: Step[] = [];
  let rounds = 0;
  let changed = true;
  const rowOf = (c: Cell) => Math.floor(c / n);
  const colOf = (c: Cell) => c % n;
  while (changed) {
    changed = false;
    rounds++;
    for (let f = 0; f < cand.length; f++) {
      if (cand[f].size === 0) return null;
      const cells = [...cand[f]];
      const rs = new Set(cells.map(rowOf));
      const cs = new Set(cells.map(colOf));
      if (rs.size === 1 || cs.size === 1) {
        for (let g = 0; g < cand.length; g++) {
          if (g === f) continue;
          for (const x of [...cand[g]]) {
            if ((rs.size === 1 && rs.has(rowOf(x))) || (cs.size === 1 && cs.has(colOf(x)))) {
              cand[g].delete(x);
              changed = true;
            }
          }
        }
      }
      if (cells.length === 1 && !placed[f]) {
        placed[f] = true;
        steps.push({ figure: f, cell: cells[0], why: "only" });
        changed = true;
      }
    }
    // Пара: две фигуры делят одни и те же две строки (столбца) — остальным туда нельзя.
    for (const of of [rowOf, colOf]) {
      for (let a = 0; a < cand.length; a++) {
        const sa = new Set([...cand[a]].map(of));
        if (sa.size !== 2) continue;
        for (let b = a + 1; b < cand.length; b++) {
          const sb = new Set([...cand[b]].map(of));
          if (sb.size > 2 || ![...sb].every((x) => sa.has(x))) continue;
          for (let g = 0; g < cand.length; g++) {
            if (g === a || g === b) continue;
            for (const x of [...cand[g]]) {
              if (sa.has(of(x))) {
                cand[g].delete(x);
                changed = true;
              }
            }
          }
        }
      }
    }
    for (const axis of ["row", "col"] as const) {
      const of = axis === "row" ? rowOf : colOf;
      for (let i = 0; i < n; i++) {
        const who = cand.map((s, f) => ([...s].some((x) => of(x) === i) ? f : -1)).filter((f) => f >= 0);
        if (who.length === 0) return null;
        if (who.length === 1) {
          const f = who[0];
          for (const x of [...cand[f]]) {
            if (of(x) !== i) {
              cand[f].delete(x);
              changed = true;
            }
          }
          if (cand[f].size === 1 && !placed[f]) {
            placed[f] = true;
            steps.push({ figure: f, cell: [...cand[f]][0], why: axis });
          }
        }
      }
    }
  }
  if (cand.some((s) => s.size !== 1)) return null;
  return { steps, rounds };
}

/** Виновный: единственный подозреваемый в зоне улики. -1 если таких нет или их несколько. */
export function culpritOf(l: Layout, figures: Figure[], pos: Cell[]): number {
  const itemIdx = figures.findIndex((f) => f.item);
  const z = zoneAt(l, pos[itemIdx]);
  const inZone = figures.map((f, i) => (!f.item && zoneAt(l, pos[i]) === z ? i : -1)).filter((i) => i >= 0);
  return inZone.length === 1 ? inZone[0] : -1;
}

// ---------- Текст улик ----------

const VERB: Record<Posture, Record<Gender, string>> = {
  sit: { m: "сидел", f: "сидела" },
  stand: { m: "стоял", f: "стояла" },
  lie: { m: "лежал", f: "лежала" },
};
const WAS: Record<Gender, string> = { m: "был", f: "была" };
const NOT_WAS: Record<Gender, string> = { m: "не был", f: "не была" };

function frag(l: Layout, p: Pred, g: Gender): string {
  const kind = (ch: string) => l.kinds.find((k) => k.ch === ch)!;
  const zone = (ch: string) => l.zones.find((z) => z.ch === ch)!;
  switch (p.t) {
    case "on":
      return kind(p.k).on!;
    case "adj":
      return kind(p.k).near;
    case "notAdj":
      return `не ${kind(p.k).near}`;
    case "zone":
      return zone(p.z).in;
    case "notZone":
      return `${NOT_WAS[g]} ${zone(p.z).in}`;
    case "window":
      return "у окна";
    case "notWindow":
      return "не у окна";
  }
}

/** «Ника сидела на нижней полке у окна.» */
export function clueText(l: Layout, fig: Figure, clue: Clue): string {
  const g = fig.gender;
  if (clue.length === 1 && clue[0].t === "notWindow")
    return `${fig.name} ${fig.item ? VERB.lie[g] : g === "f" ? "держалась" : "держался"} подальше от окон.`;
  const onPred = clue.find((p) => p.t === "on") as { t: "on"; k: string } | undefined;
  const neg = clue.find((p) => p.t === "notZone");
  if (neg && clue.length === 1) return `${fig.name} ${frag(l, neg, g)}.`;
  const posture: Posture | null = fig.item ? "lie" : onPred ? l.kinds.find((k) => k.ch === onPred.k)!.posture : null;
  const verb = posture ? VERB[posture][g] : WAS[g];
  const parts = [...clue].sort((a, b) => order(a) - order(b)).map((p) => frag(l, p, g));
  return `${fig.name} ${verb} ${parts.join(" ")}.`;
}
const order = (p: Pred) => ({ on: 0, window: 1, notWindow: 1, adj: 2, notAdj: 3, zone: 4, notZone: 5 })[p.t];
