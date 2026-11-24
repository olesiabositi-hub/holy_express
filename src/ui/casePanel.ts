// Панель одного дела: история, поле мурдоку, улики, обвинение, развязка.
import { clueText, isBlocked, kindAt, logicSolve, rc, satisfies, zoneAt, type Cell, type Figure } from "../puzzle/engine";
import { CASES, type CaseDef } from "../story/cases";
import { SOLUTIONS } from "../story/solutions";
import { hero } from "../story/heroes";
import { fmtTime, isOpen, save, type Save } from "../state";

const ZONE_COLORS = ["#25432f", "#223761", "#4d3c1e", "#47284c", "#1f4749", "#4c2b27", "#3b4123"];

export function figuresOf(c: CaseDef): Figure[] {
  return [
    ...c.suspects.map((id) => ({ id, name: hero(id).name, gender: hero(id).gender })),
    { id: "item", name: c.item.name, gender: c.item.gender, item: true },
  ];
}

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls = "", html = "") => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html) e.innerHTML = html;
  return e;
};

export type PanelHost = {
  root: HTMLElement;
  save: Save;
  close: () => void;
  next: (fromIndex: number) => void;
  reopen: (index: number) => void;
  changed: () => void;
  toast: (t: string) => void;
};

export function openCase(host: PanelHost, index: number) {
  const c = CASES[index];
  const l = c.layout;
  const n = l.n;
  const sol = SOLUTIONS[c.id];
  const figs = figuresOf(c);
  const S = host.save;

  const panel = el("section", "case");
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-label", `${c.wagon}: ${c.title}`);
  const head = el("div", "case-head");
  head.innerHTML = `<div class="meta"><div class="k">Дело №${c.num} · ${c.wagon} · ${c.dateLabel}</div><h2>${isOpen(index) ? c.title : "Вагон пока закрыт"}</h2></div>`;
  const closeBtn = el("button", "close", "✕");
  closeBtn.setAttribute("aria-label", "Выйти из вагона");
  closeBtn.onclick = () => finish();
  head.appendChild(closeBtn);
  const body = el("div", "case-body");
  panel.append(head, body);
  host.root.appendChild(panel);

  let started = performance.now();
  const finish = () => {
    if (!S.solved[c.id] && isOpen(index)) S.ms[c.id] = (S.ms[c.id] || 0) + (performance.now() - started);
    save(S);
    panel.remove();
    host.close();
  };

  if (!isOpen(index)) {
    body.innerHTML = `<div class="story"><p>${c.segment}</p><p>Это дело откроется ${c.dateLabel.replace(/,.*/, "")}. Проводник обещал, что внутри будет интересно.</p></div>
      <div class="rules-mini">Новое дело появляется каждый рабочий день с 21 по 25 декабря. Пропущенные дела не сгорают.</div>`;
    return { close: finish };
  }

  if (S.solved[c.id]) {
    renderReveal();
    return { close: finish };
  }

  // ---------- Игра ----------
  const board: (Cell | null)[] = S.board[c.id]?.length === figs.length ? S.board[c.id].slice() : figs.map(() => null);
  const marks = new Set<Cell>(S.marks[c.id] || []);
  let selected: number | null = null;
  let culpritAsked = false;

  const story = el("div", "story", c.intro.map((p) => `<p>${p}</p>`).join(""));
  const play = el("div", "play");
  body.append(story, play);

  const left = el("div", "board-wrap");
  const right = el("div", "figs");
  play.append(left, right);

  const cellSize = () => {
    const avail = Math.min(window.innerWidth - 60, window.innerWidth > 860 ? 420 : 560);
    return Math.max(38, Math.min(66, Math.floor((avail - 20) / n)));
  };

  const boardEl = el("div", "board");
  const winTop = el("div", "win");
  const grid = el("div", "grid");
  const winBot = el("div", "win");
  if (l.windows) boardEl.append(winTop);
  boardEl.append(grid);
  if (l.windows) boardEl.append(winBot);
  grid.style.gridTemplateColumns = `repeat(${n}, var(--cell))`;

  const zoneIdx = (ch: string) => l.zones.findIndex((z) => z.ch === ch);
  const cells: HTMLElement[] = [];
  for (let i = 0; i < n * n; i++) {
    const [r, col] = rc(n, i);
    const d = el("div", "cell");
    d.dataset.i = String(i);
    const z = zoneAt(l, i);
    d.style.background = ZONE_COLORS[zoneIdx(z) % ZONE_COLORS.length];
    const thick = "2.5px solid rgba(255,255,255,.62)";
    const thin = "1px solid rgba(255,255,255,.07)";
    d.style.borderTop = r > 0 && l.regions[r - 1][col] !== z ? thick : r > 0 ? thin : "0";
    d.style.borderLeft = col > 0 && l.regions[r][col - 1] !== z ? thick : col > 0 ? thin : "0";
    const k = kindAt(l, i);
    if (k) {
      d.innerHTML = `<span class="obj" title="${k.name}">${k.icon}</span>`;
      d.title = k.name + (k.blocked ? " — сюда встать нельзя" : "");
    }
    if (isBlocked(l, i)) d.classList.add("blocked");
    grid.appendChild(d);
    cells.push(d);
  }

  const legend = el("div", "legend");
  legend.innerHTML =
    l.zones.map((z, i) => `<span class="chip"><i style="background:${ZONE_COLORS[i % ZONE_COLORS.length]}"></i>${z.name}</span>`).join("") +
    l.kinds.map((k) => `<span class="chip ${k.blocked ? "blocked" : ""}">${k.icon} ${k.name}${k.blocked ? " · занято" : ""}</span>`).join("") +
    (l.windows ? `<span class="chip"><i style="background:#7fb4ff"></i>Окна сверху и снизу</span>` : "");

  const tools = el("div", "tools");
  const hintBtn = el("button", "btn", "💡 Подсказка");
  const resetBtn = el("button", "btn", "↺ Заново");
  tools.append(hintBtn, resetBtn);
  left.append(boardEl, legend, tools);

  const rules = el(
    "div",
    "rules-mini",
    `<b>Как играть.</b> Выбери героя справа и нажми на клетку. В каждой строке и в каждом столбце ровно один персонаж. На занятые клетки (штриховка) встать нельзя. Клик по пустой клетке без выбранного героя ставит крестик-заметку.<br><b>Виновный</b> — единственный подозреваемый в одной зоне с уликой.`,
  );
  const hintLine = el("p", "hint", "");
  right.append(hintLine);
  const figEls: HTMLElement[] = figs.map((f, fi) => {
    const b = el("button", "fig");
    const h = f.item ? null : hero(f.id);
    b.innerHTML = `<span class="av ${f.item ? "item" : ""}" style="${h ? `background:${h.color}` : ""}">${f.item ? c.item.icon : h!.emoji}</span>
      <span><span class="nm">${f.item ? "Улика" : `${h!.name} <span>· ${h!.role}</span>`}</span><div class="cl">${clueText(l, f, sol.clues[fi])}</div><span class="st"></span></span>`;
    b.title = h ? h.trait : "Где нашли улику";
    b.onclick = () => {
      selected = selected === fi ? null : fi;
      draw();
      // на телефоне поле выше списка — подкручиваем к нему
      if (selected !== null && window.innerWidth <= 860) boardEl.scrollIntoView({ behavior: "smooth", block: "center" });
    };
    attachDrag(b.querySelector(".av") as HTMLElement, fi);
    right.appendChild(b);
    return b;
  });
  right.append(rules);
  const verdictBox = el("div", "");
  body.append(verdictBox);

  const persist = () => {
    S.board[c.id] = board.slice();
    S.marks[c.id] = [...marks];
    save(S);
  };

  function place(fi: number, cell: Cell) {
    if (isBlocked(l, cell)) {
      host.toast(`${kindAt(l, cell)!.name}: сюда встать нельзя`);
      return;
    }
    const other = board.indexOf(cell);
    if (other >= 0 && other !== fi) board[other] = null;
    board[fi] = cell;
    marks.delete(cell);
    selected = null;
    persist();
    draw();
  }

  grid.addEventListener("click", (e) => {
    const t = (e.target as HTMLElement).closest(".cell") as HTMLElement | null;
    if (!t) return;
    const i = Number(t.dataset.i);
    const who = board.indexOf(i);
    if (who >= 0) {
      if (selected === who) {
        board[who] = null;
        selected = null;
        persist();
      } else selected = who;
      draw();
      return;
    }
    if (selected !== null) return place(selected, i);
    if (isBlocked(l, i)) return;
    if (marks.has(i)) marks.delete(i);
    else marks.add(i);
    persist();
    draw();
  });
  grid.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    const t = (e.target as HTMLElement).closest(".cell") as HTMLElement | null;
    if (!t) return;
    const i = Number(t.dataset.i);
    if (board.includes(i) || isBlocked(l, i)) return;
    if (marks.has(i)) marks.delete(i);
    else marks.add(i);
    persist();
    draw();
  });

  // Перетаскивание фишек
  function attachDrag(handle: HTMLElement, fi: number) {
    handle.addEventListener("pointerdown", (e) => {
      const sx = e.clientX, sy = e.clientY;
      let ghost: HTMLElement | null = null;
      const move = (m: PointerEvent) => {
        if (!ghost && Math.hypot(m.clientX - sx, m.clientY - sy) > 6) {
          ghost = handle.cloneNode(true) as HTMLElement;
          Object.assign(ghost.style, { position: "fixed", zIndex: "50", pointerEvents: "none", width: "48px", height: "48px", borderRadius: figs[fi].item ? "30%" : "50%", display: "grid", placeItems: "center", fontSize: "24px", opacity: ".92" });
          document.body.appendChild(ghost);
        }
        if (ghost) {
          ghost.style.left = m.clientX - 24 + "px";
          ghost.style.top = m.clientY - 24 + "px";
          cells.forEach((d) => d.classList.remove("target"));
          const over = document.elementFromPoint(m.clientX, m.clientY)?.closest(".cell") as HTMLElement | null;
          over?.classList.add("target");
        }
      };
      const up = (u: PointerEvent) => {
        removeEventListener("pointermove", move);
        removeEventListener("pointerup", up);
        cells.forEach((d) => d.classList.remove("target"));
        if (ghost) {
          ghost.remove();
          const over = document.elementFromPoint(u.clientX, u.clientY)?.closest(".cell") as HTMLElement | null;
          if (over && grid.contains(over)) place(fi, Number(over.dataset.i));
          else if (board[fi] !== null) {
            board[fi] = null;
            persist();
            draw();
          }
        }
      };
      addEventListener("pointermove", move);
      addEventListener("pointerup", up);
    });
  }

  hintBtn.onclick = () => {
    const steps = logicSolve(l, sol.clues)?.steps ?? [];
    const step = steps.find((s) => board[s.figure] !== sol.pos[s.figure]) ?? figs.map((_, fi) => ({ figure: fi, cell: sol.pos[fi], why: "only" as const })).find((s) => board[s.figure] !== s.cell);
    if (!step) return;
    S.hints[c.id] = (S.hints[c.id] || 0) + 1;
    const why = step.why === "only" ? "больше ей некуда" : step.why === "row" ? "в этой строке больше никто не помещается" : "в этом столбце больше никто не помещается";
    const nm = figs[step.figure].name;
    place(step.figure, step.cell);
    hintLine.textContent = `Подсказка: ${nm} — здесь, ${why}.`;
  };
  resetBtn.onclick = () => {
    board.fill(null);
    marks.clear();
    selected = null;
    culpritAsked = false;
    persist();
    draw();
  };

  const onResize = () => boardEl.style.setProperty("--cell", cellSize() + "px");
  onResize();
  addEventListener("resize", onResize);

  function draw() {
    const rowsUsed = new Map<number, number[]>();
    const colsUsed = new Map<number, number[]>();
    board.forEach((cell, fi) => {
      if (cell === null) return;
      const [r, col] = rc(n, cell);
      rowsUsed.set(r, [...(rowsUsed.get(r) || []), fi]);
      colsUsed.set(col, [...(colsUsed.get(col) || []), fi]);
    });
    const conflict = new Set<number>();
    for (const m of [rowsUsed, colsUsed]) for (const list of m.values()) if (list.length > 1) list.forEach((fi) => conflict.add(fi));

    cells.forEach((d, i) => {
      d.querySelector(".token")?.remove();
      d.querySelector(".x")?.remove();
      d.classList.remove("conflict");
      const fi = board.indexOf(i);
      if (fi >= 0) {
        const f = figs[fi];
        const h = f.item ? null : hero(f.id);
        const tk = el("div", `token ${f.item ? "item" : ""} ${selected === fi ? "sel" : ""}`);
        if (h) tk.style.background = h.color;
        tk.innerHTML = `${f.item ? c.item.icon : h!.emoji}<span class="nm">${f.item ? "улика" : h!.name}</span>`;
        attachDrag(tk, fi);
        d.appendChild(tk);
        if (conflict.has(fi)) d.classList.add("conflict");
      } else if (marks.has(i)) {
        d.appendChild(el("span", "x", "×"));
      }
    });
    let allOk = true;
    figEls.forEach((b, fi) => {
      b.classList.toggle("sel", selected === fi);
      const cell = board[fi];
      const ok = cell !== null && satisfies(l, cell, sol.clues[fi]);
      b.classList.toggle("ok", ok && !conflict.has(fi));
      b.classList.toggle("bad", cell !== null && (!ok || conflict.has(fi)));
      const st = b.querySelector(".st") as HTMLElement;
      st.textContent = cell === null ? "" : !ok ? "Не сходится с уликой" : conflict.has(fi) ? "Делит строку или столбец" : "";
      st.style.color = "#ff8c8f";
      if (!ok || conflict.has(fi)) allOk = false;
    });
    hintLine.textContent ||= selected !== null ? `Выбран: ${figs[selected].name}. Нажми на клетку.` : "Выбери героя и нажми на клетку поля. Фишки можно перетаскивать.";
    if (selected !== null) hintLine.textContent = `Выбран: ${figs[selected].name}. Нажми на клетку.`;

    const complete = allOk && board.every((x) => x !== null);
    if (complete && !culpritAsked) showVerdict();
    if (!complete) {
      verdictBox.innerHTML = "";
      culpritAsked = false;
    }
  }

  function showVerdict() {
    culpritAsked = true;
    const itemZone = l.zones.find((z) => z.ch === zoneAt(l, board[figs.length - 1]!))!;
    verdictBox.innerHTML = `<div class="verdict"><h3>Все на местах. Кто виноват?</h3>
      <p>${c.item.name} — ${itemZone.in}. Виновный — единственный подозреваемый в этой зоне.</p><div class="who"></div><div class="err"></div></div>`;
    const who = verdictBox.querySelector(".who")!;
    const err = verdictBox.querySelector(".err") as HTMLElement;
    c.suspects.forEach((id) => {
      const h = hero(id);
      const b = el("button", "", `${h.emoji} ${h.name}`);
      b.onclick = () => {
        if (id === c.culprit) {
          S.ms[c.id] = (S.ms[c.id] || 0) + (performance.now() - started);
          started = performance.now();
          S.solved[c.id] = { at: Date.now(), ms: S.ms[c.id], hints: S.hints[c.id] || 0 };
          save(S);
          host.changed();
          body.innerHTML = "";
          renderReveal(true);
        } else {
          err.textContent = `${h.name} ${h.gender === "f" ? "была" : "был"} в другой зоне. Посмотри, кто стоит рядом с уликой.`;
        }
      };
      who.appendChild(b);
    });
    verdictBox.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  draw();
  return { close: finish };

  // ---------- Развязка ----------
  function renderReveal(fresh = false) {
    const h = hero(c.culprit);
    const r = S.solved[c.id];
    const last = index === CASES.length - 1;
    const wrap = el("div", "reveal");
    wrap.innerHTML = `
      <div class="hero-line"><span class="av" style="background:${h.color}">${h.emoji}</span>
        <div><div class="k" style="color:var(--muted);font-weight:600;font-size:13px">${fresh ? "Дело раскрыто" : "Раскрытое дело"}</div><h3>${h.name} · ${h.role}</h3></div></div>
      <div class="txt">${c.reveal.map((p) => `<p>${p}</p>`).join("")}</div>
      <div class="tiles">
        <div class="tile g"><div class="v">${fmtTime(r.ms)}</div><div class="l">на расследование</div></div>
        <div class="tile y"><div class="v">${r.hints}</div><div class="l">${r.hints === 1 ? "подсказка" : r.hints >= 2 && r.hints <= 4 ? "подсказки" : "подсказок"}</div></div>
        <div class="tile"><div class="v">${Object.keys(S.solved).length}/5</div><div class="l">вагонов раскрыто</div></div>
      </div>
      <div class="evidence"><span>🗒️ В блокнот детектива: <b>${c.evidence}</b></span></div>`;
    const go = el("button", "btn", last ? "К финалу →" : "Дальше по составу →");
    go.onclick = () => {
      panel.remove();
      host.next(index);
    };
    wrap.querySelector(".evidence")!.appendChild(go);
    const again = el("button", "btn", "↺ Решить заново");
    again.style.justifySelf = "start";
    again.onclick = () => {
      delete S.solved[c.id];
      S.board[c.id] = [];
      S.marks[c.id] = [];
      S.ms[c.id] = 0;
      S.hints[c.id] = 0;
      save(S);
      panel.remove();
      host.reopen(index);
    };
    wrap.appendChild(again);
    body.appendChild(wrap);
    head.querySelector("h2")!.textContent = c.title;
  }
}
