import { describe, expect, it } from "vitest";
import { CASES } from "../story/cases";
import { SOLUTIONS } from "../story/solutions";
import { hero } from "../story/heroes";
import { allSolutions, clueText, culpritOf, logicSolve, satisfies, type Figure } from "./engine";

const figs = (c: (typeof CASES)[number]): Figure[] => [
  ...c.suspects.map((id) => ({ id, name: hero(id).name, gender: hero(id).gender })),
  { id: "item", name: c.item.name, gender: c.item.gender, item: true },
];

describe("пять дел", () => {
  for (const c of CASES) {
    const s = SOLUTIONS[c.id];
    const l = c.layout;
    it(`${c.title}: план корректный`, () => {
      expect(l.regions).toHaveLength(l.n);
      expect(l.objects).toHaveLength(l.n);
      for (const row of [...l.regions, ...l.objects]) expect([...row]).toHaveLength(l.n);
      for (const ch of l.objects.join("")) if (ch !== ".") expect(l.kinds.some((k) => k.ch === ch)).toBe(true);
      for (const ch of l.regions.join("")) expect(l.zones.some((z) => z.ch === ch)).toBe(true);
      expect(figs(c)).toHaveLength(l.n);
    });
    it(`${c.title}: решение одно и сходится с уликами`, () => {
      s.clues.forEach((cl, i) => expect(satisfies(l, s.pos[i], cl)).toBe(true));
      const sols = allSolutions(l, s.clues, 3);
      expect(sols).toHaveLength(1);
      expect(sols[0]).toEqual(s.pos);
    });
    it(`${c.title}: решается логикой без перебора`, () => {
      expect(logicSolve(l, s.clues)).not.toBeNull();
    });
    it(`${c.title}: виновный совпадает с сюжетом`, () => {
      const f = figs(c);
      expect(f[culpritOf(l, f, s.pos)].id).toBe(c.culprit);
    });
    it(`${c.title}: улики читаются`, () => {
      figs(c).forEach((f, i) => {
        const t = clueText(l, f, s.clues[i]);
        expect(t).not.toMatch(/undefined/);
        expect(t.endsWith(".")).toBe(true);
      });
    });
  }
});
