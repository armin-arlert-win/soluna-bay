// SOLUNA BAY — raw WebGL renderer. One program, vertex colours, sun + fog.
// No libraries: the math, the meshes and the shaders are all written here.
import { PALETTE } from './config.js';

// ---- 4x4 matrices, column-major like WebGL wants ----
export function matIdentity() {
  return new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
}
export function matPerspective(fovY, aspect, near, far) {
  const f = 1 / Math.tan(fovY / 2);
  const nf = 1 / (near - far);
  return new Float32Array([
    f / aspect, 0, 0, 0,
    0, f, 0, 0,
    0, 0, (far + near) * nf, -1,
    0, 0, 2 * far * near * nf, 0,
  ]);
}
export function matLookAt(eye, target, up) {
  const zx = eye[0] - target[0];
  const zy = eye[1] - target[1];
  const zz = eye[2] - target[2];
  let len = Math.hypot(zx, zy, zz) || 1;
  const z = [zx / len, zy / len, zz / len];
  let xx = up[1] * z[2] - up[2] * z[1];
  let xy = up[2] * z[0] - up[0] * z[2];
  let xz = up[0] * z[1] - up[1] * z[0];
  len = Math.hypot(xx, xy, xz) || 1;
  const x = [xx / len, xy / len, xz / len];
  const y = [
    z[1] * x[2] - z[2] * x[1],
    z[2] * x[0] - z[0] * x[2],
    z[0] * x[1] - z[1] * x[0],
  ];
  return new Float32Array([
    x[0], y[0], z[0], 0,
    x[1], y[1], z[1], 0,
    x[2], y[2], z[2], 0,
    -(x[0] * eye[0] + x[1] * eye[1] + x[2] * eye[2]),
    -(y[0] * eye[0] + y[1] * eye[1] + y[2] * eye[2]),
    -(z[0] * eye[0] + z[1] * eye[1] + z[2] * eye[2]),
    1,
  ]);
}

// ---- Mesh builder: accumulate triangles, 9 floats per vertex ----
export class Mesh {
  constructor() {
    this.data = [];
  }
  get count() {
    return this.data.length / 9;
  }
  tri(a, b, c, n, color) {
    const cr = ((color >> 16) & 255) / 255;
    const cg = ((color >> 8) & 255) / 255;
    const cb = (color & 255) / 255;
    for (const p of [a, b, c]) {
      this.data.push(p[0], p[1], p[2], n[0], n[1], n[2], cr, cg, cb);
    }
  }
  quad(a, b, c, d, n, color) {
    this.tri(a, b, c, n, color);
    this.tri(a, c, d, n, color);
  }
  // Axis-aligned box. topColor colours the +Y face (roofs).
  box(cx, cy, cz, sx, sy, sz, color, topColor) {
    const x0 = cx - sx / 2, x1 = cx + sx / 2;
    const y0 = cy - sy / 2, y1 = cy + sy / 2;
    const z0 = cz - sz / 2, z1 = cz + sz / 2;
    const top = topColor === undefined ? color : topColor;
    this.quad([x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], [0, 1, 0], top);
    this.quad([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], [0, -1, 0], color);
    this.quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [0, 0, 1], color);
    this.quad([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [0, 0, -1], color);
    this.quad([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [1, 0, 0], color);
    this.quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [-1, 0, 0], color);
  }
  // Flat quad on the ground (y up), wound so its normal is +Y.
  ground(x0, z0, x1, z1, y, color) {
    this.quad([x0, y, z1], [x1, y, z1], [x1, y, z0], [x0, y, z0], [0, 1, 0], color);
  }
  // A box rotated around Y by `rot` radians, centred at (cx, cy, cz).
  rbox(cx, cy, cz, sx, sy, sz, rot, color, topColor) {
    const c = Math.cos(rot);
    const s = Math.sin(rot);
    const rotP = (x, y, z) => [cx + x * c + z * s, cy + y, cz - x * s + z * c];
    const hx = sx / 2, hy = sy / 2, hz = sz / 2;
    const v = [
      rotP(-hx, -hy, -hz), rotP(hx, -hy, -hz), rotP(hx, -hy, hz), rotP(-hx, -hy, hz),
      rotP(-hx, hy, -hz), rotP(hx, hy, -hz), rotP(hx, hy, hz), rotP(-hx, hy, hz),
    ];
    const nrm = (x, y, z) => {
      const l = Math.hypot(x, y, z) || 1;
      return [x / l, y / l, z / l];
    };
    const top = topColor === undefined ? color : topColor;
    const faces = [
      { idx: [4, 5, 6, 7], n: nrm(0, 1, 0), col: top },
      { idx: [1, 0, 3, 2], n: nrm(0, -1, 0), col: color },
      { idx: [3, 2, 6, 7], n: nrm(s, 0, c), col: color },
      { idx: [1, 5, 4, 0], n: nrm(-s, 0, -c), col: color },
      { idx: [2, 1, 5, 6], n: nrm(c, 0, -s), col: color },
      { idx: [0, 4, 7, 3], n: nrm(-c, 0, s), col: color },
    ];
    for (const f of faces) {
      this.quad(v[f.idx[0]], v[f.idx[1]], v[f.idx[2]], v[f.idx[3]], f.n, f.col);
    }
  }
  // Vertical prism (cylinder) with `sides` sides.
  prism(cx, y0, cz, r, h, sides, color, topColor) {
    const top = topColor === undefined ? color : topColor;
    const pts = [];
    for (let i = 0; i < sides; i += 1) {
      const a = (i / sides) * Math.PI * 2;
      pts.push([cx + Math.cos(a) * r, cz + Math.sin(a) * r]);
    }
    for (let i = 0; i < sides; i += 1) {
      const j = (i + 1) % sides;
      const nx = (pts[i][0] + pts[j][0]) / 2 - cx;
      const nz = (pts[i][1] + pts[j][1]) - cz;
      const l = Math.hypot(nx, nz) || 1;
      this.quad(
        [pts[i][0], y0, pts[i][1]], [pts[j][0], y0, pts[j][1]],
        [pts[j][0], y0 + h, pts[j][1]], [pts[i][0], y0 + h, pts[i][1]],
        [nx / l, 0, nz / l], color,
      );
    }
    // Top cap as a fan.
    for (let i = 0; i < sides; i += 1) {
      const j = (i + 1) % sides;
      this.tri([cx, y0 + h, cz], [pts[j][0], y0 + h, pts[j][1]], [pts[i][0], y0 + h, pts[i][1]], [0, 1, 0], top);
    }
  }
  // A small octahedron (diamond) for markers and collectibles.
  gem(cx, cy, cz, r, color) {
    const top = [cx, cy + r, cz];
    const bot = [cx, cy - r, cz];
    const ring = [
      [cx + r, cy, cz], [cx, cy, cz + r], [cx - r, cy, cz], [cx, cy, cz - r],
    ];
    for (let i = 0; i < 4; i += 1) {
      const a = ring[i];
      const b = ring[(i + 1) % 4];
      const n = [a[0] + b[0] - 2 * cx, 1.5 * r, a[2] + b[2] - 2 * cz];
      const l = Math.hypot(n[0], n[1], n[2]) || 1;
      this.tri(top, b, a, [n[0] / l, n[1] / l, n[2] / l], color);
      const n2 = [a[0] + b[0] - 2 * cx, -1.5 * r, a[2] + b[2] - 2 * cz];
      const l2 = Math.hypot(n2[0], n2[1], n2[2]) || 1;
      this.tri(bot, a, b, [n2[0] / l2, n2[1] / l2, n2[2] / l2], color);
    }
  }
  toFloat32() {
    return new Float32Array(this.data);
  }
}

const VERT = `
attribute vec3 aPos; attribute vec3 aNor; attribute vec3 aCol;
uniform mat4 uProj; uniform mat4 uView;
uniform vec3 uSunDir; uniform vec3 uSunCol; uniform vec3 uAmb;
uniform float uFogNear; uniform float uFogFar; uniform float uGlow;
varying vec3 vCol; varying float vFog;
void main() {
  vec4 wp = uView * vec4(aPos, 1.0);
  gl_Position = uProj * wp;
  float diff = max(dot(normalize(aNor), normalize(uSunDir)), 0.0);
  vec3 lit = aCol * (uAmb + uSunCol * diff);
  vCol = mix(lit, aCol, uGlow);
  vFog = clamp((-wp.z - uFogNear) / (uFogFar - uFogNear), 0.0, 1.0);
}`;
const FRAG = `
precision mediump float;
uniform vec3 uFogCol; uniform float uAlpha;
varying vec3 vCol; varying float vFog;
void main() {
  vec3 c = mix(vCol, uFogCol, vFog);
  gl_FragColor = vec4(c, uAlpha);
}`;

// Hour (0-24) -> sky, sun and fog.
export function skyFor(hour) {
  const day = hour >= 6 && hour < 18;
  const dusk = (hour >= 17 && hour < 19) || (hour >= 5 && hour < 7);
  const night = !day;
  if (dusk) {
    // Evening dusk (17-19): the sun sits northwest, behind the chase
    // camera — so the cars' rears and the buildings' camera-facing sides
    // are lit warm instead of falling to ambient shadow (round-6
    // diagnosis: the old southeast sun left everything the camera sees
    // dark — a white police cruiser rendered nearly black). Morning dusk
    // (5-7) keeps the eastern sun. The sky stays the same warm orange.
    const evening = hour >= 17;
    return {
      clear: [0.98, 0.55, 0.32], fog: [0.95, 0.55, 0.35],
      sunDir: evening ? [-0.45, 0.35, -0.55] : [0.6, 0.25, 0.4],
      sunCol: [1.0, 0.55, 0.3], amb: evening ? [0.52, 0.47, 0.47] : [0.45, 0.4, 0.42],
      fogNear: 55, fogFar: 240, night: false,
    };
  }
  if (night) {
    return {
      clear: [0.03, 0.05, 0.1], fog: [0.05, 0.07, 0.13], sunDir: [-0.4, 0.7, 0.3],
      sunCol: [0.5, 0.58, 0.75], amb: [0.42, 0.44, 0.52], fogNear: 40, fogFar: 170, night: true,
    };
  }
  return {
    clear: [0.55, 0.78, 0.92], fog: [0.72, 0.83, 0.92], sunDir: [0.5, 0.85, 0.35],
    sunCol: [1.0, 0.95, 0.85], amb: [0.55, 0.55, 0.55], fogNear: 70, fogFar: 300, night: false,
  };
}

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    const gl = canvas.getContext('webgl', { antialias: true, preserveDrawingBuffer: true });
    if (!gl) throw new Error('WebGL is not available');
    this.gl = gl;
    const compile = (type, src) => {
      const sh = gl.createShader(type);
      gl.shaderSource(sh, src);
      gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
        throw new Error(`shader: ${gl.getShaderInfoLog(sh)}`);
      }
      return sh;
    };
    const prog = gl.createProgram();
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      throw new Error(`program: ${gl.getProgramInfoLog(prog)}`);
    }
    gl.useProgram(prog);
    this.prog = prog;
    this.loc = {};
    for (const name of ['uProj', 'uView', 'uSunDir', 'uSunCol', 'uAmb', 'uFogCol', 'uFogNear', 'uFogFar', 'uGlow', 'uAlpha']) {
      this.loc[name] = gl.getUniformLocation(prog, name);
    }
    this.aPos = gl.getAttribLocation(prog, 'aPos');
    this.aNor = gl.getAttribLocation(prog, 'aNor');
    this.aCol = gl.getAttribLocation(prog, 'aCol');
    this.staticBuf = gl.createBuffer();
    this.dynBuf = gl.createBuffer();
    this.staticCount = 0;
    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.CULL_FACE);
    gl.cullFace(gl.BACK);
  }
  resize() {
    const w = Math.floor(this.canvas.clientWidth * Math.min(window.devicePixelRatio || 1, 1.5));
    const h = Math.floor(this.canvas.clientHeight * Math.min(window.devicePixelRatio || 1, 1.5));
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
    this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    return this.canvas.width / this.canvas.height;
  }
  uploadStatic(mesh) {
    const gl = this.gl;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.staticBuf);
    gl.bufferData(gl.ARRAY_BUFFER, mesh.toFloat32(), gl.STATIC_DRAW);
    this.staticCount = mesh.count;
  }
  drawBuffer(buf, count, glow, alpha) {
    const gl = this.gl;
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    const stride = 9 * 4;
    gl.enableVertexAttribArray(this.aPos);
    gl.vertexAttribPointer(this.aPos, 3, gl.FLOAT, false, stride, 0);
    gl.enableVertexAttribArray(this.aNor);
    gl.vertexAttribPointer(this.aNor, 3, gl.FLOAT, false, stride, 12);
    gl.enableVertexAttribArray(this.aCol);
    gl.vertexAttribPointer(this.aCol, 3, gl.FLOAT, false, stride, 24);
    gl.uniform1f(this.loc.uGlow, glow);
    gl.uniform1f(this.loc.uAlpha, alpha);
    gl.drawArrays(gl.TRIANGLES, 0, count);
  }
  frame(camera, sky, dynMesh, glowMesh, alphaMesh) {
    const gl = this.gl;
    const aspect = this.resize();
    gl.clearColor(sky.clear[0], sky.clear[1], sky.clear[2], 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    const proj = matPerspective((62 * Math.PI) / 180, aspect, 0.5, 900);
    const view = matLookAt(camera.eye, camera.target, [0, 1, 0]);
    gl.uniformMatrix4fv(this.loc.uProj, false, proj);
    gl.uniformMatrix4fv(this.loc.uView, false, view);
    gl.uniform3fv(this.loc.uSunDir, new Float32Array(sky.sunDir));
    gl.uniform3fv(this.loc.uSunCol, new Float32Array(sky.sunCol));
    gl.uniform3fv(this.loc.uAmb, new Float32Array(sky.amb));
    gl.uniform3fv(this.loc.uFogCol, new Float32Array(sky.fog));
    gl.uniform1f(this.loc.uFogNear, sky.fogNear);
    gl.uniform1f(this.loc.uFogFar, sky.fogFar);
    this.drawBuffer(this.staticBuf, this.staticCount, 0, 1);
    if (dynMesh && dynMesh.count > 0) {
      gl.bindBuffer(gl.ARRAY_BUFFER, this.dynBuf);
      gl.bufferData(gl.ARRAY_BUFFER, dynMesh.toFloat32(), gl.DYNAMIC_DRAW);
      this.drawBuffer(this.dynBuf, dynMesh.count, 0, 1);
    }
    if (glowMesh && glowMesh.count > 0) {
      gl.bindBuffer(gl.ARRAY_BUFFER, this.dynBuf);
      gl.bufferData(gl.ARRAY_BUFFER, glowMesh.toFloat32(), gl.DYNAMIC_DRAW);
      this.drawBuffer(this.dynBuf, glowMesh.count, 1, 1);
    }
    if (alphaMesh && alphaMesh.count > 0) {
      gl.bindBuffer(gl.ARRAY_BUFFER, this.dynBuf);
      gl.bufferData(gl.ARRAY_BUFFER, alphaMesh.toFloat32(), gl.DYNAMIC_DRAW);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.depthMask(false);
      this.drawBuffer(this.dynBuf, alphaMesh.count, 1, 0.22);
      gl.depthMask(true);
      gl.disable(gl.BLEND);
    }
  }
}
