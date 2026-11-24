// Герои — выдуманные архетипы IT-команды. Никаких реальных людей.
import type { Gender } from "../puzzle/engine";

export type Hero = {
  id: string;
  name: string;
  role: string;
  gender: Gender;
  emoji: string;
  color: string; // цвет фишки на поле
  trait: string; // одна характерная деталь
};

export const HEROES: Hero[] = [
  { id: "nika", name: "Ника", role: "QA", gender: "f", emoji: "🔍", color: "#FFB919", trait: "Находит баг даже в снежинке. Носит лупу на брелоке." },
  { id: "timur", name: "Тимур", role: "DevOps", gender: "m", emoji: "🛠️", color: "#0073FA", trait: "Не спит с 2019 года. Термос размером с сервер." },
  { id: "asya", name: "Ася", role: "Дизайнер", gender: "f", emoji: "🎨", color: "#F06A2A", trait: "Ноутбук в стикерах. Видит лишние 2 пикселя через стену." },
  { id: "mark", name: "Марк", role: "Тимлид", gender: "m", emoji: "📅", color: "#82D714", trait: "В календаре нет ни одного свободного слота. Даже сейчас." },
  { id: "eva", name: "Ева", role: "Аналитик", gender: "f", emoji: "📊", color: "#B57BFF", trait: "На всё есть дашборд. На дашборды тоже." },
  { id: "lev", name: "Лев", role: "Стажёр", gender: "m", emoji: "🌱", color: "#2FC035", trait: "Всё делает впервые. Особенно смело." },
  { id: "sonya", name: "Соня", role: "Продакт", gender: "f", emoji: "🗂️", color: "#FF5FA2", trait: "Стикеры на всём, включая проводника." },
  { id: "gleb", name: "Глеб", role: "Бэкенд", gender: "m", emoji: "🖥️", color: "#5AC8FA", trait: "У него локально всё работает. Всегда." },
  { id: "vera", name: "Вера", role: "Мобильная разработка", gender: "f", emoji: "📱", color: "#FFD60A", trait: "Три телефона, и все разряжены." },
  { id: "kesha", name: "Кеша", role: "ИИ-ассистент", gender: "m", emoji: "🤖", color: "#A3A8AE", trait: "Живёт в планшете. Очень хочет помочь." },
];

export const hero = (id: string) => HEROES.find((h) => h.id === id)!;
