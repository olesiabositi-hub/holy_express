// Интерфейс поверх мира: шапка, плашки вагонов, лента вагонов, мини-карта, модалки.
import { CASES } from "../story/cases";
import { fmtTime, isOpen, PREVIEW, resetAll, save, type Save } from "../state";
import { openCase } from "./casePanel";

type WorldApi = {
  screenOf: (i: number) => { x: number; y: number; visible: boolean };
  setLocked: (i: number, locked: boolean) => void;
  focus: (i: number, onArrive: () => void) => void;
  unfocus: () => void;
  finale: (onArrive: () => void) => void;
  leaveFinale: () => void;
  readonly mode: string;
};

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls = "", html = "") => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html) e.innerHTML = html;
  return e;
};

const STATIONS = [
  { name: "Петербург", x: 34, y: 182 },
  { name: "Сосново", x: 66, y: 146 },
  { name: "Приозерск", x: 92, y: 108 },
  { name: "Лахденпохья", x: 128, y: 66 },
  { name: "Сортавала", x: 170, y: 40 },
  { name: "Рускеала", x: 204, y: 20 },
];

export function createHub(root: HTMLElement, world: WorldApi, S: Save) {
  const solvedCount = () => Object.keys(S.solved).length;
  const currentIndex = () => {
    let i = 0;
    CASES.forEach((_, k) => isOpen(k) && (i = k));
    return i;
  };

  // ---------- Шапка ----------
  const top = el("header", "top");
  top.innerHTML = `<div class="brand"><div class="brand-flake">❄️</div><div><h1>Код-фриз экспресс</h1><p>Последний релизный поезд года · Петербург → Рускеала · 21–25 декабря</p></div></div>
    <div class="spacer"></div>${PREVIEW ? `<span class="preview-badge hide-sm">Предпросмотр: все вагоны открыты</span>` : ""}
    <span class="progress-pill"><span class="hide-sm">Раскрыто </span><b class="pc">0</b><span class="hide-sm"> из 5</span><span class="show-sm">/5</span></span>
    <button class="icon-btn" data-a="notes">🗒️<span class="hide-sm"> Блокнот</span></button>
    <button class="icon-btn" data-a="rules">❔<span class="hide-sm"> Правила</span></button>`;
  root.appendChild(top);
  top.querySelector<HTMLButtonElement>('[data-a="notes"]')!.onclick = () => showNotes();
  top.querySelector<HTMLButtonElement>('[data-a="rules"]')!.onclick = () => showRules();

  // ---------- Плашка над вагоном ----------
  const tag = el("div", "gis-tag hidden", `<div class="bubble"></div><div class="tail"></div>`);
  root.appendChild(tag);
  let tagFor: number | null = null;

  // ---------- Лента вагонов (от хвоста к паровозу) ----------
  const strip = el("nav", "cars");
  strip.setAttribute("aria-label", "Вагоны");
  root.appendChild(strip);

  // ---------- Мини-карта ----------
  const map = el("div", "minimap");
  root.appendChild(map);
  map.onclick = () => map.classList.toggle("big");

  const toast = (t: string) => {
    const d = el("div", "toast", t);
    root.appendChild(d);
    setTimeout(() => d.remove(), 3300);
  };

  let panel: { close: () => void } | null = null;
  const host = {
    root,
    save: S,
    toast,
    close: () => {
      panel = null;
      world.unfocus();
      showChrome(true);
      refresh();
    },
    next: (from: number) => {
      panel = null;
      refresh();
      if (from === CASES.length - 1) {
        startFinale();
        return;
      }
      const nxt = from + 1;
      if (isOpen(nxt) && !S.solved[CASES[nxt].id]) {
        world.unfocus();
        setTimeout(() => enter(nxt), 1900);
      } else {
        world.unfocus();
        showChrome(true);
        if (!isOpen(nxt)) toast(`Следующий вагон откроется ${CASES[nxt].dateLabel.replace(/,.*/, "")}`);
      }
    },
    changed: () => refresh(),
    reopen: (i: number) => {
      panel = openCase(host, i);
    },
  };

  function showChrome(on: boolean) {
    strip.classList.toggle("hidden", !on);
    map.classList.toggle("hidden", !on);
    if (!on) tag.classList.add("hidden");
  }

  function enter(i: number) {
    if (panel) return;
    showChrome(false);
    world.focus(i, () => {
      panel = openCase(host, i);
    });
  }

  function refresh() {
    top.querySelector(".pc")!.textContent = String(solvedCount());
    strip.innerHTML = "";
    const cur = currentIndex();
    CASES.forEach((c, i) => {
      const open = isOpen(i);
      const solved = !!S.solved[c.id];
      world.setLocked(i, !open);
      const b = el("button", `car-btn ${solved ? "solved" : ""} ${!open ? "locked" : ""} ${open && !solved && i === cur ? "today" : ""}`);
      b.innerHTML = `<span class="k">Вагон ${c.num} · ${c.dateLabel}</span><span class="t">${c.wagon}</span><span class="s">${solved ? "✓ Раскрыто" : open ? (i === cur ? "● Новое дело" : "Можно расследовать") : "🔒 Закрыт до " + c.dateLabel.replace(/,.*/, "")}</span>`;
      b.onclick = () => enter(i);
      b.onmouseenter = () => (tagFor = i);
      b.onmouseleave = () => (tagFor = null);
      strip.appendChild(b);
    });
    drawMap();
  }

  function drawMap() {
    const solved = CASES.map((c) => !!S.solved[c.id]);
    const cur = currentIndex();
    const seg = (i: number) => `M${STATIONS[i].x},${STATIONS[i].y} L${STATIONS[i + 1].x},${STATIONS[i + 1].y}`;
    map.innerHTML = `<div class="cap"><span>Маршрут</span><b>${STATIONS[cur].name} → ${STATIONS[cur + 1].name}</b></div>
    <svg viewBox="0 0 270 200" role="img" aria-label="Карта маршрута поезда">
      <rect width="270" height="200" fill="#1F2329"/>
      <path d="M0,200 L0,176 C20,170 30,188 22,200 Z" fill="#26405f"/>
      <path d="M118,190 C108,150 120,120 150,98 C176,80 196,64 222,70 C240,74 242,120 236,150 C228,186 170,200 118,190 Z" fill="#26405f"/>
      <text x="178" y="142" fill="#6f88ad" font-size="11" font-weight="700" font-family="Golos Text, sans-serif">Ладога</text>
      <g fill="#23302a">${[[20, 40, 30], [60, 70, 24], [40, 120, 18], [150, 150, 10], [100, 30, 22], [200, 110, 0]].map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}"/>`).join("")}</g>
      <path d="M0,150 C40,140 60,160 110,150" stroke="#7A74AE" stroke-width="2" fill="none" opacity=".5"/>
      <path d="M20,60 C60,80 80,40 120,30" stroke="#7A74AE" stroke-width="2" fill="none" opacity=".5"/>
      ${CASES.map((_, i) => `<path d="${seg(i)}" stroke="${solved[i] ? "#19AA1E" : "#4a4f58"}" stroke-width="${solved[i] ? 5 : 4}" stroke-linecap="round" ${solved[i] ? "" : 'stroke-dasharray="2 6"'}/>`).join("")}
      ${STATIONS.map((s, i) => `<g><circle cx="${s.x}" cy="${s.y}" r="5" fill="#fff"/><circle cx="${s.x}" cy="${s.y}" r="2.4" fill="${i <= cur ? "#19AA1E" : "#6e6e6e"}"/>
        <text x="${s.x + 8}" y="${s.y + 4}" fill="#F2F2F0" font-size="10" font-weight="600" font-family="Golos Text, sans-serif">${s.name}</text></g>`).join("")}
      <circle r="6.5" fill="#19AA1E" stroke="#fff" stroke-width="2.5">
        <animateMotion dur="14s" repeatCount="indefinite" path="${seg(cur)}"/>
      </circle>
    </svg>`;
  }

  // ---------- Плашка над вагоном следует за камерой ----------
  const tick = () => {
    const show = tagFor !== null && !panel && world.mode === "hub";
    tag.classList.toggle("hidden", !show);
    if (show) {
      const i = tagFor!;
      const c = CASES[i];
      const p = world.screenOf(i);
      tag.style.left = p.x + "px";
      tag.style.top = p.y + "px";
      const open = isOpen(i);
      tag.querySelector(".bubble")!.innerHTML = `<span class="num ${open ? "" : "lock"}">${open ? "№" + c.num : "🔒"}</span>${c.wagon}<small>${S.solved[c.id] ? "раскрыто" : open ? c.title : c.dateLabel}</small>`;
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);

  // ---------- Модалки ----------
  function modal(html: string, onClose?: () => void, side = false) {
    const bg = el("div", `modal-bg ${side ? "side" : ""}`);
    const m = el("div", "modal", html);
    bg.appendChild(m);
    root.appendChild(bg);
    const close = () => {
      bg.remove();
      onClose?.();
    };
    bg.addEventListener("click", (e) => e.target === bg && close());
    m.querySelectorAll<HTMLElement>("[data-close]").forEach((b) => (b.onclick = close));
    return { m, close };
  }

  function showIntro() {
    modal(
      `<div class="hero-banner"><div class="k">Детектив в пяти вагонах</div><h2>Код-фриз экспресс</h2></div>
      <p class="lead">31 декабря, ночь. Последний релизный поезд года идёт из Петербурга в Рускеалу. Ровно в 00:00 он должен доставить релиз в прод.</p>
      <p class="lead">Но в каждом вагоне что-то случается. Каждый рабочий день с 21 по 25 декабря открывается новое дело. Расставь подозреваемых по уликам и найди виновного.</p>
      <div class="row"><button class="btn primary" data-close>Поехали</button><button class="btn" data-rules>Как играть</button></div>`,
      () => {
        S.introSeen = true;
        save(S);
      },
    ).m.querySelector<HTMLButtonElement>("[data-rules]")!.onclick = (e) => {
      (e.target as HTMLElement).closest(".modal-bg")!.remove();
      S.introSeen = true;
      save(S);
      showRules();
    };
  }

  function showRules() {
    modal(`<h2>Как раскрыть дело</h2>
      <div class="rule"><span class="n">1</span><span>Каждое дело — план вагона, разбитый на клетки и цветные зоны: купе, проход, кухня.</span></div>
      <div class="rule"><span class="n">2</span><span>Расставь всех подозреваемых и улику. <b>В каждой строке и в каждом столбце — ровно один.</b></span></div>
      <div class="rule"><span class="n">3</span><span>На занятые клетки (со штриховкой: стол, стеллаж, плита) встать нельзя. На стул или полку — можно.</span></div>
      <div class="rule"><span class="n">4</span><span>У каждого есть показание: где он был. «У окна» — значит в верхнем или нижнем ряду, вдоль окон. «Рядом с» — в соседней клетке слева, справа, сверху или снизу.</span></div>
      <div class="rule"><span class="n">5</span><span><b>Виновный — единственный подозреваемый в одной зоне с уликой.</b></span></div>
      <p class="lead" style="font-size:15px">У каждого дела ровно одно решение, и его можно найти логикой, без угадывания. Застрял — бери подсказку. Прогресс сохраняется в этом браузере.</p>
      <div class="row"><button class="btn primary" data-close>Понятно</button></div>`);
  }

  function showNotes() {
    const items = CASES.map((c) => {
      const s = S.solved[c.id];
      return `<div class="note ${s ? "" : "locked"}"><span class="ic">${s ? "🗒️" : "❔"}</span><div><small>Вагон ${c.num} · ${c.wagon}</small>${s ? `<b>${c.evidence}</b> · ${fmtTime(s.ms)}` : isOpen(c.num - 1) ? "Дело ещё не раскрыто" : "Откроется " + c.dateLabel.replace(/,.*/, "")}</div></div>`;
    }).join("");
    const { m } = modal(`<h2>Блокнот детектива</h2><p class="lead" style="font-size:15px">Вещдоки из раскрытых дел. Кажется, они связаны.</p>${items}
      <p style="color:var(--muted);font-size:13px">Поймано Сант: ${S.santa}</p>
      <div class="row"><button class="btn" data-close>Закрыть</button>${S.solved[CASES[4].id] ? `<button class="btn primary" data-finale>Финал ещё раз</button>` : ""}<button class="btn" data-reset style="margin-left:auto;color:var(--muted)">Сбросить прогресс</button></div>`);
    const f = m.querySelector<HTMLButtonElement>("[data-finale]");
    if (f) f.onclick = () => {
      (m.parentElement as HTMLElement).remove();
      startFinale();
    };
    const rb = m.querySelector<HTMLButtonElement>("[data-reset]")!;
    rb.onclick = () => {
      // confirm() в некоторых встраиваниях запрещён — подтверждаем вторым нажатием
      if (rb.dataset.armed) {
        resetAll();
        location.reload();
      } else {
        rb.dataset.armed = "1";
        rb.textContent = "Точно стереть? Нажми ещё раз";
        rb.style.color = "var(--red)";
      }
    };
  }

  function startFinale() {
    showChrome(false);
    world.finale(() => {
      const total = Object.values(S.solved).reduce((a, s) => a + s.ms, 0);
      const hints = Object.values(S.solved).reduce((a, s) => a + s.hints, 0);
      S.finaleSeen = true;
      save(S);
      modal(
        `<div class="hero-banner"><div class="k">00:00 · 1 января 2027</div><h2>Релиз доставлен</h2></div>
        <p class="lead">Поезд остановился посреди Рускеалы. Весь состав вышел на снег, а прямо на карте выросла ёлка. Это и была секретная фича, которую готовили всю неделю.</p>
        <div class="tiles"><div class="tile g"><div class="v">${fmtTime(total)}</div><div class="l">на все расследования</div></div>
          <div class="tile y"><div class="v">${hints}</div><div class="l">подсказок</div></div>
          <div class="tile"><div class="v">${S.santa}</div><div class="l">раз пойман Санта</div></div></div>
        <div class="gift"><b>Твой подарок</b><div>Здесь появится твой личный подарочный код.</div><div class="code">СКОРО</div></div>
        <div class="row"><button class="btn primary" data-close>Полюбоваться ёлкой</button></div>`,
        () => {
          setTimeout(() => {
            world.leaveFinale();
            showChrome(true);
          }, 12000);
        },
        true,
      );
    });
  }

  const SANTA_LINES = ["Санта одобрил ваш деплой 🎅", "Санта: «LGTM» 🎅", "Санта ушёл в код-фриз до 9 января 🎅", "Санта поставил вашей задаче приоритет «праздник» 🎅", "Санта закрыл все ваши тикеты. Шутка 🎅", "Санта проверил: локально у него тоже всё работает 🎅"];
  function santaCaught() {
    S.santa++;
    save(S);
    toast(S.santa === 5 ? "Ачивка: ловец Санты! 🦌 Пять из пяти" : `${SANTA_LINES[S.santa % SANTA_LINES.length]} · поймано: ${S.santa}`);
  }

  refresh();
  return {
    showIntroIfNeeded: () => !S.introSeen && showIntro(),
    hover: (i: number | null) => (tagFor = i),
    select: (i: number) => enter(i),
    santaCaught,
  };
}
