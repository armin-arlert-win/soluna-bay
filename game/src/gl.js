// Raw WebGL rendering core for Soluna Bay: one shader program, one static city
// mesh, reusable entity meshes, and procedural canvas textures. No libraries.
// Rebuilt under the gta6-01 recording: re-written from the reference build.
import { mat4Identity } from './util.js';

const VERT = `
attribute vec3 aPos;
attribute vec3 aNormal;
attribute vec2 aUV;
attribute vec3 aColor;
uniform mat4 uProj;
uniform mat4 uView;
uniform mat4 uModel;
varying vec3 vNormal;
varying vec2 vUV;
varying vec3 vColor;
varying float vDepth;
void main() {
  vec4 world = uModel * vec4(aPos, 1.0);
  vec4 view = uView * world;
  vNormal = normalize(mat3(uModel) * aNormal);
  vUV = aUV;
  vColor = aColor;
  vDepth = -view.z;
  gl_Position = uProj * view;
}
`;

const FRAG = `
precision mediump float;
varying vec3 vNormal;
varying vec2 vUV;
varying vec3 vColor;
varying float vDepth;
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform vec3 uAmbient;
uniform vec3 uFogColor;
uniform float uFogNear;
uniform float uFogFar;
uniform sampler2D uTexDay;
uniform sampler2D uTexNight;
uniform float uNight;
uniform float uUseTex;
uniform vec3 uTint;
uniform float uEmissive;
uniform float uAlpha;
void main() {
  vec3 tex = mix(texture2D(uTexDay, vUV).rgb, texture2D(uTexNight, vUV).rgb, uNight);
  vec3 base = mix(vColor, tex * vColor, uUseTex) * uTint;
  float diffuse = max(dot(normalize(vNormal), normalize(uSunDir)), 0.0);
  vec3 lit = base * (uAmbient + uSunColor * diffuse);
  lit += base * uEmissive;
  float fog = clamp((vDepth - uFogNear) / (uFogFar - uFogNear), 0.0, 1.0);
  gl_FragColor = vec4(mix(lit, uFogColor, fog), uAlpha);
}
`;

const SKY_VERT = `
attribute vec2 aPos;
varying vec2 vUV;
void main() {
  vUV = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}
`;

const SKY_FRAG = `
precision mediump float;
varying vec2 vUV;
uniform vec3 uTop;
uniform vec3 uHorizon;
uniform vec3 uSunDir;
uniform vec3 uSunColor;
void main() {
  vec3 col = mix(uHorizon, uTop, pow(clamp(vUV.y, 0.0, 1.0), 0.65));
  vec2 sunPos = vec2(0.5 + uSunDir.x * 0.28, 0.42 + uSunDir.y * 0.30);
  float d = distance(vUV, sunPos);
  col += uSunColor * (0.55 * exp(-d * d * 26.0) + 0.18 * exp(-d * d * 5.0));
  gl_FragColor = vec4(col, 1.0);
}
`;

function compileShader(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw new Error(`shader compile failed: ${gl.getShaderInfoLog(shader)}`);
  }
  return shader;
}

function linkProgram(gl, vertSource, fragSource) {
  const program = gl.createProgram();
  gl.attachShader(program, compileShader(gl, gl.VERTEX_SHADER, vertSource));
  gl.attachShader(program, compileShader(gl, gl.FRAGMENT_SHADER, fragSource));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(`program link failed: ${gl.getProgramInfoLog(program)}`);
  }
  return program;
}

/** A growable triangle soup: push quads with normals, UVs and vertex colours. */
export class MeshBuilder {
  constructor() {
    this.positions = [];
    this.normals = [];
    this.uvs = [];
    this.colors = [];
    this.count = 0;
  }

  /** Push one quad (a, b, c, d) as two triangles, facing `normal`. */
  quad(a, b, c, d, normal, uv, color) {
    const n = normal;
    const u = uv ?? [[0, 0], [1, 0], [1, 1], [0, 1]];
    const col = color ?? [1, 1, 1];
    const pts = [a, b, c, a, c, d];
    const uvs = [u[0], u[1], u[2], u[0], u[2], u[3]];
    for (let i = 0; i < 6; i += 1) {
      this.positions.push(pts[i][0], pts[i][1], pts[i][2]);
      this.normals.push(n[0], n[1], n[2]);
      this.uvs.push(uvs[i][0], uvs[i][1]);
      this.colors.push(col[0], col[1], col[2]);
    }
    this.count += 6;
  }

  /** An axis-aligned box centred at (cx, cy, cz) with size (sx, sy, sz). */
  box(cx, cy, cz, sx, sy, sz, color, uvScale = 1) {
    const x0 = cx - sx / 2;
    const x1 = cx + sx / 2;
    const y0 = cy - sy / 2;
    const y1 = cy + sy / 2;
    const z0 = cz - sz / 2;
    const z1 = cz + sz / 2;
    const u = uvScale;
    const top = [1, 1, 1];
    const side = color;
    const uvF = [[0, 0], [u, 0], [u, u], [0, u]];
    // +y top, -y bottom, +z front, -z back, +x right, -x left
    this.quad([x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], [0, 1, 0], uvF, top);
    this.quad([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], [0, -1, 0], uvF, side);
    this.quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [0, 0, 1], uvF, side);
    this.quad([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [0, 0, -1], uvF, side);
    this.quad([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [1, 0, 0], uvF, side);
    this.quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [-1, 0, 0], uvF, side);
  }

  /** A flat ground quad on y = `y`, facing up, with a UV rectangle. */
  ground(x0, z0, x1, z1, y, uv, color) {
    this.quad([x0, y, z1], [x1, y, z1], [x1, y, z0], [x0, y, z0], [0, 1, 0], uv, color);
  }

  build(gl) {
    return new Mesh(gl, this);
  }
}

export class Mesh {
  constructor(gl, builder) {
    this.gl = gl;
    this.count = builder.count;
    this.buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
    const data = new Float32Array(builder.count * 11);
    for (let i = 0; i < builder.count; i += 1) {
      data.set(builder.positions.slice(i * 3, i * 3 + 3), i * 11);
      data.set(builder.normals.slice(i * 3, i * 3 + 3), i * 11 + 3);
      data.set(builder.uvs.slice(i * 2, i * 2 + 2), i * 11 + 6);
      data.set(builder.colors.slice(i * 3, i * 3 + 3), i * 11 + 8);
    }
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
  }
}

export function makeCanvasTexture(gl, width, height, draw) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  draw(canvas.getContext('2d'), width, height);
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
  gl.generateMipmap(gl.TEXTURE_2D);
  return texture;
}

export function makeSolidTexture(gl, r, g, b) {
  return makeCanvasTexture(gl, 4, 4, (ctx) => {
    ctx.fillStyle = `rgb(${r | 0},${g | 0},${b | 0})`;
    ctx.fillRect(0, 0, 4, 4);
  });
}

export class Renderer {
  constructor(canvas) {
    const gl = canvas.getContext('webgl', { antialias: true, preserveDrawingBuffer: false });
    if (!gl) throw new Error('WebGL is not available in this browser');
    this.gl = gl;
    this.canvas = canvas;
    this.program = linkProgram(gl, VERT, FRAG);
    this.skyProgram = linkProgram(gl, SKY_VERT, SKY_FRAG);
    this.attrib = {};
    for (const name of ['aPos', 'aNormal', 'aUV', 'aColor']) {
      this.attrib[name] = gl.getAttribLocation(this.program, name);
    }
    this.uniform = {};
    for (const name of [
      'uProj', 'uView', 'uModel', 'uSunDir', 'uSunColor', 'uAmbient',
      'uFogColor', 'uFogNear', 'uFogFar', 'uTexDay', 'uTexNight', 'uNight',
      'uUseTex', 'uTint', 'uEmissive', 'uAlpha',
    ]) {
      this.uniform[name] = gl.getUniformLocation(this.program, name);
    }
    this.skyUniform = {};
    for (const name of ['uTop', 'uHorizon', 'uSunDir', 'uSunColor']) {
      this.skyUniform[name] = gl.getUniformLocation(this.skyProgram, name);
    }
    // Full-screen sky quad.
    this.skyBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.skyBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    this.whiteTex = makeSolidTexture(gl, 255, 255, 255);
    this.defaultTex = this.whiteTex;
    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.CULL_FACE);
    gl.cullFace(gl.BACK);
  }

  resize(width, height) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.round(width * dpr);
    const h = Math.round(height * dpr);
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
    this.gl.viewport(0, 0, w, h);
    this.dpr = dpr;
  }

  beginFrame(env) {
    const gl = this.gl;
    gl.clearColor(env.fog[0], env.fog[1], env.fog[2], 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    // Gradient sky behind everything.
    gl.useProgram(this.skyProgram);
    gl.disable(gl.DEPTH_TEST);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.skyBuffer);
    const aPos = gl.getAttribLocation(this.skyProgram, 'aPos');
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
    gl.uniform3fv(this.skyUniform.uTop, env.skyTop);
    gl.uniform3fv(this.skyUniform.uHorizon, env.skyHorizon);
    gl.uniform3fv(this.skyUniform.uSunDir, env.sunDir);
    gl.uniform3fv(this.skyUniform.uSunColor, env.sunColor);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.enable(gl.DEPTH_TEST);
    // 3D pass.
    gl.useProgram(this.program);
    gl.uniformMatrix4fv(this.uniform.uProj, false, env.proj);
    gl.uniformMatrix4fv(this.uniform.uView, false, env.view);
    gl.uniform3fv(this.uniform.uSunDir, env.sunDir);
    gl.uniform3fv(this.uniform.uSunColor, env.sunColor);
    gl.uniform3fv(this.uniform.uAmbient, env.ambient);
    gl.uniform3fv(this.uniform.uFogColor, env.fog);
    gl.uniform1f(this.uniform.uFogNear, env.fogNear);
    gl.uniform1f(this.uniform.uFogFar, env.fogFar);
    gl.uniform1f(this.uniform.uNight, env.night);
    gl.uniform1i(this.uniform.uTexDay, 0);
    gl.uniform1i(this.uniform.uTexNight, 1);
    this.env = env;
  }

  bindTextures(day, night) {
    const gl = this.gl;
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, day || this.whiteTex);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, night || this.whiteTex);
  }

  /** Draw `mesh` with a model matrix, colour tint and texture on/off. */
  draw(mesh, model, opts = {}) {
    const gl = this.gl;
    gl.uniformMatrix4fv(this.uniform.uModel, false, model);
    gl.uniform3fv(this.uniform.uTint, opts.tint || [1, 1, 1]);
    gl.uniform1f(this.uniform.uUseTex, opts.textured ? 1 : 0);
    gl.uniform1f(this.uniform.uEmissive, opts.emissive || 0);
    gl.uniform1f(this.uniform.uAlpha, opts.alpha ?? 1);
    gl.bindBuffer(gl.ARRAY_BUFFER, mesh.buffer);
    const stride = 11 * 4;
    gl.enableVertexAttribArray(this.attrib.aPos);
    gl.vertexAttribPointer(this.attrib.aPos, 3, gl.FLOAT, false, stride, 0);
    gl.enableVertexAttribArray(this.attrib.aNormal);
    gl.vertexAttribPointer(this.attrib.aNormal, 3, gl.FLOAT, false, stride, 12);
    gl.enableVertexAttribArray(this.attrib.aUV);
    gl.vertexAttribPointer(this.attrib.aUV, 2, gl.FLOAT, false, stride, 24);
    gl.enableVertexAttribArray(this.attrib.aColor);
    gl.vertexAttribPointer(this.attrib.aColor, 3, gl.FLOAT, false, stride, 32);
    gl.drawArrays(gl.TRIANGLES, 0, mesh.count);
  }

  /** Draw a transparent mesh (shadow blob, light cone, flash) with blending. */
  drawFlat(mesh, model, color, alpha) {
    const gl = this.gl;
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.depthMask(false);
    gl.uniformMatrix4fv(this.uniform.uModel, false, model);
    gl.uniform3fv(this.uniform.uTint, [color[0], color[1], color[2]]);
    gl.uniform1f(this.uniform.uUseTex, 0);
    gl.uniform1f(this.uniform.uEmissive, 0);
    gl.uniform1f(this.uniform.uAlpha, alpha);
    gl.bindBuffer(gl.ARRAY_BUFFER, mesh.buffer);
    const stride = 11 * 4;
    gl.enableVertexAttribArray(this.attrib.aPos);
    gl.vertexAttribPointer(this.attrib.aPos, 3, gl.FLOAT, false, stride, 0);
    gl.enableVertexAttribArray(this.attrib.aNormal);
    gl.vertexAttribPointer(this.attrib.aNormal, 3, gl.FLOAT, false, stride, 12);
    gl.enableVertexAttribArray(this.attrib.aUV);
    gl.vertexAttribPointer(this.attrib.aUV, 2, gl.FLOAT, false, stride, 24);
    gl.enableVertexAttribArray(this.attrib.aColor);
    gl.vertexAttribPointer(this.attrib.aColor, 3, gl.FLOAT, false, stride, 32);
    gl.drawArrays(gl.TRIANGLES, 0, mesh.count);
    gl.depthMask(true);
    gl.disable(gl.BLEND);
    gl.uniform1f(this.uniform.uAlpha, 1);
  }
}
