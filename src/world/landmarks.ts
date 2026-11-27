// Реальные места по пути Петербург → Рускеала. Мир по-прежнему бесконечная полоса леса,
// а поверх неё «едет» маршрут: когда поезд доезжает до места, оно появляется рядом с путём.
// Масштаб условный: 1 единица ≈ 2,4 м (вагон 10 единиц ≈ 24 м), высоты чуть преувеличены для читаемости.
import * as THREE from "three";
import { canvasTex, softDot } from "./tex";
import { lights, swag } from "./festive";
import { gisPin } from "./scenery";

export const ROUTE_TOTAL = 6400; // ≈ 10 минут пути при скорости 11

/** Остановки для мини-карты: доля пути и подписи. Совпадают со станциями на мини-карте. */
export const STOPS = [
  { name: "Петербург", at: 0 },
  { name: "Сосново", at: 1250 },
  { name: "Приозерск", at: 2520 },
  { name: "Лахденпохья", at: 3880 },
  { name: "Сортавала", at: 4980 },
  { name: "Рускеала", at: 6120 },
];

const std = (color: THREE.ColorRepresentation, o: THREE.MeshStandardMaterialParameters = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.8, ...o });
const box = (w: number, h: number, d: number, m: THREE.Material, x = 0, y = 0, z = 0) => {
  const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
  b.position.set(x, y, z);
  return b;
};
const SNOW = std("#eef4ff", { roughness: 0.9 });
const WARM = () => new THREE.MeshBasicMaterial({ color: new THREE.Color(2.6, 1.6, 0.75) });

let seed = 3;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

/** Подпись в стиле карты 2ГИС: белая таблетка с зелёной точкой. Всегда повёрнута к камере. */
export function mapLabel(text: string, sub = "") {
  const w = 900, h = sub ? 220 : 160;
  const tex = canvasTex(w, h, (g) => {
    g.font = "800 66px 'Golos Text', system-ui, sans-serif";
    const tw = Math.max(g.measureText(text).width, sub ? (g.font = "600 44px 'Golos Text', system-ui, sans-serif", g.measureText(sub).width) : 0);
    const bw = Math.min(w - 8, tw + 150);
    const x0 = (w - bw) / 2;
    g.fillStyle = "#ffffff";
    g.beginPath();
    g.roundRect(x0, 4, bw, h - 8, 40);
    g.fill();
    g.fillStyle = "#19AA1E";
    g.beginPath();
    g.arc(x0 + 58, sub ? 78 : h / 2, 20, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "#1A1A1A";
    g.font = "800 66px 'Golos Text', system-ui, sans-serif";
    g.textBaseline = "middle";
    g.fillText(text, x0 + 100, sub ? 80 : h / 2 + 2);
    if (sub) {
      g.fillStyle = "#6E6E6E";
      g.font = "600 44px 'Golos Text', system-ui, sans-serif";
      g.fillText(sub, x0 + 100, 160);
    }
  });
  // чуть приглушаем и не пропускаем через тон-маппинг, чтобы подпись не «светилась» в bloom
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, fog: false, toneMapped: false, color: new THREE.Color(0.86, 0.86, 0.86) }));
  sp.scale.set(24, (24 * h) / w, 1);
  sp.renderOrder = 5;
  return sp;
}

/** Табличка с названием станции, как на настоящих платформах. */
function nameBoard(text: string) {
  const g = new THREE.Group();
  const tex = canvasTex(1024, 220, (c) => {
    c.fillStyle = "#1d3f7a";
    c.fillRect(0, 0, 1024, 220);
    c.strokeStyle = "#ffffff";
    c.lineWidth = 12;
    c.strokeRect(14, 14, 996, 192);
    c.fillStyle = "#ffffff";
    c.font = "800 120px 'Golos Text', system-ui, sans-serif";
    c.textAlign = "center";
    c.textBaseline = "middle";
    c.fillText(text.toUpperCase(), 512, 118);
  });
  const board = new THREE.Mesh(new THREE.PlaneGeometry(7, 1.5), new THREE.MeshBasicMaterial({ map: tex, color: new THREE.Color(1.4, 1.4, 1.4) }));
  board.position.y = 3.6;
  g.add(board);
  const back = board.clone();
  back.rotation.y = Math.PI;
  g.add(back);
  for (const x of [-3, 3]) g.add(box(0.12, 3.4, 0.12, std("#2b2f36", { metalness: 0.5 }), x, 1.7, -0.05));
  g.add(box(7.2, 0.12, 0.25, SNOW, 0, 4.42, 0));
  return g;
}

function platform(len: number, z: number) {
  const g = new THREE.Group();
  g.add(box(len, 0.9, 4, std("#8d94a0"), 0, 0.45, z));
  g.add(box(len, 0.08, 4, SNOW, 0, 0.94, z));
  return g;
}

function lampPost(glow: THREE.Texture, h = 4.2) {
  const g = new THREE.Group();
  g.add(box(0.14, h, 0.14, std("#1d2128", { metalness: 0.5 }), 0, h / 2, 0));
  const b = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 2.1, 1.1) }));
  b.position.y = h + 0.1;
  g.add(b);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: new THREE.Color(1, 0.75, 0.45), transparent: true, opacity: 0.6, depthWrite: false, blending: THREE.AdditiveBlending }));
  halo.scale.setScalar(4.2);
  halo.position.y = h + 0.1;
  g.add(halo);
  return g;
}

function pine(k: number) {
  const g = new THREE.Group();
  g.add(box(0.25 * k, 2 * k, 0.25 * k, std("#4a3326"), 0, k, 0));
  const c = new THREE.Mesh(new THREE.ConeGeometry(0.9 * k, 2.6 * k, 7), std("#1f4a37", { flatShading: true }));
  c.position.y = 2.8 * k;
  g.add(c);
  const s = new THREE.Mesh(new THREE.ConeGeometry(0.55 * k, 1.1 * k, 7), SNOW);
  s.position.y = 3.6 * k;
  g.add(s);
  return g;
}

function rock(r: number, col = "#8d8a8f") {
  const g = new THREE.Group();
  const m = new THREE.Mesh(new THREE.DodecahedronGeometry(r, 0), std(col, { flatShading: true, roughness: 1 }));
  m.scale.set(1.3, 0.55, 1);
  m.rotation.y = rnd() * 3;
  g.add(m);
  const cap = new THREE.Mesh(new THREE.DodecahedronGeometry(r * 0.8, 0), SNOW);
  cap.scale.set(1.2, 0.25, 0.9);
  cap.position.y = r * 0.35;
  g.add(cap);
  return g;
}

const ICE = () => std("#9cc4ea", { roughness: 0.1, metalness: 0.3 });

// ---------------------------------------------------------------------------
// Финляндский вокзал: низкий корпус с пилонами и 17 высокими окнами, прямоугольная
// башня с часами и шпилем; на перроне в стеклянном павильоне — паровоз Н2-293.

function finlandStation(glow: THREE.Texture, lightMat: THREE.Material) {
  const g = new THREE.Group();
  const stone = std("#a7a294");
  const warm = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.5, 0.95, 0.5) });
  // перрон и навес
  g.add(platform(90, -4.6));
  g.add(box(90, 0.2, 4.6, std("#5a606b", { metalness: 0.4 }), 0, 4.6, -4.8));
  for (let x = -42; x <= 42; x += 7) g.add(box(0.18, 3.7, 0.18, std("#3a3f48", { metalness: 0.5 }), x, 2.75, -6.4));
  g.add(lights(swag(new THREE.Vector3(-44, 4.45, -2.6), new THREE.Vector3(44, 4.45, -2.6), 0.3, 0.5), lightMat, true));
  // главный корпус
  const body = new THREE.Group();
  body.position.set(6, 0, -26);
  body.add(box(70, 7, 12, stone, 0, 3.5, 0));
  body.add(box(71, 0.6, 13, std("#bdb6a6"), 0, 7.2, 0));
  body.add(box(70.5, 0.25, 12.5, SNOW, 0, 7.55, 0));
  for (let i = 0; i < 17; i++) {
    const x = -32 + i * 4;
    const w = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 5.2), warm);
    w.position.set(x, 3.6, 6.02);
    body.add(w);
    body.add(box(0.9, 6.4, 0.5, std("#c4bfb2"), x + 2, 3.4, 6.1)); // пилоны
  }
  // башня с часами и шпилем
  const tower = new THREE.Group();
  tower.position.set(26, 0, 0);
  tower.add(box(6, 16, 6, stone, 0, 8, 0));
  tower.add(box(6.4, 0.5, 6.4, std("#bdb6a6"), 0, 16.2, 0));
  for (const [dx, dz, ry] of [[0, 3.02, 0], [3.02, 0, Math.PI / 2], [-3.02, 0, -Math.PI / 2], [0, -3.02, Math.PI]] as const) {
    const face = new THREE.Mesh(new THREE.CircleGeometry(1.9, 32), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.25, 1.2, 1.05) }));
    face.position.set(dx, 12.5, dz);
    face.rotation.y = ry;
    tower.add(face);
    const hand = box(0.12, 1.4, 0.05, std("#1a1a1a"), dx * 1.005, 12.9, dz * 1.005);
    hand.rotation.y = ry;
    tower.add(hand);
  }
  const spire = new THREE.Mesh(new THREE.ConeGeometry(0.9, 15, 8), std("#d8b45a", { metalness: 0.9, roughness: 0.25 }));
  spire.position.y = 24;
  tower.add(spire);
  const tip = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: new THREE.Color(2.4, 2, 1.2), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  tip.position.y = 31.6;
  tip.scale.setScalar(3);
  tower.add(tip);
  body.add(tower);
  g.add(body);
  // стеклянный павильон с паровозом Н2-293
  const pav = new THREE.Group();
  pav.position.set(24, 0.94, -8.2);
  const glass = new THREE.Mesh(new THREE.BoxGeometry(9, 4.4, 3.4), new THREE.MeshStandardMaterial({ color: "#bfe0ff", transparent: true, opacity: 0.22, roughness: 0.05, metalness: 0.2, depthWrite: false }));
  glass.position.y = 2.2;
  pav.add(glass);
  pav.add(box(9.3, 0.25, 3.7, std("#3a3f48", { metalness: 0.6 }), 0, 4.5, 0));
  pav.add(box(9.3, 0.15, 3.7, SNOW, 0, 4.7, 0));
  const loco = new THREE.Group();
  const black = std("#15171a", { metalness: 0.5, roughness: 0.4 });
  const boiler = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.75, 4.4, 20).rotateZ(Math.PI / 2), black);
  boiler.position.set(0.6, 1.9, 0);
  loco.add(boiler);
  loco.add(box(2, 2.4, 1.9, black, -2.6, 2.1, 0));
  const chim = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.22, 1, 12), black);
  chim.position.set(2.2, 3, 0);
  loco.add(chim);
  for (const x of [-1.2, 0.2, 1.6]) {
    for (const z of [-0.8, 0.8]) {
      const wh = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.12, 16).rotateX(Math.PI / 2), std("#7a1d1d"));
      wh.position.set(x, 0.6, z);
      loco.add(wh);
    }
  }
  loco.add(box(5.6, 0.25, 1.8, std("#7a1d1d"), 0, 1.05, 0));
  pav.add(loco);
  // без настоящих источников света: появление места не должно перекомпилировать шейдеры
  const bulb = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: new THREE.Color(1.6, 1.3, 0.8), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  bulb.position.set(0, 4.2, 0);
  bulb.scale.setScalar(5);
  pav.add(bulb);
  g.add(pav);
  // фонари на перроне
  for (let x = -38; x <= 38; x += 19) {
    const l = lampPost(glow, 4);
    l.position.set(x, 0.94, -3.2);
    g.add(l);
  }
  // огни города позади вокзала
  const city = new THREE.Group();
  const winPts: THREE.Vector3[] = [];
  for (let i = 0; i < 34; i++) {
    const w = 7 + rnd() * 9, h = 6 + rnd() * 9, d = 6 + rnd() * 6;
    const x = -95 + i * 5.8 + rnd() * 3, z = -58 - rnd() * 34;
    city.add(box(w, h, d, std(["#26304a", "#2f2a3d", "#28394a"][i % 3], { roughness: 1 }), x, h / 2, z));
    city.add(box(w + 0.3, 0.5, d + 0.3, SNOW, x, h + 0.2, z));
    for (let k = 0; k < 14; k++) winPts.push(new THREE.Vector3(x - w / 2 + rnd() * w, 1.2 + Math.floor(rnd() * (h - 2) / 1.6) * 1.6, z + d / 2 + 0.1));
  }
  const cityWin = new THREE.BufferGeometry().setFromPoints(winPts);
  city.add(new THREE.Points(cityWin, new THREE.PointsMaterial({ map: glow, size: 1.2, color: new THREE.Color(2.4, 1.6, 0.8), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })));
  g.add(city);
  const label = mapLabel("Финляндский вокзал", "Санкт-Петербург");
  label.position.set(32, 35, -26);
  g.add(label);
  return g;
}

// ---------------------------------------------------------------------------
// Приозерск: мост через Вуоксу, крепость Корела с Круглой башней на острове, деревянный вокзал.

function vuoksaBridge() {
  const g = new THREE.Group();
  const river = new THREE.Mesh(new THREE.PlaneGeometry(34, 520).rotateX(-Math.PI / 2), ICE());
  river.position.y = 0.06;
  g.add(river);
  // заснеженные берега-откосы
  for (const x of [-18, 18]) {
    const bank = new THREE.Mesh(new THREE.BoxGeometry(3, 1, 520), SNOW);
    bank.position.set(x, 0.3, 0);
    bank.rotation.z = x < 0 ? -0.35 : 0.35;
    g.add(bank);
  }
  // пролёт фермы
  const steel = std("#5d6878", { metalness: 0.7, roughness: 0.35 });
  const L = 36;
  for (const z of [-2.4, 2.4]) {
    g.add(box(L, 0.35, 0.35, steel, 0, 0.8, z));
    g.add(box(L - 6, 0.35, 0.35, steel, 0, 6.2, z));
    for (let i = 0; i <= 8; i++) {
      const x = -L / 2 + 3 + i * ((L - 6) / 8);
      g.add(box(0.25, 5.4, 0.25, steel, x, 3.5, z));
      if (i < 8) {
        const d = box(0.22, 6.9, 0.22, steel, x + (L - 6) / 16, 3.5, z);
        d.rotation.z = i % 2 ? 0.66 : -0.66;
        g.add(d);
      }
    }
    for (const sgn of [-1, 1]) {
      const end = box(0.35, 7.4, 0.35, steel, sgn * (L / 2 - 1.6), 3.5, z);
      end.rotation.z = sgn * 0.42;
      g.add(end);
    }
  }
  for (let i = 0; i <= 8; i++) g.add(box(0.25, 0.25, 4.8, steel, -L / 2 + 3 + i * ((L - 6) / 8), 6.2, 0));
  g.add(box(L - 6, 0.12, 4.9, SNOW, 0, 6.45, 0));
  const label = mapLabel("Река Вуокса");
  label.position.set(0, 12, -14);
  g.add(label);
  return g;
}

function korela(glow: THREE.Texture, lightMat: THREE.Material) {
  const g = new THREE.Group();
  const granite = std("#9a8f8c", { flatShading: true, roughness: 1 });
  const moat = new THREE.Mesh(new THREE.CircleGeometry(1, 40).rotateX(-Math.PI / 2), ICE());
  moat.scale.set(46, 1, 30);
  moat.position.set(0, 0.05, -52);
  g.add(moat);
  const island = new THREE.Mesh(new THREE.CylinderGeometry(1, 1.08, 1.2, 40), SNOW);
  island.scale.set(36, 1, 22);
  island.position.set(0, 0.6, -52);
  g.add(island);
  // стены с бастионами
  const wallPts: [number, number][] = [];
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * Math.PI * 2;
    wallPts.push([Math.cos(a) * 30, -52 + Math.sin(a) * 17]);
  }
  for (let i = 0; i < wallPts.length; i++) {
    const [x0, z0] = wallPts[i], [x1, z1] = wallPts[(i + 1) % wallPts.length];
    const len = Math.hypot(x1 - x0, z1 - z0);
    const w = box(len + 0.6, 3.2, 1.6, granite, (x0 + x1) / 2, 2.6, (z0 + z1) / 2);
    w.rotation.y = -Math.atan2(z1 - z0, x1 - x0);
    g.add(w);
    const cap = box(len + 0.6, 0.25, 1.7, SNOW, (x0 + x1) / 2, 4.3, (z0 + z1) / 2);
    cap.rotation.y = w.rotation.y;
    g.add(cap);
  }
  // Круглая (воротная) башня
  const tower = new THREE.Group();
  tower.position.set(-8, 1.2, -36.5);
  tower.add(new THREE.Mesh(new THREE.CylinderGeometry(5, 5.4, 9, 28), granite).translateY(4.5));
  const roof = new THREE.Mesh(new THREE.ConeGeometry(5.9, 4.2, 28), std("#4a3428", { roughness: 0.9 }));
  roof.position.y = 11.1;
  tower.add(roof);
  const roofSnow = new THREE.Mesh(new THREE.ConeGeometry(4.6, 2.4, 28), SNOW);
  roofSnow.position.y = 11.9;
  tower.add(roofSnow);
  const warm = WARM();
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.3;
    const w = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 1), warm);
    w.position.set(Math.cos(a) * 5.05, 5 + (i % 2) * 2, Math.sin(a) * 5.05);
    w.lookAt(Math.cos(a) * 10, w.position.y, Math.sin(a) * 10);
    tower.add(w);
  }
  const gate = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 3), warm);
  gate.position.set(0, 1.5, 5.25);
  tower.add(gate);
  g.add(tower);
  // Арсенал
  const ars = new THREE.Group();
  ars.position.set(10, 1.2, -56);
  ars.add(box(18, 4, 7, std("#c9b9a2"), 0, 2, 0));
  const rs = new THREE.Shape();
  rs.moveTo(-4, 0);
  rs.lineTo(4, 0);
  rs.lineTo(0, 3);
  rs.closePath();
  const rf = new THREE.Mesh(new THREE.ExtrudeGeometry(rs, { depth: 18.6, bevelEnabled: false }).translate(0, 0, -9.3).rotateY(Math.PI / 2), SNOW);
  rf.position.y = 4;
  ars.add(rf);
  for (let i = 0; i < 5; i++) {
    const w = new THREE.Mesh(new THREE.PlaneGeometry(1, 1.4), warm);
    w.position.set(-7 + i * 3.5, 2.2, 3.52);
    ars.add(w);
  }
  g.add(ars);
  // огоньки по стене и пара фонарей
  const lp: THREE.Vector3[] = [];
  for (let i = 0; i < wallPts.length; i++) {
    const [x0, z0] = wallPts[i], [x1, z1] = wallPts[(i + 1) % wallPts.length];
    lp.push(...swag(new THREE.Vector3(x0, 4.6, z0), new THREE.Vector3(x1, 4.6, z1), 0.25, 0.9));
  }
  g.add(lights(lp, lightMat, true));
  for (const x of [-20, 20]) {
    const l = lampPost(glow, 4);
    l.position.set(x, 1.2, -34);
    g.add(l);
  }
  const pin = gisPin();
  pin.position.set(-8, 17, -36.5);
  pin.scale.setScalar(1.5);
  pin.userData.bob = 17;
  g.add(pin);
  const label = mapLabel("Крепость Корела", "Приозерск");
  label.position.set(-8, 24, -36.5);
  g.add(label);
  return g;
}

function stationStop(name: string, glow: THREE.Texture, lightMat: THREE.Material, side: 1 | -1, wooden = false) {
  const g = new THREE.Group();
  const z = side * 4.6;
  g.add(platform(40, z));
  const board = nameBoard(name);
  board.position.set(-6, 0.94, z + side * 1.2);
  g.add(board);
  const house = new THREE.Group();
  house.position.set(8, 0, side * 11);
  const wall = std(wooden ? "#b8642f" : "#c9c2b2");
  house.add(box(12, 4.2, 6, wall, 0, 2.1, 0));
  if (wooden) for (let y = 0.4; y < 4.2; y += 0.55) house.add(box(12.05, 0.06, 6.05, std("#8a4520"), 0, y, 0));
  const rs = new THREE.Shape();
  rs.moveTo(-3.6, 0);
  rs.lineTo(3.6, 0);
  rs.lineTo(0, 2.6);
  rs.closePath();
  const rf = new THREE.Mesh(new THREE.ExtrudeGeometry(rs, { depth: 12.8, bevelEnabled: false }).translate(0, 0, -6.4).rotateY(Math.PI / 2), SNOW);
  rf.position.y = 4.2;
  house.add(rf);
  const warm = WARM();
  for (let i = 0; i < 4; i++) {
    const w = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 1.5), warm);
    w.position.set(-4.5 + i * 3, 2.2, -side * 3.02);
    if (side > 0) w.rotation.y = Math.PI;
    house.add(w);
  }
  g.add(house);
  const posts: THREE.Vector3[] = [];
  for (let i = 0; i < 4; i++) {
    const l = lampPost(glow, 4);
    l.position.set(-16 + i * 10.5, 0.94, z + side * 1.4);
    g.add(l);
    posts.push(new THREE.Vector3(-16 + i * 10.5, 4.7, z + side * 1.4));
  }
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i < posts.length - 1; i++) pts.push(...swag(posts[i], posts[i + 1], 0.8, 0.45));
  g.add(lights(pts, lightMat));
  const label = mapLabel(name);
  label.scale.multiplyScalar(0.6);
  label.position.set(8, 11, side * 11);
  g.add(label);
  return g;
}

// ---------------------------------------------------------------------------
// Ладожские шхеры: замёрзшая Ладога и скалистые острова с соснами.

function skerries(lightMat: THREE.Material) {
  const g = new THREE.Group();
  const lake = new THREE.Mesh(new THREE.PlaneGeometry(900, 400).rotateX(-Math.PI / 2), std("#a9c8ea", { roughness: 0.18, metalness: 0.25 }));
  lake.position.set(0, 0.07, -222);
  g.add(lake);
  // торосы и полыньи, чтобы лёд не был пустым
  for (let i = 0; i < 40; i++) {
    const r = rock(0.6 + rnd() * 1.2, "#d6e6f8");
    r.position.set(-420 + rnd() * 840, 0, -30 - rnd() * 250);
    g.add(r);
  }
  for (let i = 0; i < 16; i++) {
    const isl = new THREE.Group();
    const R = 6 + rnd() * 14;
    for (let k = 0; k < 5; k++) {
      const r = rock(R * (0.4 + rnd() * 0.5), ["#7b7477", "#8c7f7a", "#6f6a70"][k % 3]);
      r.position.set((rnd() - 0.5) * R, 0, (rnd() - 0.5) * R * 0.6);
      isl.add(r);
    }
    const n = 3 + Math.floor(rnd() * 6);
    for (let k = 0; k < n; k++) {
      const p = pine(0.9 + rnd() * 1.1);
      p.position.set((rnd() - 0.5) * R * 0.8, R * 0.18, (rnd() - 0.5) * R * 0.4);
      isl.add(p);
    }
    isl.position.set(-400 + (i / 16) * 800 + rnd() * 30, 0, -34 - Math.pow(rnd(), 1.6) * 190);
    g.add(isl);
    if (i % 4 === 1) {
      // на некоторых островах — домик с огоньками
      const hut = box(4, 3, 3, std("#8a2b2b"), 0, 1.5 + R * 0.15, 0);
      hut.position.x = isl.position.x;
      hut.position.z = isl.position.z + 2;
      g.add(hut);
      g.add(lights(swag(new THREE.Vector3(isl.position.x - 2, 3.4 + R * 0.15, isl.position.z + 3.6), new THREE.Vector3(isl.position.x + 2, 3.4 + R * 0.15, isl.position.z + 3.6), 0.2, 0.3), lightMat));
    }
  }
  const label = mapLabel("Ладожские шхеры", "замёрзшая Ладога");
  label.position.set(60, 22, -70);
  g.add(label);
  return g;
}

// ---------------------------------------------------------------------------
// Сортавала: деревянные дома финской эпохи у Ладоги.

function sortavala(glow: THREE.Texture, lightMat: THREE.Material) {
  const g = new THREE.Group();
  g.add(stationStop("Сортавала", glow, lightMat, 1, true));
  const cols = ["#b8323a", "#d8a43a", "#2f6b8a", "#e8e0cc", "#3f7a4e"];
  const warm = WARM();
  for (let i = 0; i < 16; i++) {
    const h = new THREE.Group();
    const w = 6 + rnd() * 4, d = 5 + rnd() * 2, hh = 4 + rnd() * 3;
    h.add(box(w, hh, d, std(cols[i % cols.length]), 0, hh / 2, 0));
    const rs = new THREE.Shape();
    rs.moveTo(-d / 2 - 0.4, 0);
    rs.lineTo(d / 2 + 0.4, 0);
    rs.lineTo(0, d * 0.5);
    rs.closePath();
    const rf = new THREE.Mesh(new THREE.ExtrudeGeometry(rs, { depth: w + 0.6, bevelEnabled: false }).translate(0, 0, -(w + 0.6) / 2).rotateY(Math.PI / 2), SNOW);
    rf.position.y = hh;
    h.add(rf);
    for (let k = 0; k < 3; k++) {
      if (rnd() < 0.3) continue;
      const win = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 1.1), warm);
      win.position.set(-w / 3 + (k * w) / 3, hh * 0.55, d / 2 + 0.02);
      h.add(win);
    }
    h.position.set(-60 + (i % 8) * 15 + rnd() * 4, 0, -16 - Math.floor(i / 8) * 13 - rnd() * 3);
    h.rotation.y = (rnd() - 0.5) * 0.3;
    g.add(h);
  }
  for (let i = 0; i < 6; i++) {
    const l = lampPost(glow, 4.4);
    l.position.set(-55 + i * 20, 0, -11);
    g.add(l);
  }
  const label = mapLabel("Сортавала", "город у Ладоги");
  label.position.set(-10, 20, -24);
  g.add(label);
  return g;
}

// ---------------------------------------------------------------------------
// Рускеальские водопады: каменные ступени и замёрзшие каскады.

function waterfalls(lightMat: THREE.Material) {
  const g = new THREE.Group();
  const river = new THREE.Mesh(new THREE.PlaneGeometry(16, 90).rotateX(-Math.PI / 2), ICE());
  river.position.set(0, 0.06, 52);
  g.add(river);
  const fallMat = new THREE.MeshStandardMaterial({ color: "#dff2ff", emissive: "#4aa8ff", emissiveIntensity: 0.35, roughness: 0.2, transparent: true, opacity: 0.9 });
  for (let step = 0; step < 4; step++) {
    const z = 30 + step * 9;
    const hgt = 1.6 + step * 0.5;
    for (const x of [-9, -5, 5, 9]) {
      const r = rock(2.6 + rnd() * 1.5);
      r.position.set(x + (rnd() - 0.5) * 2, hgt * 0.6 + step * 0.9, z);
      g.add(r);
    }
    const fall = box(9, hgt + step * 0.9, 1.2, fallMat, 0, (hgt + step * 0.9) / 2, z - 0.8);
    g.add(fall);
    // сосульки
    for (let k = 0; k < 8; k++) {
      const ic = new THREE.Mesh(new THREE.ConeGeometry(0.22, 1.1, 6).rotateX(Math.PI), fallMat);
      ic.position.set(-4 + k * 1.1, hgt + step * 0.9 - 0.5, z - 1.5);
      g.add(ic);
    }
  }
  for (let i = 0; i < 6; i++) {
    const p = pine(1.4 + rnd());
    p.position.set((i % 2 ? 1 : -1) * (13 + rnd() * 6), 0, 28 + i * 7);
    g.add(p);
  }
  // гирлянда через реку
  g.add(lights(swag(new THREE.Vector3(-12, 6, 26), new THREE.Vector3(12, 6, 26), 1.8, 0.4), lightMat));
  const label = mapLabel("Рускеальские водопады");
  label.position.set(0, 16, 40);
  g.add(label);
  return g;
}

// ---------------------------------------------------------------------------
// Мраморный каньон Рускеалы: белые скалы вокруг ледяного озера, гроты, подсветка как сияние.

function canyon(glow: THREE.Texture, lightMat: THREE.Material) {
  const g = new THREE.Group();
  const cz = -58;
  // мрамор слегка светится цветом подсветки — так скалы «ловят» огни, как в настоящем каньоне
  const marble = new THREE.MeshStandardMaterial({ color: "#d9dde4", roughness: 0.5, flatShading: true, emissive: "#3aa0ff", emissiveIntensity: 0.22 });
  const marble2 = new THREE.MeshStandardMaterial({ color: "#aeb7c4", roughness: 0.6, flatShading: true, emissive: "#3aa0ff", emissiveIntensity: 0.18 });
  const ice = new THREE.Mesh(new THREE.CircleGeometry(1, 48).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: "#6fe0d6", roughness: 0.06, metalness: 0.3, emissive: "#167a80", emissiveIntensity: 0.9 }));
  ice.scale.set(52, 1, 25);
  ice.position.set(0, 0.08, cz);
  g.add(ice);
  // отвесные скалы — глыбы-многогранники; ближняя к пути сторона ниже, чтобы было видно внутрь
  const n = 40;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const near = Math.sin(a) > 0.3;
    const h = near ? 4 + rnd() * 2 : 13 + rnd() * 8;
    const rx = 58 + rnd() * 4, rz = 30 + rnd() * 3;
    for (let k = 0; k < 2; k++) {
      const geo = new THREE.DodecahedronGeometry(1, 1);
      const pa = geo.attributes.position;
      for (let v = 0; v < pa.count; v++) pa.setXYZ(v, pa.getX(v) * (0.85 + rnd() * 0.3), pa.getY(v) * (0.85 + rnd() * 0.3), pa.getZ(v) * (0.85 + rnd() * 0.3));
      geo.computeVertexNormals();
      const blk = new THREE.Mesh(geo, (i + k) % 3 ? marble : marble2);
      blk.scale.set(6 + rnd() * 3, h * (k ? 0.6 : 1) * 0.55, 4.5 + rnd() * 2);
      blk.position.set(Math.cos(a) * (rx + k * 4), h * (k ? 0.32 : 0.5) * 0.9, cz + Math.sin(a) * (rz + k * 2.5));
      blk.rotation.y = -a + (rnd() - 0.5) * 0.4;
      g.add(blk);
    }
    const cap = new THREE.Mesh(new THREE.DodecahedronGeometry(1, 0), SNOW);
    cap.scale.set(6, 0.6, 4);
    cap.position.set(Math.cos(a) * rx, h * 0.98, cz + Math.sin(a) * rz);
    g.add(cap);
  }
  // гроты и штольни: тёмные арки с тёплым светом
  const grotto = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.9, 1.6, 2.4) });
  for (let i = 0; i < 5; i++) {
    const a = Math.PI + 0.35 + i * 0.55;
    const gr = new THREE.Mesh(new THREE.CircleGeometry(2.2, 20, 0, Math.PI), grotto);
    gr.position.set(Math.cos(a) * 54, 0.2, cz + Math.sin(a) * 26);
    gr.lookAt(0, 0.2, cz);
    g.add(gr);
  }
  // подсветка скал, «как северное сияние»: цветные световые пятна медленно меняют цвет
  const washes: THREE.Mesh[] = [];
  for (let i = 0; i < 9; i++) {
    const a = Math.PI + 0.15 + i * 0.36;
    const wash = new THREE.Mesh(
      new THREE.PlaneGeometry(22, 22),
      new THREE.MeshBasicMaterial({ map: glow, transparent: true, opacity: 0.75, depthWrite: false, blending: THREE.AdditiveBlending }),
    );
    wash.position.set(Math.cos(a) * 46, 7, cz + Math.sin(a) * 20);
    wash.lookAt(0, 7, cz);
    wash.userData.phase = i * 0.9;
    g.add(wash);
    washes.push(wash);
  }
  // деревянный настил с огоньками вдоль ближнего края
  g.add(box(100, 0.3, 2.4, std("#6b4a33"), 0, 5.6, cz + 29));
  for (let x = -48; x <= 48; x += 8) g.add(box(0.25, 5.6, 0.25, std("#4a3326"), x, 2.8, cz + 29));
  g.add(lights(swag(new THREE.Vector3(-50, 7, cz + 29.5), new THREE.Vector3(50, 7, cz + 29.5), 0.6, 0.45), lightMat));
  // платформа «Горный парк Рускеала»
  const stop = stationStop("Рускеала", glow, lightMat, 1, true);
  stop.position.x = 70;
  g.add(stop);
  const pin = gisPin();
  pin.position.set(0, 20, cz);
  pin.scale.setScalar(1.6);
  pin.userData.bob = 20;
  g.add(pin);
  const label = mapLabel("Мраморный каньон", "Горный парк «Рускеала»");
  label.position.set(0, 27, cz);
  g.add(label);
  pin.userData.finaleHide = label.userData.finaleHide = true;
  const center = new THREE.Vector3(0, 0, cz);
  return {
    g,
    center,
    update(t: number) {
      washes.forEach((w) => {
        const k = t * 0.25 + w.userData.phase;
        (w.material as THREE.MeshBasicMaterial).color.setHSL((0.38 + 0.25 * Math.sin(k)) % 1, 0.9, 0.55);
      });
      // общий оттенок подсветки скал плавно гуляет: зелёный → бирюзовый → сиреневый
      const hue = 0.42 + 0.2 * Math.sin(t * 0.18);
      marble.emissive.setHSL(hue, 0.9, 0.5);
      marble2.emissive.setHSL(hue + 0.05, 0.9, 0.45);
    },
  };
}

// ---------------------------------------------------------------------------
// Придорожное кафе «Калитки»: бревенчатая изба с наличниками, самовар на крыльце
// и большая калитка-вывеска (карельский открытый пирожок из ржаного теста).

function kalitka(k: number) {
  const g = new THREE.Group();
  const crust = std("#8a5a2e", { roughness: 0.9 });
  const fill = std("#f2c14e", { roughness: 0.7, emissive: "#7a4a00", emissiveIntensity: 0.25 });
  const base = new THREE.Mesh(new THREE.CylinderGeometry(k, k, 0.22 * k, 28), crust);
  base.scale.set(1.45, 1, 1);
  g.add(base);
  // защипы по краю
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    const p = new THREE.Mesh(new THREE.SphereGeometry(0.2 * k, 8, 6), crust);
    p.scale.set(1, 0.7, 1);
    p.position.set(Math.cos(a) * 1.4 * k * 0.86, 0.08 * k, Math.sin(a) * k * 0.86);
    g.add(p);
  }
  const f = new THREE.Mesh(new THREE.CylinderGeometry(0.66 * k, 0.66 * k, 0.24 * k, 24), fill);
  f.scale.set(1.45, 1, 1);
  f.position.y = 0.06 * k;
  g.add(f);
  // румяные пятнышки на начинке
  for (let i = 0; i < 6; i++) {
    const d = new THREE.Mesh(new THREE.SphereGeometry(0.09 * k, 6, 4), std("#c9872c"));
    d.scale.y = 0.3;
    d.position.set((rnd() - 0.5) * 1.3 * k, 0.19 * k, (rnd() - 0.5) * 0.8 * k);
    g.add(d);
  }
  return g;
}

function karelianCafe(glow: THREE.Texture, lightMat: THREE.Material) {
  const g = new THREE.Group();
  const W = 13, D = 7, H = 4.4;
  const house = new THREE.Group();
  house.position.set(0, 0, -21);
  g.add(house);
  const logMat = std("#8b5a35", { roughness: 0.95 });
  const logDark = std("#6e4428", { roughness: 0.95 });
  house.add(box(W - 0.4, H, D - 0.4, logDark, 0, H / 2, 0));
  // брёвна: по фасаду и бокам, с торцами на углах
  for (let y = 0.25, i = 0; y < H; y += 0.5, i++) {
    const m = i % 2 ? logMat : logDark;
    const front = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, W + 0.6, 10).rotateZ(Math.PI / 2), m);
    front.position.set(0, y, D / 2 - 0.1);
    house.add(front);
    for (const sx of [-1, 1]) {
      const side = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, D + 0.6, 10).rotateX(Math.PI / 2), m);
      side.position.set(sx * (W / 2 - 0.1), y + 0.25, 0);
      house.add(side);
    }
  }
  // двускатная крыша под снегом
  const rs = new THREE.Shape();
  rs.moveTo(-D / 2 - 1, 0);
  rs.lineTo(D / 2 + 1, 0);
  rs.lineTo(0, 3.4);
  rs.closePath();
  const roof = new THREE.Mesh(new THREE.ExtrudeGeometry(rs, { depth: W + 1.4, bevelEnabled: false }).translate(0, 0, -(W + 1.4) / 2).rotateY(Math.PI / 2), std("#7a2a24"));
  roof.position.y = H;
  house.add(roof);
  const snowRoof = new THREE.Mesh(new THREE.ExtrudeGeometry(rs, { depth: W + 1.6, bevelEnabled: false }).translate(0, 0, -(W + 1.6) / 2).rotateY(Math.PI / 2), SNOW);
  snowRoof.scale.set(1.02, 0.96, 1.02);
  snowRoof.position.y = H + 0.35;
  house.add(snowRoof);
  // печная труба и дымок
  house.add(box(0.9, 2.2, 0.9, std("#9a5a48"), 3.4, H + 2.6, -0.8));
  house.add(box(1.0, 0.25, 1.0, SNOW, 3.4, H + 3.75, -0.8));
  const puffs: THREE.Mesh[] = [];
  const smokeMat = new THREE.MeshStandardMaterial({ color: "#d8dde8", transparent: true, opacity: 0.45, depthWrite: false, roughness: 1 });
  for (let i = 0; i < 6; i++) {
    const p = new THREE.Mesh(new THREE.SphereGeometry(0.6, 10, 8), smokeMat);
    p.userData.k = i / 6;
    house.add(p);
    puffs.push(p);
  }
  // окна с резными белыми наличниками
  const warm = WARM();
  const white = std("#f4efe4");
  for (const x of [-4.4, -1.9, 3.2]) {
    const w = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 1.5), warm);
    w.position.set(x, 2.3, D / 2 + 0.2);
    house.add(w);
    house.add(box(1.7, 0.16, 0.12, white, x, 1.48, D / 2 + 0.22));
    house.add(box(0.14, 1.7, 0.12, white, x - 0.72, 2.3, D / 2 + 0.22));
    house.add(box(0.14, 1.7, 0.12, white, x + 0.72, 2.3, D / 2 + 0.22));
    const cap = new THREE.Shape();
    cap.moveTo(-0.95, 0);
    cap.lineTo(0.95, 0);
    cap.lineTo(0, 0.55);
    cap.closePath();
    const c = new THREE.Mesh(new THREE.ExtrudeGeometry(cap, { depth: 0.12, bevelEnabled: false }), white);
    c.position.set(x, 3.12, D / 2 + 0.16);
    house.add(c);
  }
  // дверь, крыльцо
  const door = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 2.4), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 1.3, 0.6) }));
  door.position.set(0.65, 1.5, D / 2 + 0.21);
  house.add(door);
  house.add(box(3, 0.3, 1.8, logMat, 0.65, 0.15, D / 2 + 1));
  house.add(box(3, 0.08, 1.8, SNOW, 0.65, 0.34, D / 2 + 1));
  // вывеска над дверью
  const sign = canvasTex(1024, 300, (c) => {
    c.fillStyle = "#5a3520";
    c.beginPath();
    c.roundRect(6, 6, 1012, 288, 40);
    c.fill();
    c.strokeStyle = "#e8c98a";
    c.lineWidth = 10;
    c.stroke();
    c.fillStyle = "#fbe7bd";
    c.textAlign = "center";
    c.font = "800 150px 'Golos Text', system-ui, sans-serif";
    c.fillText("КАЛИТКИ", 512, 160);
    c.font = "600 58px 'Golos Text', system-ui, sans-serif";
    c.fillText("кафе · чай из самовара", 512, 248);
  });
  const board = new THREE.Mesh(new THREE.PlaneGeometry(5.4, 1.6), new THREE.MeshBasicMaterial({ map: sign, color: new THREE.Color(1.25, 1.2, 1.15) }));
  board.position.set(-1.2, H + 1.1, D / 2 + 0.75);
  house.add(board);
  // большая калитка-символ на коньке крыши — её видно издалека
  const big = kalitka(1.5);
  big.rotation.x = Math.PI / 2 - 0.12;
  big.position.set(-2.6, H + 3.4 + 1.45, 0.2);
  house.add(big);
  house.add(box(0.16, 1.2, 0.16, std("#2b2f36", { metalness: 0.6 }), -2.6, H + 3.6, 0.2));
  // столик на улице: самовар и тарелка калиток
  const table = new THREE.Group();
  table.position.set(4.6, 0, D / 2 + 2.6);
  house.add(table);
  table.add(box(2.4, 0.12, 1.4, logMat, 0, 1.0, 0));
  for (const [x, z] of [[-1, -0.55], [1, -0.55], [-1, 0.55], [1, 0.55]]) table.add(box(0.12, 1.0, 0.12, logDark, x, 0.5, z));
  table.add(box(2.4, 0.06, 1.4, SNOW, 0, 1.09, 0));
  const brass = std("#c9a24a", { metalness: 0.85, roughness: 0.3 });
  const sam = new THREE.Mesh(new THREE.SphereGeometry(0.42, 16, 12), brass);
  sam.scale.y = 1.3;
  sam.position.set(-0.5, 1.68, 0);
  table.add(sam);
  const samTop = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.2, 0.35, 12), brass);
  samTop.position.set(-0.5, 2.3, 0);
  table.add(samTop);
  const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.42, 0.06, 20), std("#f4efe4"));
  plate.position.set(0.6, 1.16, 0);
  table.add(plate);
  for (let i = 0; i < 3; i++) {
    const k = kalitka(0.16);
    k.position.set(0.45 + (i % 2) * 0.3, 1.22 + i * 0.04, -0.12 + i * 0.12);
    k.rotation.y = i;
    table.add(k);
  }
  for (const x of [-1.4, 1.4]) table.add(box(0.5, 0.5, 1.2, logMat, x * 1.25, 0.25, 0));
  // фонари, ёлочка с огоньками, гирлянда по свесу крыши
  for (const x of [-8.6, 8.6]) {
    const l = lampPost(glow, 4);
    l.position.set(x, 0, D / 2 + 1.2);
    house.add(l);
  }
  const fir = pine(1.3);
  fir.position.set(9.5, 0, -2);
  house.add(fir);
  const eave = swag(new THREE.Vector3(-W / 2 - 0.5, H + 0.2, D / 2 + 1.05), new THREE.Vector3(W / 2 + 0.5, H + 0.2, D / 2 + 1.05), 0.5, 0.4);
  const lt = lights(eave, lightMat);
  house.add(lt);
  const label = mapLabel("Кафе «Калитки»", "карельские пирожки");
  label.scale.multiplyScalar(0.7);
  label.position.set(0, H + 8.5, 0);
  house.add(label);
  return {
    g,
    update(t: number) {
      for (const p of puffs) {
        const k = (p.userData.k + t * 0.12) % 1;
        p.position.set(3.4 + k * 2.2, H + 4 + k * 5, -0.8 - k * 1.2);
        p.scale.setScalar(0.5 + k * 1.6);
        (p.material as THREE.MeshStandardMaterial).opacity = 0.45;
      }
      big.rotation.z = Math.sin(t * 1.4) * 0.08;
    },
  };
}

// ---------------------------------------------------------------------------

type Clear = [number, number, number, number]; // x0, x1, z0, z1 в координатах места
type Landmark = { name: string; at: number; obj: THREE.Group; clears: Clear[]; update?: (t: number) => void };

export function makeJourney(scene: THREE.Scene, glow: THREE.Texture, lightMat: THREE.Material, clear: { value: THREE.Vector4[] }) {
  void softDot;
  const L: Landmark[] = [];
  const add = (name: string, at: number, obj: THREE.Group, clears: Clear[], update?: (t: number) => void) => {
    obj.visible = false;
    scene.add(obj);
    L.push({ name, at, obj, clears, update });
  };
  add("Финляндский вокзал", 0, finlandStation(glow, lightMat), [[-95, 95, -95, -2]]);
  add("Сосново", STOPS[1].at, stationStop("Сосново", glow, lightMat, 1), [[-24, 24, 2, 18]]);
  add("Река Вуокса", STOPS[2].at - 140, vuoksaBridge(), [[-20, 20, -270, 270]]);
  add("Крепость Корела", STOPS[2].at - 60, korela(glow, lightMat), [[-50, 50, -86, -14]]);
  add("Приозерск", STOPS[2].at, stationStop("Приозерск", glow, lightMat, 1, true), [[-24, 24, 2, 18]]);
  add("Лахденпохья", STOPS[3].at, stationStop("Лахденпохья", glow, lightMat, 1), [[-24, 24, 2, 18]]);
  const cafe = karelianCafe(glow, lightMat);
  add("Кафе «Калитки»", STOPS[3].at + 150, cafe.g, [[-22, 22, -34, -8]], cafe.update);
  add("Ладожские шхеры", STOPS[3].at + 520, skerries(lightMat), [[-460, 460, -430, -20]]);
  add("Сортавала", STOPS[4].at, sortavala(glow, lightMat), [[-70, 70, -46, -2], [-24, 24, 2, 18]]);
  add("Рускеальские водопады", STOPS[5].at - 520, waterfalls(lightMat), [[-22, 22, 8, 100]]);
  const can = canyon(glow, lightMat);
  add("Мраморный каньон", STOPS[5].at - 70, can.g, [[-72, 92, -100, -2], [46, 94, 2, 18]], can.update);

  // ?at=2400 — начать с нужного места маршрута (для проверки)
  const startAt = Number(new URLSearchParams(location.search).get("at"));
  let pos = Number.isFinite(startAt) && startAt > 0 ? startAt % ROUTE_TOTAL : 0;
  const near = (at: number) => {
    let d = at - pos;
    if (d > ROUTE_TOTAL / 2) d -= ROUTE_TOTAL;
    if (d < -ROUTE_TOTAL / 2) d += ROUTE_TOTAL;
    return d;
  };

  const place = () => {
    let cur = STOPS[0];
    let next = STOPS[1];
    for (let i = 0; i < STOPS.length; i++) if (pos >= STOPS[i].at) [cur, next] = [STOPS[i], STOPS[i + 1] ?? STOPS[0]];
    const here = L.find((l) => Math.abs(near(l.at)) < 75);
    // самое близкое место и расстояние до него — по нему снимаем открытку
    let best: Landmark | null = null;
    for (const l of L) if (!best || Math.abs(near(l.at)) < Math.abs(near(best.at))) best = l;
    return { from: cur.name, to: next.name, here: here?.name ?? null, closest: best!.name, closestD: near(best!.at) };
  };

  return {
    /** Доля пути 0..1 и какие места рядом — для мини-карты. */
    status: () => ({ p: pos / ROUTE_TOTAL, pos, ...place() }),
    /** Переставить поезд к нужному месту маршрута (финал — к каньону). */
    jump(at: number) {
      pos = ((at % ROUTE_TOTAL) + ROUTE_TOTAL) % ROUTE_TOTAL;
    },
    canyonAt: STOPS[5].at - 70,
    /** В финале над каньоном стоит ёлка — подпись и пин убираем, чтобы не закрывали её. */
    finaleMode(on: boolean) {
      can.g.traverse((o) => {
        if (o.userData.finaleHide) o.visible = !on;
      });
    },
    canyonCenter: () => can.g.position.clone().add(can.center),
    update(dx: number, t: number) {
      pos += dx;
      if (pos >= ROUTE_TOTAL) pos -= ROUTE_TOTAL;
      const active: { d: number; r: THREE.Vector4 }[] = [];
      for (const l of L) {
        const d = near(l.at);
        const vis = d > -480 && d < 560;
        l.obj.visible = vis;
        if (!vis) continue;
        l.obj.position.x = d;
        l.update?.(t);
        l.obj.traverse((o) => {
          if (o.userData.bob !== undefined) {
            o.position.y = o.userData.bob + Math.sin(t * 2) * 0.4;
            o.rotation.y = t * 0.8;
          }
        });
        for (const c of l.clears) active.push({ d: Math.abs(d), r: new THREE.Vector4(d + c[0], d + c[1], c[2], c[3]) });
      }
      active.sort((a, b) => a.d - b.d);
      for (let i = 0; i < clear.value.length; i++) {
        if (active[i]) clear.value[i].copy(active[i].r);
        else clear.value[i].set(1, -1, 0, 0);
      }
    },
  };
}
