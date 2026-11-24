// Небо синего часа: градиент, звёзды, луна, северное сияние, горы на горизонте.
import * as THREE from "three";
import { softDot } from "./tex";

export function makeSky(scene: THREE.Scene) {
  const group = new THREE.Group();
  scene.add(group);

  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      top: { value: new THREE.Color("#03081a") },
      mid: { value: new THREE.Color("#0f2250") },
      horizon: { value: new THREE.Color("#3b5f99") },
      glow: { value: new THREE.Color("#7aa0d8") },
    },
    vertexShader: `varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
    fragmentShader: `uniform vec3 top, mid, horizon, glow; varying vec3 vP;
      void main(){
        float h = vP.y;
        vec3 c = mix(horizon, mid, smoothstep(0.0, 0.25, h));
        c = mix(c, top, smoothstep(0.25, 0.85, h));
        c += glow * 0.35 * exp(-abs(h) * 14.0);
        c = mix(c, horizon*0.6, step(h, 0.0));
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(950, 32, 16), skyMat);
  group.add(sky);

  // Звёзды
  const n = 1400;
  const pos = new Float32Array(n * 3);
  const tw = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const u = Math.random() * Math.PI * 2;
    const v = Math.acos(1 - Math.random() * 0.9) ; // верхняя полусфера
    const r = 900;
    pos[i * 3] = r * Math.sin(v) * Math.cos(u);
    pos[i * 3 + 1] = r * Math.cos(v) + 20;
    pos[i * 3 + 2] = r * Math.sin(v) * Math.sin(u);
    tw[i] = Math.random() * 6.28;
  }
  const sg = new THREE.BufferGeometry();
  sg.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  sg.setAttribute("tw", new THREE.BufferAttribute(tw, 1));
  const starMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    fog: false,
    blending: THREE.AdditiveBlending,
    uniforms: { t: { value: 0 }, map: { value: softDot() } },
    vertexShader: `attribute float tw; uniform float t; varying float a;
      void main(){ a = 0.45 + 0.55*sin(t*1.7 + tw*3.0); vec4 mv = modelViewMatrix*vec4(position,1.); gl_PointSize = 2.2 + 1.6*fract(tw); gl_Position = projectionMatrix*mv; }`,
    fragmentShader: `uniform sampler2D map; varying float a; void main(){ vec4 c = texture2D(map, gl_PointCoord); gl_FragColor = vec4(vec3(0.85,0.9,1.0), c.a*a); }`,
  });
  group.add(new THREE.Points(sg, starMat));

  // Луна
  const moon = new THREE.Sprite(new THREE.SpriteMaterial({ map: softDot(), color: new THREE.Color(1.6, 1.65, 1.8), fog: false, depthWrite: false }));
  moon.scale.setScalar(60);
  moon.position.set(-420, 330, -620);
  group.add(moon);
  const moonDisc = new THREE.Mesh(new THREE.CircleGeometry(11, 32), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 2.2, 2.3), fog: false }));
  moonDisc.position.copy(moon.position).multiplyScalar(0.99);
  moonDisc.lookAt(0, 0, 0);
  group.add(moonDisc);

  // Северное сияние
  const auroraMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    fog: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    uniforms: { t: { value: 0 }, strength: { value: 0.55 } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
    fragmentShader: `uniform float t, strength; varying vec2 vUv;
      float n(float x){ return sin(x)*0.5+0.5; }
      void main(){
        float x = vUv.x*10.0;
        float wave = 0.35 + 0.18*sin(x*0.7 + t*0.15) + 0.08*sin(x*2.3 - t*0.3);
        float d = abs(vUv.y - wave);
        float curtain = smoothstep(0.32, 0.0, d) * (0.55 + 0.45*n(x*6.0 + t*0.8 + sin(x*1.7)*2.0));
        float fadeX = smoothstep(0.0, 0.2, vUv.x) * smoothstep(1.0, 0.75, vUv.x);
        float rays = smoothstep(wave-0.02, wave+0.4, vUv.y);
        vec3 col = mix(vec3(0.15,1.0,0.55), vec3(0.3,0.55,1.0), rays);
        gl_FragColor = vec4(col, curtain*fadeX*strength*(1.0 - rays*0.6));
      }`,
  });
  const aurora = new THREE.Mesh(new THREE.PlaneGeometry(1500, 360, 1, 1), auroraMat);
  aurora.position.set(80, 230, -700);
  group.add(aurora);

  return {
    update(t: number) {
      starMat.uniforms.t.value = t;
      auroraMat.uniforms.t.value = t;
      // сияние то разгорается, то гаснет
      auroraMat.uniforms.strength.value = 0.25 + 0.35 * Math.max(0, Math.sin(t * 0.05));
    },
  };
}

/** Горы на горизонте: два слоя с параллаксом. */
export function makeMountains(scene: THREE.Scene) {
  const layers: { g: THREE.Group; k: number; span: number }[] = [];
  const mk = (dist: number, k: number, count: number, h: [number, number], col: string) => {
    const span = 2400;
    const g = new THREE.Group();
    const base = new THREE.Color(col);
    const snow = new THREE.Color("#dfe9f8");
    for (const side of [-1, 1]) {
      for (let i = 0; i < count; i++) {
        const height = h[0] + Math.random() * (h[1] - h[0]);
        const geo = new THREE.ConeGeometry(height * (0.9 + Math.random() * 0.8), height, 7, 3);
        const p = geo.attributes.position;
        const colors = new Float32Array(p.count * 3);
        for (let v = 0; v < p.count; v++) {
          const y = p.getY(v) / height + 0.5;
          // небольшая неровность склонов
          if (y < 0.98 && y > 0.02) {
            p.setX(v, p.getX(v) * (0.85 + Math.random() * 0.3));
            p.setZ(v, p.getZ(v) * (0.85 + Math.random() * 0.3));
          }
          const c = y > 0.62 ? snow : base.clone().lerp(snow, y * 0.25);
          colors.set([c.r, c.g, c.b], v * 3);
        }
        geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
        geo.computeVertexNormals();
        const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1, fog: false }));
        m.position.set(-span / 2 + (i / count) * span + Math.random() * 60, height / 2 - 4, side * (dist + Math.random() * 80));
        g.add(m);
      }
    }
    scene.add(g);
    const g2 = g.clone();
    g2.position.x = span;
    scene.add(g2);
    layers.push({ g, k, span }, { g: g2, k, span });
  };
  mk(330, 0.18, 26, [60, 130], "#2c4675");
  mk(520, 0.08, 22, [110, 220], "#243a66");
  return {
    update(dx: number) {
      for (const l of layers) {
        l.g.position.x -= dx * l.k;
        if (l.g.position.x < -l.span * 1.5) l.g.position.x += l.span * 2;
      }
    },
  };
}
