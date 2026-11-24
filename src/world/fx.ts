// Снег, пар, Санта на оленях, финальная ёлка с салютом.
import * as THREE from "three";
import { softDot } from "./tex";

/** Снег тремя слоями: всё в шейдере, процессор не трогаем. */
export function makeSnow(scene: THREE.Scene, count: number) {
  const box = new THREE.Vector3(160, 50, 140);
  const pos = new Float32Array(count * 3);
  const seed = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    pos.set([Math.random() * box.x, Math.random() * box.y, Math.random() * box.z], i * 3);
    seed[i] = Math.random();
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setAttribute("seed", new THREE.BufferAttribute(seed, 1));
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {
      t: { value: 0 },
      drift: { value: 0 },
      box: { value: box },
      center: { value: new THREE.Vector3() },
      map: { value: softDot() },
      px: { value: Math.min(window.devicePixelRatio, 2) },
    },
    vertexShader: `attribute float seed; uniform float t, drift, px; uniform vec3 box, center; varying float a;
      void main(){
        vec3 p = position;
        float sp = 1.6 + seed*2.2;
        p.y = mod(p.y - t*sp, box.y);
        p.x = mod(p.x - drift*(0.55 + seed*0.5) + sin(t*0.7 + seed*40.0)*1.5, box.x);
        p.z = mod(p.z + sin(t*0.5 + seed*17.0)*1.2, box.z);
        p += center - vec3(box.x*0.5, 0.0, box.z*0.5);
        vec4 mv = modelViewMatrix*vec4(p,1.0);
        float size = (seed < 0.08 ? 7.0 : seed < 0.4 ? 3.2 : 1.8) * px;
        gl_PointSize = size * (60.0 / -mv.z);
        a = smoothstep(0.0, 4.0, p.y) * (seed < 0.08 ? 0.55 : 0.9);
        gl_Position = projectionMatrix*mv;
      }`,
    fragmentShader: `uniform sampler2D map; varying float a; void main(){ vec4 c = texture2D(map, gl_PointCoord); gl_FragColor = vec4(vec3(0.92,0.95,1.0), c.a*a); }`,
  });
  const pts = new THREE.Points(g, mat);
  pts.frustumCulled = false;
  scene.add(pts);
  return {
    update(t: number, travelled: number, center: THREE.Vector3) {
      mat.uniforms.t.value = t;
      mat.uniforms.drift.value = travelled;
      mat.uniforms.center.value.copy(center);
    },
  };
}

/** Пар из трубы: клубы растут, сносятся назад и тают. */
export function makeSteam(scene: THREE.Scene, origin: THREE.Vector3) {
  const N = 90;
  const pos = new Float32Array(N * 3);
  const size = new Float32Array(N);
  const alpha = new Float32Array(N);
  const life = new Float32Array(N).map(() => Math.random() * 4);
  const vel = Array.from({ length: N }, () => new THREE.Vector3());
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setAttribute("size", new THREE.BufferAttribute(size, 1));
  g.setAttribute("alpha", new THREE.BufferAttribute(alpha, 1));
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: { map: { value: softDot() }, px: { value: Math.min(window.devicePixelRatio, 2) } },
    vertexShader: `attribute float size, alpha; uniform float px; varying float a; varying float h;
      void main(){ vec4 mv = modelViewMatrix*vec4(position,1.); gl_PointSize = size*px*(300.0/-mv.z); a = alpha; h = position.y; gl_Position = projectionMatrix*mv; }`,
    fragmentShader: `uniform sampler2D map; varying float a; varying float h;
      void main(){ vec4 c = texture2D(map, gl_PointCoord);
        vec3 warm = vec3(1.0,0.86,0.68); vec3 cold = vec3(0.72,0.8,0.95);
        gl_FragColor = vec4(mix(warm, cold, clamp((h-5.0)/9.0,0.0,1.0)), c.a*a); }`,
  });
  const pts = new THREE.Points(g, mat);
  pts.frustumCulled = false;
  scene.add(pts);
  const reset = (i: number) => {
    pos.set([origin.x + (Math.random() - 0.5) * 0.3, origin.y, origin.z + (Math.random() - 0.5) * 0.3], i * 3);
    vel[i].set(-2 - Math.random(), 3.2 + Math.random() * 1.5, (Math.random() - 0.5) * 0.8);
    life[i] = 0;
  };
  for (let i = 0; i < N; i++) reset(i);
  return {
    update(dt: number, speed: number) {
      for (let i = 0; i < N; i++) {
        life[i] += dt;
        const L = 4.2;
        if (life[i] > L) reset(i);
        const k = life[i] / L;
        vel[i].y *= 1 - dt * 0.6;
        vel[i].x -= dt * speed * 0.35;
        pos[i * 3] += vel[i].x * dt;
        pos[i * 3 + 1] += vel[i].y * dt;
        pos[i * 3 + 2] += vel[i].z * dt;
        size[i] = 1.2 + k * 7;
        alpha[i] = Math.min(1, k * 8) * (1 - k) * 0.55;
      }
      g.attributes.position.needsUpdate = true;
      g.attributes.size.needsUpdate = true;
      g.attributes.alpha.needsUpdate = true;
    },
  };
}

/** Санта на оленях. Пролетает раз в 30–50 секунд со случайной стороны. */
export function makeSanta(scene: THREE.Scene) {
  const g = new THREE.Group();
  const red = new THREE.MeshStandardMaterial({ color: "#c0262d", roughness: 0.4, metalness: 0.2 });
  const gold = new THREE.MeshStandardMaterial({ color: "#d9b25a", metalness: 0.9, roughness: 0.25 });
  const brown = new THREE.MeshStandardMaterial({ color: "#6a4630", roughness: 0.8 });
  const sleigh = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.9, 1.3), red);
  sleigh.position.set(0, 0.45, 0);
  g.add(sleigh);
  const back = new THREE.Mesh(new THREE.BoxGeometry(0.4, 1.0, 1.3), red);
  back.position.set(-1.0, 1.0, 0);
  g.add(back);
  for (const z of [-0.6, 0.6]) {
    const runner = new THREE.Mesh(new THREE.TorusGeometry(1.2, 0.06, 6, 20, Math.PI * 0.8), gold);
    runner.position.set(0.1, 0.2, z);
    runner.rotation.z = Math.PI * 1.1;
    runner.scale.y = 0.35;
    g.add(runner);
  }
  const santa = new THREE.Mesh(new THREE.SphereGeometry(0.45, 12, 10), red);
  santa.position.set(-0.4, 1.2, 0);
  g.add(santa);
  const beard = new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 8), new THREE.MeshStandardMaterial({ color: "#ffffff" }));
  beard.position.set(-0.15, 1.45, 0);
  g.add(beard);
  const sack = new THREE.Mesh(new THREE.SphereGeometry(0.5, 10, 8), new THREE.MeshStandardMaterial({ color: "#2c6b3f" }));
  sack.position.set(-0.75, 1.25, 0.2);
  g.add(sack);
  const deer: THREE.Group[] = [];
  for (let i = 0; i < 4; i++) {
    const d = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.7, 4, 8).rotateZ(Math.PI / 2), brown);
    d.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 6), brown);
    head.position.set(0.55, 0.3, 0);
    d.add(head);
    for (const z of [-0.08, 0.08]) {
      const antler = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.03, 0.4, 4), gold);
      antler.position.set(0.5, 0.55, z);
      antler.rotation.z = -0.4;
      d.add(antler);
    }
    if (i === 3) {
      const nose = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 0.4, 0.3) }));
      nose.position.set(0.72, 0.3, 0);
      d.add(nose);
    }
    d.position.set(2.2 + Math.floor(i / 2) * 1.3, 0.6, i % 2 ? 0.45 : -0.45);
    g.add(d);
    deer.push(d);
  }
  // искристый хвост
  const T = 140;
  const tp = new Float32Array(T * 3);
  const tg = new THREE.BufferGeometry();
  tg.setAttribute("position", new THREE.BufferAttribute(tp, 3));
  const trail = new THREE.Points(tg, new THREE.PointsMaterial({ map: softDot(), size: 0.9, color: new THREE.Color(2.6, 2.2, 1.2), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  trail.frustumCulled = false;
  scene.add(trail);
  g.scale.setScalar(2.2);
  g.visible = false;
  scene.add(g);
  const hit = new THREE.Mesh(new THREE.SphereGeometry(4, 8, 6), new THREE.MeshBasicMaterial({ visible: false }));
  hit.position.set(1.5, 0.8, 0);
  g.add(hit);

  let next = 12 + Math.random() * 10;
  let tFly = -1;
  const dur = 9;
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  let ti = 0;
  const prev = new THREE.Vector3();
  return {
    hit,
    flying: () => g.visible,
    update(dt: number, t: number, allowed: boolean) {
      if (tFly < 0) {
        next -= dt;
        if (next <= 0 && allowed) {
          const dir = Math.random() < 0.5 ? 1 : -1;
          const z = -20 - Math.random() * 40;
          a.set(-dir * 140, 18 + Math.random() * 10, z - 30);
          c.set(dir * 140, 22 + Math.random() * 14, z + 10 + Math.random() * 20);
          b.set((Math.random() - 0.5) * 40, 32 + Math.random() * 10, z);
          tFly = 0;
          g.visible = true;
        }
        for (let i = 0; i < T; i++) tp[i * 3 + 1] -= dt * 2;
        tg.attributes.position.needsUpdate = true;
        return;
      }
      tFly += dt;
      const k = tFly / dur;
      if (k >= 1) {
        tFly = -1;
        g.visible = false;
        next = 30 + Math.random() * 20;
        return;
      }
      prev.copy(g.position);
      const p = new THREE.Vector3().copy(a).multiplyScalar((1 - k) ** 2).addScaledVector(b, 2 * (1 - k) * k).addScaledVector(c, k * k);
      g.position.copy(p);
      const dir = p.clone().sub(prev);
      if (dir.lengthSq() > 1e-6) g.rotation.y = Math.atan2(-dir.z, dir.x);
      deer.forEach((d, i) => (d.position.y = 0.6 + Math.sin(t * 10 + i) * 0.12));
      tp.set([p.x - Math.cos(g.rotation.y) * 2 + (Math.random() - 0.5), p.y + 1 + (Math.random() - 0.5), p.z + Math.sin(g.rotation.y) * 2 + (Math.random() - 0.5)], (ti % T) * 3);
      ti++;
      for (let i = 0; i < T; i++) tp[i * 3 + 1] -= dt * 1.5;
      tg.attributes.position.needsUpdate = true;
    },
  };
}

/** Финал: огромная ёлка, которая вырастает рядом с путём, и салют. */
export function makeFinaleTree(scene: THREE.Scene) {
  const g = new THREE.Group();
  g.visible = false;
  scene.add(g);
  const green = new THREE.MeshStandardMaterial({ color: "#1d5a3c", roughness: 0.7, flatShading: true });
  const snow = new THREE.MeshStandardMaterial({ color: "#eef4ff", roughness: 0.9, flatShading: true });
  const tiers = 7;
  for (let i = 0; i < tiers; i++) {
    const r = 9 - i * 1.15;
    const h = 7;
    const cone = new THREE.Mesh(new THREE.ConeGeometry(r, h, 14), green);
    cone.position.y = 3 + i * 4.2 + h / 2;
    g.add(cone);
    const cap = new THREE.Mesh(new THREE.ConeGeometry(r * 0.6, h * 0.35, 14), snow);
    cap.position.y = 3 + i * 4.2 + h * 0.85;
    g.add(cap);
  }
  // огни спиралью
  const n = 420;
  const lp = new Float32Array(n * 3);
  const lc = new Float32Array(n * 3);
  const pal = [new THREE.Color(3, 2.3, 1), new THREE.Color(3, 0.6, 0.4), new THREE.Color(0.6, 2.8, 1.0), new THREE.Color(1, 1.8, 3.4), new THREE.Color(3, 2.8, 0.6)];
  for (let i = 0; i < n; i++) {
    const k = i / n;
    const y = 3 + k * 32;
    const r = (1 - k) * 9.2 + 0.4;
    const a = k * Math.PI * 22;
    lp.set([Math.cos(a) * r, y, Math.sin(a) * r], i * 3);
    const c = pal[i % pal.length];
    lc.set([c.r, c.g, c.b], i * 3);
  }
  const lg = new THREE.BufferGeometry();
  lg.setAttribute("position", new THREE.BufferAttribute(lp, 3));
  lg.setAttribute("color", new THREE.BufferAttribute(lc, 3));
  const lights = new THREE.Points(lg, new THREE.PointsMaterial({ map: softDot(), size: 1.3, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  g.add(lights);
  // звезда
  const starShape = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 ? 1.1 : 2.6;
    const a = (i / 10) * Math.PI * 2 + Math.PI / 2;
    const x = Math.cos(a) * r, y = Math.sin(a) * r;
    if (i) starShape.lineTo(x, y);
    else starShape.moveTo(x, y);
  }
  const star = new THREE.Mesh(new THREE.ExtrudeGeometry(starShape, { depth: 0.5, bevelEnabled: false }).center(), new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 3.2, 1.2) }));
  star.position.y = 38;
  g.add(star);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: softDot(), color: new THREE.Color(2.5, 2, 1), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  halo.scale.setScalar(16);
  halo.position.y = 38;
  g.add(halo);

  // салют
  const F = 600;
  const fp = new Float32Array(F * 3);
  const fc = new Float32Array(F * 3);
  const fv = Array.from({ length: F }, () => new THREE.Vector3());
  const fg = new THREE.BufferGeometry();
  fg.setAttribute("position", new THREE.BufferAttribute(fp, 3));
  fg.setAttribute("color", new THREE.BufferAttribute(fc, 3));
  const fw = new THREE.Points(fg, new THREE.PointsMaterial({ map: softDot(), size: 1.1, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  fw.frustumCulled = false;
  g.add(fw);
  let burstT = 0;
  let burst = 0;
  const boom = () => {
    const per = 120;
    const base = (burst % 5) * per;
    const c = pal[burst % pal.length];
    const center = new THREE.Vector3((Math.random() - 0.5) * 50, 42 + Math.random() * 18, (Math.random() - 0.5) * 30);
    for (let i = 0; i < per; i++) {
      const j = base + i;
      fp.set([center.x, center.y, center.z], j * 3);
      fv[j].randomDirection().multiplyScalar(9 + Math.random() * 4);
      fc.set([c.r, c.g, c.b], j * 3);
    }
    burst++;
  };
  let grow = 0;
  return {
    group: g,
    start(at: THREE.Vector3) {
      g.position.copy(at);
      g.visible = true;
      grow = 0;
    },
    update(dt: number, t: number) {
      if (!g.visible) return;
      grow = Math.min(1, grow + dt * 0.35);
      const e = 1 - Math.pow(1 - grow, 3);
      g.scale.set(e, e, e);
      star.rotation.y = t;
      (lights.material as THREE.PointsMaterial).size = 1.1 + Math.sin(t * 4) * 0.25;
      burstT -= dt;
      if (grow > 0.8 && burstT <= 0) {
        boom();
        burstT = 0.9 + Math.random() * 0.8;
      }
      for (let i = 0; i < F; i++) {
        fv[i].y -= dt * 6;
        fv[i].multiplyScalar(1 - dt * 0.9);
        fp[i * 3] += fv[i].x * dt;
        fp[i * 3 + 1] += fv[i].y * dt;
        fp[i * 3 + 2] += fv[i].z * dt;
        fc[i * 3] *= 1 - dt * 0.7;
        fc[i * 3 + 1] *= 1 - dt * 0.7;
        fc[i * 3 + 2] *= 1 - dt * 0.7;
      }
      fg.attributes.position.needsUpdate = true;
      fg.attributes.color.needsUpdate = true;
    },
  };
}
