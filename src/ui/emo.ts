// Фирменные 3D-эмодзи 2ГИС (public/emoji/*.webp, вырезаны из присланного листа).
export const emoUrl = (name: string) => `${import.meta.env.BASE_URL}emoji/${name}.webp`;
export const emo = (name: string, cls = "e") => `<img class="${cls}" src="${emoUrl(name)}" alt="" draggable="false">`;
