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
  img: string; // фирменный эмодзи 2ГИС — «талисман» героя (public/emoji/*.webp)
  color: string; // цвет фишки на поле
  trait: string; // одна характерная деталь
};

export const HEROES: Hero[] = [
  { id: "nika", name: "Ника", role: "QA", gender: "f", gen: "Ники", ins: "Никой", emoji: "🔍", img: "eyes", color: "#FFB919", trait: "Видит баг даже в снежинке. Глаза — её главный инструмент." },
  { id: "timur", name: "Тимур", role: "DevOps", gender: "m", gen: "Тимура", ins: "Тимуром", emoji: "🛠️", img: "fire", color: "#0073FA", trait: "Тушит пожары в проде с 2019 года. Термос размером с сервер." },
  { id: "asya", name: "Ася", role: "Дизайнер", gender: "f", gen: "Аси", ins: "Асей", emoji: "🎨", img: "tulip", color: "#F06A2A", trait: "Ноутбук в стикерах. Видит лишние 2 пикселя через стену." },
  { id: "mark", name: "Марк", role: "Тимлид", gender: "m", gen: "Марка", ins: "Марком", emoji: "📅", img: "bell", color: "#82D714", trait: "Колокольчик созвонов не умолкает. Свободных слотов нет." },
  { id: "eva", name: "Ева", role: "Аналитик", gender: "f", gen: "Евы", ins: "Евой", emoji: "📊", img: "sputnik", color: "#B57BFF", trait: "На всё есть дашборд. Даже на спутники." },
  { id: "lev", name: "Лев", role: "Стажёр", gender: "m", gen: "Льва", ins: "Львом", emoji: "🌱", img: "go", color: "#2FC035", trait: "Всё делает впервые и сразу на «Го!»." },
  { id: "sonya", name: "Соня", role: "Продакт", gender: "f", gen: "Сони", ins: "Соней", emoji: "🗂️", img: "heart", color: "#FF5FA2", trait: "Любит продукт сильнее, чем дедлайны." },
  { id: "gleb", name: "Глеб", role: "Бэкенд", gender: "m", gen: "Глеба", ins: "Глебом", emoji: "🖥️", img: "ghost", color: "#5AC8FA", trait: "У него локально всё работает. В проде живёт призрак бага." },
  { id: "vera", name: "Вера", role: "Мобильная разработка", gender: "f", gen: "Веры", ins: "Верой", emoji: "📱", img: "arrow", color: "#FFD60A", trait: "Три телефона, на всех открыт навигатор." },
  { id: "kesha", name: "Кеша", role: "ИИ-ассистент", gender: "m", gen: "Кеши", ins: "Кешей", emoji: "🤖", img: "ufo", color: "#A3A8AE", trait: "Живёт в планшете. Немного инопланетный." },
];

export const hero = (id: string) => HEROES.find((h) => h.id === id)!;
