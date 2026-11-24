// Герои — выдуманные архетипы IT-команды. Никаких реальных людей.
import type { Gender } from "../puzzle/engine";

export type Hero = {
  id: string;
  name: string;
  role: string;
  gender: Gender;
  gen: string; // родительный: «севернее Тимура»
  ins: string; // творительный: «с Тимуром»
  emoji: string;
  color: string; // цвет фишки на поле
  trait: string; // одна характерная деталь
};

export const HEROES: Hero[] = [
  { id: "nika", name: "Ника", role: "QA", gender: "f", gen: "Ники", ins: "Никой", emoji: "🔍", color: "#FFB919", trait: "Находит баг даже в снежинке. Носит лупу на брелоке." },
  { id: "timur", name: "Тимур", role: "DevOps", gender: "m", gen: "Тимура", ins: "Тимуром", emoji: "🛠️", color: "#0073FA", trait: "Не спит с 2019 года. Термос размером с сервер." },
  { id: "asya", name: "Ася", role: "Дизайнер", gender: "f", gen: "Аси", ins: "Асей", emoji: "🎨", color: "#F06A2A", trait: "Ноутбук в стикерах. Видит лишние 2 пикселя через стену." },
  { id: "mark", name: "Марк", role: "Тимлид", gender: "m", gen: "Марка", ins: "Марком", emoji: "📅", color: "#82D714", trait: "В календаре нет ни одного свободного слота. Даже сейчас." },
  { id: "eva", name: "Ева", role: "Аналитик", gender: "f", gen: "Евы", ins: "Евой", emoji: "📊", color: "#B57BFF", trait: "На всё есть дашборд. На дашборды тоже." },
  { id: "lev", name: "Лев", role: "Стажёр", gender: "m", gen: "Льва", ins: "Львом", emoji: "🌱", color: "#2FC035", trait: "Всё делает впервые. Особенно смело." },
  { id: "sonya", name: "Соня", role: "Продакт", gender: "f", gen: "Сони", ins: "Соней", emoji: "🗂️", color: "#FF5FA2", trait: "Стикеры на всём, включая проводника." },
  { id: "gleb", name: "Глеб", role: "Бэкенд", gender: "m", gen: "Глеба", ins: "Глебом", emoji: "🖥️", color: "#5AC8FA", trait: "У него локально всё работает. Всегда." },
  { id: "vera", name: "Вера", role: "Мобильная разработка", gender: "f", gen: "Веры", ins: "Верой", emoji: "📱", color: "#FFD60A", trait: "Три телефона, и все разряжены." },
  { id: "kesha", name: "Кеша", role: "ИИ-ассистент", gender: "m", gen: "Кеши", ins: "Кешей", emoji: "🤖", color: "#A3A8AE", trait: "Живёт в планшете. Очень хочет помочь." },
];

export const hero = (id: string) => HEROES.find((h) => h.id === id)!;
