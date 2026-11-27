// Вход по паролю без сервера и корпоративных систем.
//
// После `bun run build` шифрует код игры и модель Деда Мороза паролем (PBKDF2 + AES-GCM, WebCrypto)
// и ставит вместо index.html экран ввода пароля. Без пароля в браузер попадает только
// зашифрованный набор байтов: ни сюжета, ни улик, ни модели не видно. Пароль один на всех,
// его можно разослать коллегам в рассылке. Браузер запоминает ключ, второй раз вводить не нужно.
//
// Запуск: SITE_PASSWORD='пароль' bun scripts/protect.ts   (в CI — секрет SITE_PASSWORD)
import { existsSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const DIST = "dist";
const ITER = 250_000;
const password = process.env.SITE_PASSWORD?.trim();
if (!password) {
  console.log("SITE_PASSWORD не задан — сайт остаётся открытым.");
  process.exit(0);
}

const enc = new TextEncoder();
const b64 = (u: Uint8Array) => Buffer.from(u).toString("base64");
const salt = crypto.getRandomValues(new Uint8Array(16));
const base = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveKey"]);
const key = await crypto.subtle.deriveKey({ name: "PBKDF2", salt, iterations: ITER, hash: "SHA-256" }, base, { name: "AES-GCM", length: 256 }, false, ["encrypt"]);

/** Файл → iv(12 байт) + шифротекст. */
async function seal(data: Uint8Array<ArrayBuffer>) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, data));
  const out = new Uint8Array(12 + ct.length);
  out.set(iv);
  out.set(ct, 12);
  return out;
}

// 1. Код игры
const html = readFileSync(join(DIST, "index.html"), "utf8");
const m = html.match(/<script type="module" crossorigin src="\.\/(assets\/[^"]+\.js)"><\/script>/);
if (!m) throw new Error("Не нашёл скрипт игры в dist/index.html");
const jsPath = join(DIST, m[1]);
writeFileSync(join(DIST, "assets/app.enc"), await seal(new Uint8Array(readFileSync(jsPath))));
rmSync(jsPath);
for (const f of readdirSync(join(DIST, "assets"))) if (f.endsWith(".js.map")) rmSync(join(DIST, "assets", f));

// 2. Модель Деда Мороза (это 3D-модель заказчицы — не отдаём её без пароля)
const santa = join(DIST, "models/santa.json");
if (existsSync(santa)) {
  writeFileSync(join(DIST, "models/santa.enc"), await seal(new Uint8Array(readFileSync(santa))));
  rmSync(santa);
}

// 3. Экран входа вместо скрипта
const gate = `<style>
  #gate { position: fixed; inset: 0; z-index: 100; display: grid; place-items: center; padding: 16px;
    background: radial-gradient(120% 70% at 15% 0%, rgba(25,170,30,.22), transparent 55%), radial-gradient(90% 60% at 100% 10%, rgba(0,115,250,.25), transparent 60%), #0e0f11;
    font-family: "Golos Text", system-ui, sans-serif; color: #f2f2f0; }
  #gate form { width: min(420px, 100%); background: rgba(24,25,28,.96); border-radius: 24px; padding: 28px; }
  #gate .flake { width: 48px; height: 48px; border-radius: 14px; background: #19aa1e; display: grid; place-items: center; font-size: 26px; }
  #gate h1 { margin: 16px 0 6px; font-size: 28px; letter-spacing: -.01em; }
  #gate p { margin: 0 0 18px; color: #a3a8ae; font-size: 15px; line-height: 1.45; }
  #gate input { width: 100%; box-sizing: border-box; font: inherit; font-size: 17px; padding: 14px 16px; border-radius: 14px; border: 0; background: #2a2c31; color: #f2f2f0; outline: none; }
  #gate input:focus { box-shadow: 0 0 0 2px #19aa1e; }
  #gate button { width: 100%; margin-top: 12px; font: inherit; font-size: 17px; font-weight: 700; padding: 14px; border: 0; border-radius: 14px; background: #19aa1e; color: #fff; cursor: pointer; }
  #gate button:disabled { opacity: .6; cursor: wait; }
  #gate .err { min-height: 20px; margin-top: 10px; color: #ff8c8f; font-size: 14px; font-weight: 600; }
  #gate small { display: block; margin-top: 14px; color: #6e737a; font-size: 12px; }
</style>
<div id="gate" hidden><form autocomplete="on">
  <div class="flake">❄️</div>
  <h1>Код-фриз экспресс</h1>
  <p>Новогодняя игра от команды Техномаркетинга для коллег из RnD. Пароль — в рассылке.</p>
  <input type="password" name="password" placeholder="Пароль" autocomplete="current-password" required>
  <button type="submit">Сесть в поезд</button>
  <div class="err" role="alert"></div>
  <small>Пароль запомнится в этом браузере.</small>
</form></div>
<script type="module">
  const SALT = Uint8Array.from(atob("${b64(salt)}"), (c) => c.charCodeAt(0));
  const ITER = ${ITER};
  const STORE = "kodfriz-key-${b64(salt).slice(0, 8)}";
  const fetchBin = async (u) => { const r = await fetch(u); if (!r.ok) throw new Error(r.status); return new Uint8Array(await r.arrayBuffer()); };
  const open = (key, bin) => crypto.subtle.decrypt({ name: "AES-GCM", iv: bin.slice(0, 12) }, key, bin.slice(12));
  const derive = async (pw) => {
    const base = await crypto.subtle.importKey("raw", new TextEncoder().encode(pw), "PBKDF2", false, ["deriveKey"]);
    return crypto.subtle.deriveKey({ name: "PBKDF2", salt: SALT, iterations: ITER, hash: "SHA-256" }, base, { name: "AES-GCM", length: 256 }, true, ["decrypt"]);
  };
  const appBin = fetchBin("./assets/app.enc");
  async function start(key) {
    const js = await open(key, await appBin); // неверный ключ — здесь будет ошибка
    window.__kfOpen = async (u) => open(key, await fetchBin(u)); // для модели Деда Мороза
    const s = document.createElement("script");
    s.type = "module";
    s.src = URL.createObjectURL(new Blob([js], { type: "text/javascript" }));
    document.head.appendChild(s);
    document.getElementById("gate").remove();
  }
  (async () => {
    try {
      const raw = localStorage.getItem(STORE);
      if (raw) {
        const key = await crypto.subtle.importKey("raw", Uint8Array.from(atob(raw), (c) => c.charCodeAt(0)), "AES-GCM", false, ["decrypt"]);
        return await start(key);
      }
    } catch { try { localStorage.removeItem(STORE); } catch {} }
    const gate = document.getElementById("gate");
    gate.hidden = false;
    const form = gate.querySelector("form"), btn = gate.querySelector("button"), err = gate.querySelector(".err"), input = gate.querySelector("input");
    input.focus();
    form.onsubmit = async (e) => {
      e.preventDefault();
      btn.disabled = true;
      err.textContent = "";
      try {
        const key = await derive(input.value.trim());
        await start(key);
        try { localStorage.setItem(STORE, btoa(String.fromCharCode(...new Uint8Array(await crypto.subtle.exportKey("raw", key))))); } catch {}
      } catch {
        err.textContent = "Пароль не подошёл. Проверь раскладку и попробуй ещё раз.";
        btn.disabled = false;
        input.select();
      }
    };
  })();
</script>`;
const out = html.replace(m[0], "").replace("<body>", `<body>\n${gate}`);
writeFileSync(join(DIST, "index.html"), out);
console.log(`Сайт закрыт паролем: ${m[1]} → assets/app.enc, модель → models/santa.enc`);
