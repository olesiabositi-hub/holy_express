// Ретро-состав: тёмно-зелёный паровоз с красным низом и неоновой снежинкой, вагоны в гирляндах.
// Поезд смотрит в +X и стоит на месте: едет мир.
import * as THREE from "three";
import { beamTex, canvasTex, softDot, warmSpill } from "./tex";

const GREEN = "#2b6b4d";
const RED = "#a3262b";
const GOLD = "#c9a24a";
const WARM = new THREE.Color(2.6, 1.45, 0.62);

export type Car = {
  caseIndex: number;
  group: THREE.Group;
  lid: THREE.Group; // крыша, которая поднимается
  pick: THREE.Mesh;
  paint: THREE.MeshStandardMaterial;
  inside: THREE.PointLight;
  wheels: THREE.Mesh[];
  open: number; // 0..1 текущее
  openTarget: number;
  hover: number;
  hoverTarget: number;
  locked: boolean;
  lockMat: THREE.MeshBasicMaterial; // окна
  x: number;
  len: number;
  wheelR: number[];
};

const std = (color: THREE.ColorRepresentation, o: THREE.MeshStandardMaterialParameters = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.15, ...o });

function box(w: number, h: number, d: number, mat: THREE.Material, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  return m;
}

function wheel(r: number, mat: THREE.Material) {
  const g = new THREE.CylinderGeometry(r, r, 0.16, 18).rotateX(Math.PI / 2);
  const m = new THREE.Mesh(g, mat);
  // спицы, чтобы вращение было видно
  const spokeMat = new THREE.MeshStandardMaterial({ color: "#2a1414", roughness: 0.6 });
  for (let i = 0; i < 3; i++) {
    const sp = new THREE.Mesh(new THREE.BoxGeometry(r * 1.7, 0.09, 0.18), spokeMat);
    sp.rotation.z = (i * Math.PI) / 3;
    m.add(sp);
  }
  return m;
}

/** Гирлянда: общий InstancedMesh, лампочки мерцают. */
class Garland {
  pts: THREE.Vector3[] = [];
  mesh!: THREE.InstancedMesh;
  base: THREE.Color[] = [];
  add(a: THREE.Vector3, b: THREE.Vector3, step = 0.32, sag = 0.12) {
    const n = Math.max(2, Math.round(a.distanceTo(b) / step));
    for (let i = 0; i <= n; i++) {
      const p = a.clone().lerp(b, i / n);
      // провисание между точками крепления
      p.y -= Math.sin(((i % 4) / 4) * Math.PI) * sag;
      this.pts.push(p);
    }
  }
  build(parent: THREE.Object3D) {
    const palette = [new THREE.Color(3, 2.2, 1.1), new THREE.Color(3, 0.5, 0.4), new THREE.Color(0.6, 2.6, 0.9), new THREE.Color(3, 2.6, 0.6), new THREE.Color(0.9, 1.6, 3.2)];
    this.mesh = new THREE.InstancedMesh(new THREE.SphereGeometry(0.1, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff }), this.pts.length);
    const m = new THREE.Matrix4();
    this.pts.forEach((p, i) => {
      m.makeTranslation(p.x, p.y, p.z);
      this.mesh.setMatrixAt(i, m);
      const c = palette[i % 5 === 0 ? 1 : i % 7 === 0 ? 2 : i % 11 === 0 ? 4 : 0].clone();
      this.base.push(c);
      this.mesh.setColorAt(i, c);
    });
    parent.add(this.mesh);
  }
  twinkle(t: number) {
    const c = new THREE.Color();
    for (let i = 0; i < this.base.length; i++) {
      const k = 0.55 + 0.45 * Math.sin(t * 3 + i * 1.7) * Math.sin(t * 1.3 + i * 0.37);
      c.copy(this.base[i]).multiplyScalar(0.35 + 0.65 * Math.max(0, k));
      this.mesh.setColorAt(i, c);
    }
    this.mesh.instanceColor!.needsUpdate = true;
  }
}

function interior(kind: number, len: number, w: number, y0: number) {
  // простая обстановка: видна, когда поднимается крыша
  const g = new THREE.Group();
  const wood = std("#6b4128", { roughness: 0.8 });
  const seat = std("#7a2430", { roughness: 0.9 });
  const metal = std("#5b6270", { metalness: 0.6, roughness: 0.4 });
  const floor = box(len - 0.3, 0.05, w - 0.2, std("#4a2f22", { roughness: 0.9 }), 0, y0 + 0.03, 0);
  g.add(floor);
  const runner = box(len - 1, 0.02, 0.7, std("#8a1f2a", { roughness: 1 }), 0, y0 + 0.07, kind === 2 ? 0.55 : 0);
  g.add(runner);
  const n = 4;
  for (let i = 0; i < n; i++) {
    const x = -len / 2 + 1.3 + i * ((len - 2.6) / (n - 1));
    if (kind === 0) {
      g.add(box(1.1, 1.0, 0.9, std(["#b07a43", "#9c6a3b", "#c48f53"][i % 3], { roughness: 1 }), x, y0 + 0.5, -0.7));
      g.add(box(0.9, 0.7, 0.8, std("#a5713f", { roughness: 1 }), x + 0.3, y0 + 0.35, 0.75));
      g.add(box(0.5, 1.8, 0.5, metal, x - 0.6, y0 + 0.9, 0.9));
    } else if (kind === 1 || kind === 2) {
      g.add(box(1.7, 0.45, 0.75, seat, x, y0 + 0.4, -0.85));
      g.add(box(0.12, 1.9, 1.8, wood, x + 0.95, y0 + 0.95, -0.35));
      g.add(box(0.5, 0.06, 0.6, wood, x, y0 + 0.75, -1.05));
      if (kind === 1) g.add(box(1.6, 0.35, 0.55, seat, x, y0 + 0.35, 1.0));
    } else {
      g.add(box(0.9, 0.06, 1.0, std("#f2ede4"), x, y0 + 0.78, -0.75));
      g.add(box(0.12, 0.78, 0.12, wood, x, y0 + 0.39, -0.75));
      g.add(box(0.9, 0.06, 1.0, std("#f2ede4"), x, y0 + 0.78, 0.75));
      g.add(box(0.12, 0.78, 0.12, wood, x, y0 + 0.39, 0.75));
      const candle = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 2, 0.8) }));
      candle.position.set(x, y0 + 0.88, -0.75);
      g.add(candle);
    }
  }
  details(g, kind, len, w, y0);
  return g;
}

/** Мелочи, ради которых хочется заглянуть внутрь: чай в подстаканниках, мандарины, самовар, ёлочка. */
function details(g: THREE.Group, kind: number, len: number, w: number, y0: number) {
  const brass = std("#c9a24a", { metalness: 0.85, roughness: 0.3 });
  const tea = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 0.7, 0.18) });
  const orange = std("#ff8a1c", { roughness: 0.6, emissive: "#ff6a00", emissiveIntensity: 0.25 });
  const leaf = std("#2f7a3a");
  const glass = (x: number, z: number) => {
    // стакан в подстаканнике — без него поезд не поезд
    const holder = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.065, 0.13, 12), brass);
    holder.position.set(x, y0 + 0.85, z);
    g.add(holder);
    const t = new THREE.Mesh(new THREE.CylinderGeometry(0.062, 0.062, 0.1, 12), tea);
    t.position.set(x, y0 + 0.93, z);
    g.add(t);
    const handle = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.012, 6, 12, Math.PI), brass);
    handle.rotation.z = -Math.PI / 2;
    handle.position.set(x + 0.08, y0 + 0.86, z);
    g.add(handle);
  };
  const mandarins = (x: number, z: number, n = 3) => {
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.075, 10, 8), orange);
      m.scale.y = 0.85;
      m.position.set(x + (i % 2) * 0.13 - 0.06, y0 + 0.84 + (i === 2 ? 0.08 : 0), z + (i === 1 ? 0.1 : 0));
      g.add(m);
      if (i === 0) {
        const l = new THREE.Mesh(new THREE.SphereGeometry(0.04, 6, 4), leaf);
        l.scale.set(1.4, 0.3, 0.7);
        l.position.set(m.position.x, m.position.y + 0.07, m.position.z);
        g.add(l);
      }
    }
  };
  const lamp = (x: number, z: number) => {
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 2.1, 1) }));
    b.position.set(x, y0 + 2.15, z);
    g.add(b);
  };
  const n = 4;
  for (let i = 0; i < n; i++) {
    const x = -len / 2 + 1.3 + i * ((len - 2.6) / (n - 1));
    if (kind === 1 || kind === 2) {
      glass(x - 0.12, -1.0);
      if (i % 2 === 0) mandarins(x + 0.15, -1.08, 2);
      lamp(x + 0.95, -w / 2 + 0.25);
    } else if (kind === 3) {
      glass(x + 0.2, -0.6);
      glass(x - 0.2, 0.9);
      mandarins(x + 0.15, 0.6);
    } else if (kind === 0) {
      // мигающие огоньки серверов
      for (let k = 0; k < 3; k++) {
        const led = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.02), new THREE.MeshBasicMaterial({ color: k === 1 ? new THREE.Color(3, 0.6, 0.3) : new THREE.Color(0.4, 3, 0.6) }));
        led.position.set(x - 0.6, y0 + 1.2 + k * 0.22, 0.9 - 0.26);
        led.userData.blink = i * 3 + k;
        g.add(led);
      }
    }
  }
  if (kind === 3) {
    // самовар на буфете и ёлочка в углу ресторана
    g.add(box(1.2, 0.9, 0.7, std("#5a3420", { roughness: 0.8 }), len / 2 - 0.8, y0 + 0.45, -w / 2 + 0.5));
    const sam = new THREE.Group();
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.32, 16, 12), brass);
    body.scale.y = 1.25;
    body.position.y = 0.4;
    sam.add(body);
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.14, 0.25, 12), brass);
    neck.position.y = 0.88;
    sam.add(neck);
    const pot = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 8), std("#f2ede4"));
    pot.position.y = 1.08;
    sam.add(pot);
    const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.26, 0.12, 12), brass);
    sam.add(foot);
    sam.position.set(len / 2 - 0.8, y0 + 0.9, -w / 2 + 0.5);
    g.add(sam);
    const fir = new THREE.Group();
    for (let i = 0; i < 3; i++) {
      const c = new THREE.Mesh(new THREE.ConeGeometry(0.5 - i * 0.13, 0.6, 8), std("#1f5a3c", { flatShading: true }));
      c.position.y = 0.35 + i * 0.35;
      fir.add(c);
    }
    const star = new THREE.Mesh(new THREE.OctahedronGeometry(0.1), new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 2.4, 0.6) }));
    star.position.y = 1.35;
    fir.add(star);
    const cols = [new THREE.Color(3, 0.5, 0.4), new THREE.Color(3, 2.4, 0.6), new THREE.Color(0.8, 1.6, 3)];
    for (let i = 0; i < 9; i++) {
      const a = i * 2.1;
      const y = 0.25 + (i / 9) * 0.95;
      const r = 0.42 * (1 - y / 1.4);
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.045, 6, 4), new THREE.MeshBasicMaterial({ color: cols[i % 3] }));
      b.position.set(Math.cos(a) * r, y, Math.sin(a) * r);
      fir.add(b);
    }
    fir.position.set(-len / 2 + 0.6, y0 + 0.05, w / 2 - 0.55);
    g.add(fir);
  }
}

export function makeTrain(scene: THREE.Scene) {
  const train = new THREE.Group();
  scene.add(train);
  const garland = new Garland();
  const glow = softDot();
  const spill = warmSpill();
  const cars: Car[] = [];
  const allWheels: { m: THREE.Mesh; r: number }[] = [];
  const windowMats: THREE.MeshBasicMaterial[] = [];

  // ---------- Вагоны ----------
  const W = 2.7;
  const H = 2.9;
  const Y0 = 1.45; // пол вагона
  const LEN = 10;
  const GAP = 0.8;
  const LOCO = 14;
  const front = 29;
  const order = [3, 2, 1, 0]; // от паровоза к хвосту: ресторан, купе, плацкарт, багажный

  const wheelMat = std(RED, { roughness: 0.45, metalness: 0.4 });
  const darkMat = std("#16181c", { roughness: 0.8 });

  order.forEach((caseIndex, i) => {
    const x = front - LOCO - GAP - LEN / 2 - i * (LEN + GAP);
    const g = new THREE.Group();
    g.position.x = x;
    train.add(g);
    const paint = std(GREEN, { roughness: 0.45, metalness: 0.25 });
    const red = std(RED, { roughness: 0.5 });
    // стенки и торцы (сверху вагон открыт — внутрь заглядываем через крышу)
    for (const z of [-1, 1]) {
      g.add(box(LEN, H, 0.1, paint, 0, Y0 + H / 2, z * (W / 2 - 0.05)));
      g.add(box(LEN + 0.02, 0.38, 0.12, red, 0, Y0 + 0.3, z * (W / 2 - 0.04)));
      g.add(box(LEN + 0.02, 0.05, 0.13, std("#e9dcc0"), 0, Y0 + 0.55, z * (W / 2 - 0.04)));
    }
    for (const xx of [-1, 1]) g.add(box(0.1, H, W, paint, xx * (LEN / 2 - 0.05), Y0 + H / 2, 0));
    g.add(box(LEN, 0.1, W, darkMat, 0, Y0, 0));
    // переходы-гармошки
    g.add(box(0.5, 2.2, 1.6, darkMat, -LEN / 2 - 0.25, Y0 + 1.2, 0));
    // окна
    const winMat = new THREE.MeshBasicMaterial({ color: WARM.clone() });
    windowMats.push(winMat);
    for (const z of [-1, 1]) {
      for (let k = 0; k < 8; k++) {
        const wx = -LEN / 2 + 0.9 + k * ((LEN - 1.8) / 7);
        const win = new THREE.Mesh(new THREE.PlaneGeometry(0.78, 0.8), winMat);
        win.position.set(wx, Y0 + 1.75, z * (W / 2 + 0.012));
        if (z < 0) win.rotation.y = Math.PI;
        g.add(win);
        const frame = box(0.94, 0.96, 0.02, std("#d8c79e", { metalness: 0.5 }), wx, Y0 + 1.75, z * (W / 2 - 0.004));
        g.add(frame);
      }
    }
    g.add(interior(caseIndex, LEN, W, Y0));
    // крыша-крышка
    const lid = new THREE.Group();
    lid.position.y = Y0 + H;
    const roof = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, LEN + 0.2, 24, 1).rotateZ(Math.PI / 2), std("#2a2d33", { roughness: 0.7 }));
    roof.scale.set(1, 0.28, 1);
    lid.add(roof);
    const snowCap = new THREE.Mesh(new THREE.CylinderGeometry(1.22, 1.22, LEN - 0.2, 20, 1).rotateZ(Math.PI / 2), std("#f2f6ff", { roughness: 0.9 }));
    snowCap.scale.set(1, 0.2, 0.92);
    snowCap.position.y = 0.16;
    lid.add(snowCap);
    g.add(lid);
    // гирлянда по краям крыши
    for (const z of [-1, 1]) {
      garland.add(new THREE.Vector3(x - LEN / 2 + 0.2, Y0 + H + 0.05, z * (W / 2 + 0.06)), new THREE.Vector3(x + LEN / 2 - 0.2, Y0 + H + 0.05, z * (W / 2 + 0.06)));
    }
    // тележки и колёса
    const wheels: THREE.Mesh[] = [];
    for (const bx of [-LEN / 2 + 1.8, LEN / 2 - 1.8]) {
      g.add(box(2.6, 0.45, W - 0.5, darkMat, bx, 1.12, 0));
      for (const dx of [-0.7, 0.7])
        for (const z of [-1, 1]) {
          const wm = wheel(0.45, wheelMat);
          wm.position.set(bx + dx, 0.99, z * 0.78);
          g.add(wm);
          wheels.push(wm);
          allWheels.push({ m: wm, r: 0.45 });
        }
    }
    // свет из окон на снегу
    for (const z of [-1, 1]) {
      const p = new THREE.Mesh(new THREE.PlaneGeometry(LEN + 2, 4.5).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: spill, transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending }));
      if (z < 0) (p.geometry as THREE.BufferGeometry).rotateY(Math.PI);
      p.position.set(0, 0.06, z * (W / 2 + 2.3));
      g.add(p);
    }
    const inside = new THREE.PointLight("#ffb46a", 0, 9, 1.6);
    inside.position.set(0, Y0 + 2.2, 0);
    g.add(inside);
    const pick = new THREE.Mesh(new THREE.BoxGeometry(LEN + 0.6, H + 1.6, W + 0.8), new THREE.MeshBasicMaterial({ visible: false }));
    pick.position.y = Y0 + H / 2;
    pick.userData.caseIndex = caseIndex;
    g.add(pick);
    cars.push({ caseIndex, group: g, lid, pick, paint, inside, wheels, open: 0, openTarget: 0, hover: 0, hoverTarget: 0, locked: false, lockMat: winMat, x, len: LEN, wheelR: wheels.map(() => 0.45) });
  });

  // ---------- Паровоз ----------
  const loco = new THREE.Group();
  loco.position.x = front - LOCO / 2;
  train.add(loco);
  const lpaint = std(GREEN, { roughness: 0.35, metalness: 0.35 });
  const lred = std(RED, { roughness: 0.45, metalness: 0.3 });
  const black = std("#111215", { roughness: 0.5, metalness: 0.5 });
  const gold = std(GOLD, { roughness: 0.25, metalness: 0.9 });
  const fx = LOCO / 2; // нос
  // рама и путеочиститель
  loco.add(box(LOCO - 1, 0.55, 2.4, lred, -0.3, 1.0, 0));
  const pilotShape = new THREE.Shape();
  pilotShape.moveTo(0, 0);
  pilotShape.lineTo(1.1, 0);
  pilotShape.lineTo(0, 1.0);
  pilotShape.closePath();
  const pilot = new THREE.Mesh(new THREE.ExtrudeGeometry(pilotShape, { depth: 2.3, bevelEnabled: false }).translate(0, 0, -1.15), lred);
  pilot.position.set(fx - 0.9, 0.25, 0);
  loco.add(pilot);
  // котёл
  const boiler = new THREE.Mesh(new THREE.CylinderGeometry(1.12, 1.12, 6.6, 32).rotateZ(Math.PI / 2), lpaint);
  boiler.position.set(fx - 4.6, 2.45, 0);
  loco.add(boiler);
  for (const bx of [-6.9, -5.3, -3.7, -2.4]) {
    const band = new THREE.Mesh(new THREE.TorusGeometry(1.135, 0.04, 8, 40).rotateY(Math.PI / 2), gold);
    band.position.set(fx + bx, 2.45, 0);
    loco.add(band);
  }
  // дымовая коробка и лицо
  const smoke = new THREE.Mesh(new THREE.CylinderGeometry(1.22, 1.22, 1.4, 32).rotateZ(Math.PI / 2), black);
  smoke.position.set(fx - 0.95, 2.45, 0);
  loco.add(smoke);
  const face = new THREE.Mesh(new THREE.CircleGeometry(1.22, 40).rotateY(Math.PI / 2), std("#0b0c0e", { roughness: 0.6 }));
  face.position.set(fx - 0.24, 2.45, 0);
  loco.add(face);
  // неоновая снежинка
  const neon = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 2.8, 3.4) });
  const flake = new THREE.Group();
  for (let i = 0; i < 6; i++) {
    const arm = new THREE.Group();
    arm.rotation.x = (i * Math.PI) / 3;
    const bar = box(0.03, 0.9, 0.05, neon, 0, 0.45, 0);
    arm.add(bar);
    for (const sgn of [-1, 1]) {
      const br = box(0.03, 0.3, 0.04, neon, 0, 0.62, sgn * 0.1);
      br.rotation.x = sgn * 0.75;
      arm.add(br);
      const br2 = box(0.03, 0.2, 0.04, neon, 0, 0.34, sgn * 0.07);
      br2.rotation.x = sgn * 0.75;
      arm.add(br2);
    }
    flake.add(arm);
  }
  flake.position.set(fx - 0.2, 2.45, 0);
  loco.add(flake);
  // неоновые завитки под снежинкой
  const swirlMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(3.2, 1.8, 0.5) });
  for (const sgn of [-1, 1]) {
    const arc = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.025, 6, 24, Math.PI * 1.5).rotateY(Math.PI / 2), swirlMat);
    arc.position.set(fx - 0.2, 1.55, sgn * 0.45);
    arc.rotation.x = sgn * 0.8;
    loco.add(arc);
  }
  loco.add(box(0.04, 0.04, 1.6, swirlMat, fx - 0.2, 1.32, 0));
  // труба, купола
  const chimney = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.3, 1.3, 20), black);
  chimney.position.set(fx - 1.1, 4.05, 0);
  loco.add(chimney);
  for (const [dx, r] of [[-3.2, 0.48], [-5.0, 0.42]] as const) {
    const dome = new THREE.Mesh(new THREE.SphereGeometry(r, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), gold);
    dome.position.set(fx + dx, 3.5, 0);
    dome.scale.y = 1.2;
    loco.add(dome);
  }
  // прожектор
  const lampHouse = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.5, 20).rotateZ(Math.PI / 2), black);
  lampHouse.position.set(fx - 0.45, 3.85, 0);
  loco.add(lampHouse);
  const lampGlass = new THREE.Mesh(new THREE.CircleGeometry(0.27, 24).rotateY(Math.PI / 2), new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 3.6, 2.8) }));
  lampGlass.position.set(fx - 0.19, 3.85, 0);
  loco.add(lampGlass);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: new THREE.Color(1.6, 1.4, 1.0), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  halo.position.set(fx + 0.2, 3.85, 0);
  halo.scale.setScalar(3.4);
  loco.add(halo);
  for (const z of [-0.8, 0.8]) {
    const small = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 2.4, 1.5) }));
    small.position.set(fx - 0.1, 1.25, z);
    loco.add(small);
  }
  const spot = new THREE.SpotLight("#ffe2b0", 260, 90, 0.42, 0.55, 1.4);
  spot.position.set(fx + 0.2, 3.85, 0);
  spot.target.position.set(fx + 40, 0, 0);
  loco.add(spot, spot.target);
  // луч в снегу
  const beam = new THREE.Mesh(new THREE.ConeGeometry(4.5, 34, 24, 1, true).rotateZ(Math.PI / 2), new THREE.MeshBasicMaterial({ map: beamTex(), transparent: true, opacity: 0.16, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
  beam.position.set(fx + 17, 2.6, 0);
  beam.rotation.z = -0.05;
  loco.add(beam);
  // будка машиниста
  const cabX = -LOCO / 2 + 4.4;
  const cab = new THREE.Group();
  cab.position.x = cabX;
  loco.add(cab);
  for (const z of [-1, 1]) cab.add(box(2.6, 2.9, 0.1, lpaint, 0, 2.95, z * 1.3));
  cab.add(box(0.1, 2.9, 2.6, lpaint, 1.25, 2.95, 0));
  cab.add(box(0.1, 1.4, 2.6, lpaint, -1.25, 2.2, 0));
  const cabWin = new THREE.MeshBasicMaterial({ color: WARM.clone() });
  windowMats.push(cabWin);
  for (const z of [-1, 1]) {
    const w1 = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.85), cabWin);
    w1.position.set(0.2, 3.5, z * 1.36);
    if (z < 0) w1.rotation.y = Math.PI;
    cab.add(w1);
  }
  for (const z of [-0.6, 0.6]) {
    const fw = new THREE.Mesh(new THREE.CircleGeometry(0.3, 18).rotateY(Math.PI / 2), cabWin);
    fw.position.set(1.31, 3.7, z);
    cab.add(fw);
  }
  const cabInside = interiorCab();
  cab.add(cabInside.g);
  const cabLid = new THREE.Group();
  cabLid.position.y = 4.45;
  const cabRoof = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 3.0, 24).rotateZ(Math.PI / 2), std("#2a2d33"));
  cabRoof.scale.set(1, 0.22, 0.95);
  cabLid.add(cabRoof);
  const cabSnow = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.3, 2.7, 20).rotateZ(Math.PI / 2), std("#f2f6ff", { roughness: 0.9 }));
  cabSnow.scale.set(1, 0.16, 0.9);
  cabSnow.position.y = 0.12;
  cabLid.add(cabSnow);
  cab.add(cabLid);
  // тендер
  const tx = -LOCO / 2 + 1.5;
  loco.add(box(2.8, 2.1, 2.6, lpaint, tx, 2.2, 0));
  loco.add(box(2.82, 0.35, 2.62, lred, tx, 1.35, 0));
  const coal = new THREE.Mesh(new THREE.DodecahedronGeometry(1.2, 0), std("#1a1a1c", { roughness: 1 }));
  coal.scale.set(1.1, 0.45, 0.95);
  coal.position.set(tx, 3.3, 0);
  loco.add(coal);
  const coalSnow = new THREE.Mesh(new THREE.DodecahedronGeometry(1.0, 0), std("#eef3fb", { roughness: 1 }));
  coalSnow.scale.set(1.0, 0.3, 0.8);
  coalSnow.position.set(tx, 3.55, 0);
  loco.add(coalSnow);
  // колёса паровоза
  const locoWheels: THREE.Mesh[] = [];
  for (const z of [-1, 1]) {
    for (const [wx, r] of [[fx - 2.3, 0.5], [fx - 4.0, 0.82], [fx - 5.8, 0.82], [fx - 7.6, 0.82], [tx - 0.7, 0.45], [tx + 0.7, 0.45]] as const) {
      const wm = wheel(r, wheelMat);
      wm.position.set(wx, r + 0.55, z * 1.12);
      wm.userData.wheel = true;
      loco.add(wm);
      locoWheels.push(wm);
      allWheels.push({ m: wm, r });
    }
    // шатун
    const rod = box(3.8, 0.12, 0.08, std("#c7ccd6", { metalness: 0.9, roughness: 0.2 }), fx - 5.8, 1.37, z * 1.25);
    rod.userData.rod = true;
    rod.userData.wheel = true;
    loco.add(rod);
  }
  // гирлянда паровоза
  for (const z of [-1, 1]) {
    garland.add(new THREE.Vector3(front - LOCO + 0.2, 3.78, z * 1.36), new THREE.Vector3(front - LOCO + 2.9, 3.78, z * 1.36));
    garland.add(new THREE.Vector3(front - 7.5, 3.45, z * 1.02), new THREE.Vector3(front - 1.6, 3.45, z * 1.02), 0.3, 0.06);
    garland.add(new THREE.Vector3(front - LOCO + 3.1, 4.95, z * 1.48), new THREE.Vector3(front - LOCO + 5.7, 4.95, z * 1.48), 0.3, 0.05);
  }
  const locoPaint = lpaint;
  const locoInside = new THREE.PointLight("#ffb46a", 0, 7, 1.6);
  locoInside.position.set(0, 3.6, 0);
  cab.add(locoInside);
  const locoPick = new THREE.Mesh(new THREE.BoxGeometry(LOCO + 0.4, 5, 3.4), new THREE.MeshBasicMaterial({ visible: false }));
  locoPick.position.y = 2.5;
  locoPick.userData.caseIndex = 4;
  loco.add(locoPick);
  cars.unshift({ caseIndex: 4, group: loco, lid: cabLid, pick: locoPick, paint: locoPaint, inside: locoInside, wheels: locoWheels, open: 0, openTarget: 0, hover: 0, hoverTarget: 0, locked: false, lockMat: cabWin, x: front - LOCO / 2, len: LOCO, wheelR: [] });
  // свет от паровоза на снегу
  for (const z of [-1, 1]) {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(6, 3.5).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: spill, transparent: true, opacity: 0.6, depthWrite: false, blending: THREE.AdditiveBlending }));
    p.position.set(cabX, 0.06, z * 3);
    loco.add(p);
  }

  // корпус паровоза над колёсами
  for (const ch of loco.children) if (!ch.userData.wheel) ch.position.y += 0.45;
  garland.build(train);

  const chimneyWorld = new THREE.Vector3(front - 1.1, 5.25, 0);
  let gt = 0;
  const rods = loco.children.filter((c) => c.userData.rod);
  const leds: THREE.Object3D[] = [];
  train.traverse((o) => o.userData.blink !== undefined && leds.push(o));

  return {
    group: train,
    cars,
    chimney: chimneyWorld,
    pickables: cars.map((c) => c.pick),
    carByCase: (i: number) => cars.find((c) => c.caseIndex === i)!,
    update(dt: number, t: number, speed: number) {
      for (const w of allWheels) w.m.rotation.z -= (speed * dt) / w.r;
      const ang = locoWheels[1]?.rotation.z ?? 0;
      rods.forEach((r, i) => {
        r.position.y = 1.37 + Math.sin(ang + i * Math.PI) * 0.32;
        r.position.x = fx - 5.8 + Math.cos(ang + i * Math.PI) * 0.32;
      });
      cars.forEach((c, i) => {
        c.group.position.y = Math.sin(t * 9 + i * 1.3) * 0.012 + Math.sin(t * 2.1 + i) * 0.01;
        c.group.rotation.x = Math.sin(t * 1.4 + i * 0.8) * 0.004;
        c.open += (c.openTarget - c.open) * Math.min(1, dt * 3);
        c.hover += (c.hoverTarget - c.hover) * Math.min(1, dt * 8);
        const o = c.open;
        c.lid.position.y = (c.caseIndex === 4 ? 4.45 : Y0 + H) + o * 3.2;
        c.lid.rotation.x = o * 0.35;
        c.lid.position.z = -o * 0.9;
        c.inside.intensity = o * (c.caseIndex === 4 ? 7 : 18);
        c.paint.emissive.set("#19AA1E");
        c.paint.emissiveIntensity = c.hover * 0.35;
        c.lockMat.color.copy(WARM).multiplyScalar(c.locked ? 0.25 : 1);
      });
      gt += dt;
      if (gt > 0.08) {
        garland.twinkle(t);
        cabInside.update(t);
        for (const l of leds) l.visible = Math.sin(t * (2 + (l.userData.blink % 3)) + l.userData.blink * 1.7) > -0.4;
        gt = 0;
      }
      flake.rotation.x = Math.sin(t * 0.4) * 0.05;
      neon.color.setRGB(2.4, 2.8, 3.4).multiplyScalar(0.9 + 0.1 * Math.sin(t * 6) * Math.sin(t * 2.3));
      halo.material.opacity = 0.85 + 0.15 * Math.sin(t * 13);
    },
    windowMats,
  };
}

/**
 * Будка машиниста изнутри: задняя стенка котла с топкой, манометры, водомерное стекло,
 * регулятор, колесо реверса, кран тормоза, медные трубки, лопата и уголь, два сиденья,
 * фонарь, гирлянда, чай в подстаканнике, часы на 23:59 и красная кнопка «ДЕПЛОЙ» под колпаком.
 * Координаты будки: пол y≈1.5, котёл впереди (+x), тендер сзади (−x).
 */
function interiorCab() {
  const g = new THREE.Group();
  const F = 1.52; // пол
  const iron = std("#24272d", { metalness: 0.6, roughness: 0.45 });
  const brass = std("#c9a24a", { metalness: 0.9, roughness: 0.25 });
  const copper = std("#b8643a", { metalness: 0.85, roughness: 0.3 });
  const wood = std("#6b4128", { roughness: 0.8 });
  const red = std("#a3262b", { roughness: 0.5 });
  const cushion = std("#7a2430", { roughness: 0.9 });
  const add = <T extends THREE.Object3D>(o: T, x: number, y: number, z: number) => {
    o.position.set(x, y, z);
    g.add(o);
    return o;
  };

  // дощатый пол
  for (let i = 0; i < 6; i++) add(box(2.4, 0.05, 0.4, std(i % 2 ? "#5a3822" : "#4e301d", { roughness: 0.95 }), 0, F, -1.0 + i * 0.4), 0, F, -1.0 + i * 0.4);

  // задняя стенка котла: тёмный полукруг с латунным ободом
  add(new THREE.Mesh(new THREE.CircleGeometry(1.05, 36, 0, Math.PI).rotateY(-Math.PI / 2), iron), 1.12, F + 0.7, 0);
  add(new THREE.Mesh(new THREE.TorusGeometry(1.05, 0.035, 8, 40, Math.PI).rotateY(-Math.PI / 2), brass), 1.1, F + 0.7, 0);
  add(box(0.12, 0.7, 2.1, iron), 1.14, F + 0.35, 0);

  // топка: дверца с огнём, который мерцает
  add(box(0.08, 0.62, 0.86, std("#1a1b1f", { metalness: 0.7 })), 1.06, F + 0.55, 0);
  const fireMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(3.6, 1.3, 0.25) });
  const fire = add(new THREE.Mesh(new THREE.PlaneGeometry(0.66, 0.4).rotateY(-Math.PI / 2), fireMat), 1.01, F + 0.53, 0);
  for (const dz of [-0.2, 0, 0.2]) add(box(0.03, 0.42, 0.05, std("#111", { metalness: 0.8 })), 1.0, F + 0.53, dz);
  add(box(0.06, 0.06, 0.3, brass), 0.97, F + 0.82, 0);
  // отблеск огня на полу
  const glowMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 0.6, 0.15), transparent: true, opacity: 0.45, depthWrite: false, blending: THREE.AdditiveBlending });
  const floorGlow = add(new THREE.Mesh(new THREE.CircleGeometry(0.75, 24).rotateX(-Math.PI / 2), glowMat), 0.45, F + 0.035, 0);

  // манометры: латунный обод, белый циферблат, стрелка дрожит
  const needles: { m: THREE.Mesh; base: number; ph: number }[] = [];
  const dial = canvasTex(128, 128, (c) => {
    c.fillStyle = "#f6f1e1";
    c.beginPath();
    c.arc(64, 64, 62, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = "#1a1a1a";
    c.lineWidth = 4;
    for (let i = 0; i <= 10; i++) {
      const a = Math.PI * 0.75 + (i / 10) * Math.PI * 1.5;
      c.beginPath();
      c.moveTo(64 + Math.cos(a) * 46, 64 + Math.sin(a) * 46);
      c.lineTo(64 + Math.cos(a) * 56, 64 + Math.sin(a) * 56);
      c.stroke();
    }
    c.strokeStyle = "#e5484d";
    c.lineWidth = 8;
    c.beginPath();
    c.arc(64, 64, 51, Math.PI * 0.05, Math.PI * 0.25);
    c.stroke();
  });
  for (const [z, r] of [[-0.42, 0.2], [0.42, 0.2], [0, 0.14]] as const) {
    const y = z === 0 ? F + 1.55 : F + 1.3;
    add(new THREE.Mesh(new THREE.CylinderGeometry(r + 0.03, r + 0.03, 0.06, 24).rotateZ(Math.PI / 2), brass), 1.02, y, z);
    add(new THREE.Mesh(new THREE.CircleGeometry(r, 24).rotateY(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: dial, color: new THREE.Color(1.15, 1.12, 1.05) })), 0.985, y, z);
    const nd = new THREE.Mesh(new THREE.BoxGeometry(0.01, r * 0.8, 0.02).translate(0, r * 0.4, 0), new THREE.MeshBasicMaterial({ color: "#111" }));
    nd.rotation.y = Math.PI / 2;
    const holder = add(new THREE.Group(), 0.975, y, z);
    holder.add(nd);
    needles.push({ m: nd, base: -0.6 + Math.random() * 0.8, ph: Math.random() * 6 });
  }
  // водомерное стекло
  add(new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.55, 10), new THREE.MeshStandardMaterial({ color: "#cfe8ff", transparent: true, opacity: 0.45, roughness: 0.05 })), 0.99, F + 0.95, -0.8);
  add(new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.3, 10), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.4, 1.2, 2.2) })), 0.99, F + 0.84, -0.8);
  for (const dy of [-0.3, 0.3]) add(box(0.1, 0.06, 0.12, brass), 0.99, F + 0.95 + dy, -0.8);

  // медные трубки по котлу
  for (const [z, h] of [[-0.68, 1.1], [0.68, 1.1], [0.25, 0.7]] as const) add(new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, h, 8), copper), 1.0, F + 0.4 + h / 2, z);
  add(new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.4, 8).rotateX(Math.PI / 2), copper), 1.0, F + 1.5, 0);

  // регулятор: длинный латунный рычаг сверху
  const regulator = add(new THREE.Group(), 0.98, F + 1.85, 0.15);
  regulator.add(box(0.05, 0.05, 0.9, brass, 0, 0, 0.42));
  regulator.add(box(0.07, 0.18, 0.07, red, 0, -0.08, 0.86));
  regulator.rotation.x = -0.35;

  // колесо реверса слева и кран тормоза справа
  const rev = add(new THREE.Group(), 0.55, F + 1.0, -1.08);
  rev.add(new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.025, 8, 28), red));
  for (let i = 0; i < 3; i++) {
    const sp = box(0.44, 0.025, 0.025, red);
    sp.rotation.z = (i * Math.PI) / 3;
    rev.add(sp);
  }
  add(box(0.12, 1.0, 0.12, iron), 0.55, F + 0.5, -1.12);
  add(box(0.18, 0.3, 0.18, iron), 0.75, F + 0.9, 1.05);
  const brake = add(box(0.35, 0.04, 0.05, red), 0.62, F + 1.07, 1.05);
  brake.rotation.y = 0.5;

  // красная кнопка «ДЕПЛОЙ» под стеклянным колпаком и табличка
  add(box(0.42, 0.5, 0.3, iron), 0.1, F + 0.25, -0.98);
  const btnMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.6, 0.35, 0.3) });
  const btn = add(new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.1, 0.06, 20), btnMat), 0.1, F + 0.53, -0.98);
  add(new THREE.Mesh(new THREE.SphereGeometry(0.14, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: "#dff2ff", transparent: true, opacity: 0.3, roughness: 0.05 })), 0.1, F + 0.5, -0.98);
  const sign = canvasTex(256, 96, (c) => {
    c.fillStyle = "#ffb919";
    c.fillRect(0, 0, 256, 96);
    c.fillStyle = "#1a1a1a";
    c.fillRect(0, 0, 256, 10);
    c.fillRect(0, 86, 256, 10);
    c.textAlign = "center";
    c.font = "800 34px 'Golos Text', system-ui, sans-serif";
    c.fillText("ДЕПЛОЙ", 128, 46);
    c.font = "700 20px 'Golos Text', system-ui, sans-serif";
    c.fillText("не трогать до 00:00", 128, 76);
  });
  const signMesh = add(new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.16), new THREE.MeshBasicMaterial({ map: sign, color: new THREE.Color(1.1, 1.1, 1.1) })), 0.1, F + 0.505, -0.72);
  signMesh.rotation.x = -Math.PI / 2;

  // часы на стене будки: 23:59
  const clock = canvasTex(160, 160, (c) => {
    c.fillStyle = "#f6f1e1";
    c.beginPath();
    c.arc(80, 80, 76, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = "#c9a24a";
    c.lineWidth = 8;
    c.stroke();
    c.fillStyle = "#1a1a1a";
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      c.fillRect(80 + Math.sin(a) * 58 - 3, 80 - Math.cos(a) * 58 - 3, 6, 6);
    }
    c.strokeStyle = "#1a1a1a";
    c.lineCap = "round";
    c.lineWidth = 7;
    c.beginPath();
    c.moveTo(80, 80);
    c.lineTo(80 - 6, 80 - 40); // часовая почти на 12
    c.stroke();
    c.lineWidth = 4;
    c.beginPath();
    c.moveTo(80, 80);
    c.lineTo(80 - 6, 80 - 60); // минутная на 59
    c.stroke();
    c.font = "800 22px 'Golos Text', system-ui, sans-serif";
    c.textAlign = "center";
    c.fillStyle = "#e5484d";
    c.fillText("23:59", 80, 122);
  });
  const clockMesh = add(new THREE.Mesh(new THREE.CircleGeometry(0.2, 28), new THREE.MeshBasicMaterial({ map: clock, color: new THREE.Color(1.1, 1.1, 1.1) })), -0.2, F + 1.75, -1.19);

  // сиденья машиниста и помощника
  for (const z of [-0.9, 0.9]) {
    add(box(0.55, 0.06, 0.42, wood), -0.55, F + 0.62, z);
    add(box(0.5, 0.1, 0.38, cushion), -0.55, F + 0.7, z);
    add(box(0.08, 0.62, 0.08, iron), -0.55, F + 0.31, z);
  }
  // полочка с чаем в подстаканнике и мандаринами
  add(box(0.5, 0.04, 0.22, wood), -1.0, F + 1.15, -1.12);
  add(new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.065, 0.13, 12), brass), -1.1, F + 1.24, -1.12);
  add(new THREE.Mesh(new THREE.CylinderGeometry(0.062, 0.062, 0.1, 12), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 0.7, 0.18) })), -1.1, F + 1.31, -1.12);
  const orange = std("#ff8a1c", { roughness: 0.6, emissive: "#ff6a00", emissiveIntensity: 0.25 });
  for (const dz of [-0.06, 0.06]) add(new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), orange), -0.87, F + 1.24, -1.12 + dz);

  // уголь у выхода к тендеру и лопата
  const coal = std("#17181b", { roughness: 1, flatShading: true });
  for (let i = 0; i < 9; i++) {
    const lump = add(new THREE.Mesh(new THREE.DodecahedronGeometry(0.09 + (i % 3) * 0.03, 0), coal), -1.0 + (i % 3) * 0.14, F + 0.08 + Math.floor(i / 3) * 0.06, -0.25 + (i % 4) * 0.14);
    lump.rotation.set(i, i * 2, 0);
  }
  const shovel = add(new THREE.Group(), -0.75, F + 0.45, 0.35);
  shovel.add(box(0.04, 0.8, 0.04, wood, 0, 0.2, 0));
  shovel.add(box(0.28, 0.24, 0.03, iron, 0, -0.25, 0));
  shovel.rotation.z = 0.5;

  // фонарь под крышей и гирлянда по краю будки
  const lampMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 2.1, 1) });
  add(new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 8), lampMat), -0.3, F + 2.55, 0);
  add(box(0.02, 0.3, 0.02, iron), -0.3, F + 2.75, 0);
  const cols = [new THREE.Color(3, 0.5, 0.4), new THREE.Color(3, 2.4, 0.6), new THREE.Color(0.6, 2.6, 0.9), new THREE.Color(0.9, 1.6, 3.2)];
  const bulbs: THREE.MeshBasicMaterial[] = [];
  for (const z of [-1.2, 1.2])
    for (let i = 0; i < 9; i++) {
      const m = new THREE.MeshBasicMaterial({ color: cols[i % 4].clone() });
      bulbs.push(m);
      add(new THREE.Mesh(new THREE.SphereGeometry(0.045, 6, 4), m), -1.1 + i * 0.27, F + 2.75 - Math.sin(((i % 3) / 3) * Math.PI) * 0.08, z);
    }
  // табличка-номер на задней стенке
  const plaque = canvasTex(256, 80, (c) => {
    c.fillStyle = "#2b6b4d";
    c.fillRect(0, 0, 256, 80);
    c.strokeStyle = "#c9a24a";
    c.lineWidth = 6;
    c.strokeRect(4, 4, 248, 72);
    c.fillStyle = "#f2e2b0";
    c.font = "800 36px 'Golos Text', system-ui, sans-serif";
    c.textAlign = "center";
    c.fillText("РЕЛИЗ-2027", 128, 52);
  });
  add(new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.19).rotateY(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: plaque, color: new THREE.Color(1.1, 1.1, 1.1) })), 0.99, F + 2.05, 0);
  void clockMesh;

  return {
    g,
    update(t: number) {
      // огонь дышит, стрелки дрожат, кнопка подмигивает, гирлянда мерцает
      const k = 0.75 + 0.25 * Math.sin(t * 13) * Math.sin(t * 7.3 + 1) + 0.1 * Math.sin(t * 31);
      fireMat.color.setRGB(3.6 * k, 1.3 * k, 0.25 * k);
      glowMat.opacity = 0.3 + 0.2 * k;
      fire.scale.y = 0.9 + 0.1 * k;
      floorGlow.scale.setScalar(0.92 + 0.12 * k);
      for (const n of needles) n.m.parent!.rotation.x = n.base + Math.sin(t * 3 + n.ph) * 0.06 + Math.sin(t * 17 + n.ph) * 0.02;
      btnMat.color.setRGB(2.6 * (0.7 + 0.3 * Math.sin(t * 4)), 0.35, 0.3);
      btn.scale.y = 1 + 0.15 * Math.max(0, Math.sin(t * 4));
      bulbs.forEach((m, i) => {
        const v = 0.45 + 0.55 * Math.max(0, Math.sin(t * 3 + i * 1.7));
        m.color.copy(cols[i % 4]).multiplyScalar(v);
      });
    },
  };
}
