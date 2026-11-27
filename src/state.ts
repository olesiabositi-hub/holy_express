// Прогресс игрока. Живёт только в браузере (localStorage), на сервер ничего не уходит.
import type { Cell } from "./puzzle/engine";
import { CASES } from "./story/cases";

export type Save = {
  v: 1;
  solved: Record<string, { at: number; ms: number; hints: number }>;
  board: Record<string, (Cell | null)[]>;
  marks: Record<string, Cell[]>;
  notes: Record<string, Record<string, number[]>>; // клетка → фигуры-заметки
  hintAt: Record<string, number>; // до какой подсказки дошёл
  tutorialSeen: boolean;
  ms: Record<string, number>;
  hints: Record<string, number>;
  santa: number;
  introSeen: boolean;
  finaleSeen: boolean;
  cards: Record<string, number>; // открытки из окна: место → когда получена
};

const KEY = "kodfriz-express-v1";

const fresh = (): Save => ({ v: 1, solved: {}, board: {}, marks: {}, notes: {}, hintAt: {}, tutorialSeen: false, ms: {}, hints: {}, santa: 0, introSeen: false, finaleSeen: false, cards: {} });

export function load(): Save {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return fresh();
    const s = JSON.parse(raw);
    return s && s.v === 1 ? { ...fresh(), ...s } : fresh();
  } catch {
    return fresh();
  }
}

export function save(s: Save) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* приватный режим или переполнение — играем без сохранения */
  }
}

// Фото к открыткам храним отдельно: они тяжелее, и если место кончится, прогресс не пострадает.
const PHOTOS = "kodfriz-photos-v1";
export function loadPhotos(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(PHOTOS) || "{}");
  } catch {
    return {};
  }
}
export function savePhoto(name: string, url: string) {
  const p = loadPhotos();
  p[name] = url;
  try {
    localStorage.setItem(PHOTOS, JSON.stringify(p));
  } catch {
    /* переполнение — открытка останется без фото */
  }
}

export function resetAll() {
  try {
    localStorage.removeItem(PHOTOS);
    localStorage.removeItem(KEY);
  } catch {
    /* ничего */
  }
}

const params = new URLSearchParams(location.search);
/** ?preview или #preview открывает все вагоны сразу — для проверки до 21 декабря.
 *  Сборка с VITE_PREVIEW_ALL=1 (витринная ссылка) открывает их всегда. */
export const PREVIEW = params.has("preview") || location.hash === "#preview" || import.meta.env.VITE_PREVIEW_ALL === "1";

export function today(): string {
  const d = params.get("date"); // ?date=2026-12-23 — посмотреть, как игра выглядит в конкретный день
  if (d && /^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
}

export const isOpen = (i: number) => PREVIEW || today() >= CASES[i].date;

export const fmtTime = (ms: number) => {
  const s = Math.round(ms / 1000);
  const m = Math.floor(s / 60);
  return m ? `${m} мин ${String(s % 60).padStart(2, "0")} с` : `${s} с`;
};
