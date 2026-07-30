// @ts-check

import { normalize, sub, v3 } from '../core/vec3.js';
import { buildPieceMeshData, faceIdColor, pieceIdColor } from './mesh-data.js';
import {
  mat4LookAt,
  mat4Multiply,
  mat4Orthographic,
  normalMatrix3FromMat4,
} from './mat4.js';
import {
  groundFragmentShader,
  groundVertexShader,
  lineFragmentShader,
  lineVertexShader,
  observationFragmentShader,
  observationVertexShader,
  shadowFragmentShader,
  shadowVertexShader,
  studioFragmentShader,
  studioVertexShader,
} from './shaders.js';

/** @typedef {import('../core/puzzle-compiler.js').CompiledPuzzle} CompiledPuzzle */
/** @typedef {import('../core/vec3.js').Vec3} Vec3 */
/** @typedef {import('./camera.js').OrbitCamera} OrbitCamera */
/** @typedef {{eye:Vec3,view:Float32Array,projection:Float32Array,viewProjection:Float32Array}} ViewData */
/** @typedef {{program:WebGLProgram,uniforms:Record<string,WebGLUniformLocation|null>}} ProgramBundle */
/** @typedef {{vao:WebGLVertexArrayObject,lineVao:WebGLVertexArrayObject,buffers:WebGLBuffer[],vertexCount:number,lineVertexCount:number,pieceColor:[number,number,number],pieceId:string,triangleCount:number}} PieceGpu */

const OBSERVATION_MODE = Object.freeze({
  albedo: 0,
  piece: 1,
  face: 2,
  normal: 3,
  depth: 4,
});

const FOG_COLOR = /** @type {[number,number,number]} */ ([0.012, 0.018, 0.032]);

/** @param {WebGL2RenderingContext} gl @param {number} type @param {string} source @param {string} label */
function compileShader(gl, type, source, label) {
  const shader = gl.createShader(type);
  if (!shader) throw new Error(`Could not allocate ${label} shader.`);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader) ?? 'No compiler log.';
    gl.deleteShader(shader);
    throw new Error(`${label} shader compilation failed:\n${log}`);
  }
  return shader;
}

/** @param {WebGL2RenderingContext} gl @param {string} vertex @param {string} fragment @param {string} label @param {string[]} uniforms @returns {ProgramBundle} */
function createProgram(gl, vertex, fragment, label, uniforms) {
  const vertexShader = compileShader(gl, gl.VERTEX_SHADER, vertex, `${label} vertex`);
  const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, fragment, `${label} fragment`);
  const program = gl.createProgram();
  if (!program) throw new Error(`Could not allocate ${label} program.`);
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  gl.deleteShader(vertexShader);
  gl.deleteShader(fragmentShader);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(program) ?? 'No linker log.';
    gl.deleteProgram(program);
    throw new Error(`${label} program link failed:\n${log}`);
  }
  /** @type {Record<string,WebGLUniformLocation|null>} */
  const locations = {};
  for (const name of uniforms) locations[name] = gl.getUniformLocation(program, name);
  return { program, uniforms: locations };
}

/** @param {WebGL2RenderingContext} gl @param {WebGLUniformLocation|null} location @param {Float32Array|number[]} value */
function uniformMatrix4(gl, location, value) {
  if (location) gl.uniformMatrix4fv(location, false, value);
}

/** @param {WebGL2RenderingContext} gl @param {WebGLUniformLocation|null} location @param {Float32Array|number[]} value */
function uniformMatrix3(gl, location, value) {
  if (location) gl.uniformMatrix3fv(location, false, value);
}

/** @param {WebGL2RenderingContext} gl @param {WebGLUniformLocation|null} location @param {readonly number[]|Vec3} value */
function uniform3(gl, location, value) {
  if (!location) return;
  if (Array.isArray(value)) gl.uniform3f(location, value[0], value[1], value[2]);
  else {
    const vector = /** @type {Vec3} */ (value);
    gl.uniform3f(location, vector.x, vector.y, vector.z);
  }
}

/** @param {WebGL2RenderingContext} gl @param {WebGLVertexArrayObject} vao @param {number} location @param {Float32Array} data @param {number} size @param {WebGLBuffer[]} buffers */
function attachAttribute(gl, vao, location, data, size, buffers) {
  const buffer = gl.createBuffer();
  if (!buffer) throw new Error('Could not allocate GPU vertex buffer.');
  buffers.push(buffer);
  gl.bindVertexArray(vao);
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
  gl.enableVertexAttribArray(location);
  gl.vertexAttribPointer(location, size, gl.FLOAT, false, 0, 0);
}

/** @param {Uint8Array} pixels @param {number} width @param {number} height */
function flipPixelsVertically(pixels, width, height) {
  const rowBytes = width * 4;
  const flipped = new Uint8ClampedArray(pixels.length);
  for (let y = 0; y < height; y += 1) {
    const sourceOffset = (height - 1 - y) * rowBytes;
    flipped.set(pixels.subarray(sourceOffset, sourceOffset + rowBytes), y * rowBytes);
  }
  return flipped;
}

/** @param {Uint8ClampedArray} pixels @param {number} width @param {number} height */
function pixelsToPngBlob(pixels, width, height) {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) {
      reject(new Error('2D canvas unavailable while encoding PNG.'));
      return;
    }
    context.putImageData(new ImageData(Uint8ClampedArray.from(pixels), width, height), 0, 0);
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Browser failed to encode PNG.'));
    }, 'image/png');
  });
}

/** @param {readonly number[]} color */
function byteColorKey(color) {
  return `${Math.round(color[0] * 255)},${Math.round(color[1] * 255)},${Math.round(color[2] * 255)}`;
}

/**
 * Dependency-free WebGL2 renderer with a studio pass and machine-observation passes.
 * Geometry is uploaded once; exact state lives in PuzzleEngine and arrives here as model matrices.
 */
export class TwistyRenderer {
  /** @param {HTMLCanvasElement} canvas */
  constructor(canvas) {
    this.canvas = canvas;
    const gl = canvas.getContext('webgl2', {
      antialias: true,
      alpha: false,
      depth: true,
      stencil: false,
      premultipliedAlpha: false,
      preserveDrawingBuffer: false,
      powerPreference: 'high-performance',
    });
    if (!gl) throw new Error('KineScope requires WebGL2. This browser declined, as browsers sometimes do.');
    this.gl = gl;
    this.pixelRatio = Math.min(2, window.devicePixelRatio || 1);
    this.exposure = 1.08;
    this.showEdges = true;
    this.showGround = true;
    this.puzzle = null;
    /** @type {Map<string,PieceGpu>} */
    this.pieceGpu = new Map();
    /** @type {Map<string,string>} */
    this.pieceColorLookup = new Map();
    /** @type {Map<string,number>} */
    this.faceIdBaseByPiece = new Map();
    this.gpuBuffers = 0;
    this.drawCalls = 0;
    this.lastRenderMilliseconds = 0;

    this.programs = {
      studio: createProgram(gl, studioVertexShader, studioFragmentShader, 'studio', [
        'u_model', 'u_view', 'u_viewProjection', 'u_lightViewProjection', 'u_normalMatrix',
        'u_cameraPosition', 'u_lightDirection', 'u_lightColor', 'u_shadowMap', 'u_shadowTexel',
        'u_highlight', 'u_accentColor', 'u_exposure', 'u_fogColor',
      ]),
      shadow: createProgram(gl, shadowVertexShader, shadowFragmentShader, 'shadow', [
        'u_model', 'u_lightViewProjection',
      ]),
      line: createProgram(gl, lineVertexShader, lineFragmentShader, 'line', [
        'u_model', 'u_viewProjection', 'u_color',
      ]),
      observation: createProgram(gl, observationVertexShader, observationFragmentShader, 'observation', [
        'u_model', 'u_view', 'u_viewProjection', 'u_normalMatrix', 'u_mode', 'u_pieceColor', 'u_near', 'u_far',
      ]),
      ground: createProgram(gl, groundVertexShader, groundFragmentShader, 'ground', [
        'u_view', 'u_viewProjection', 'u_lightViewProjection', 'u_shadowMap', 'u_shadowTexel', 'u_fogColor',
      ]),
    };

    this.shadowSize = Math.min(2048, gl.getParameter(gl.MAX_TEXTURE_SIZE));
    this.shadowFramebuffer = gl.createFramebuffer();
    this.shadowTexture = gl.createTexture();
    if (!this.shadowFramebuffer || !this.shadowTexture) throw new Error('Could not allocate shadow resources.');
    this.createShadowTarget();

    this.captureFramebuffer = gl.createFramebuffer();
    this.captureTexture = gl.createTexture();
    this.captureDepth = gl.createRenderbuffer();
    if (!this.captureFramebuffer || !this.captureTexture || !this.captureDepth) {
      throw new Error('Could not allocate observation target.');
    }
    this.captureWidth = 0;
    this.captureHeight = 0;

    this.groundVao = gl.createVertexArray();
    this.groundBuffer = gl.createBuffer();
    if (!this.groundVao || !this.groundBuffer) throw new Error('Could not allocate ground mesh.');
    this.groundY = -1.9;
    this.updateGroundGeometry();

    this.lightPosition = v3(-5.4, 8.2, 5.8);
    this.lightTarget = v3(0, 0, 0);
    this.lightDirection = normalize(sub(this.lightPosition, this.lightTarget));
    this.lightViewProjection = this.computeLightViewProjection();

    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.enable(gl.CULL_FACE);
    gl.cullFace(gl.BACK);
    gl.frontFace(gl.CCW);

    const debugExtension = gl.getExtension('WEBGL_debug_renderer_info');
    this.gpuInfo = {
      vendor: debugExtension ? String(gl.getParameter(debugExtension.UNMASKED_VENDOR_WEBGL)) : String(gl.getParameter(gl.VENDOR)),
      renderer: debugExtension ? String(gl.getParameter(debugExtension.UNMASKED_RENDERER_WEBGL)) : String(gl.getParameter(gl.RENDERER)),
      version: String(gl.getParameter(gl.VERSION)),
      shadingLanguage: String(gl.getParameter(gl.SHADING_LANGUAGE_VERSION)),
      maxTextureSize: Number(gl.getParameter(gl.MAX_TEXTURE_SIZE)),
    };
  }

  createShadowTarget() {
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, this.shadowTexture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.DEPTH_COMPONENT24, this.shadowSize, this.shadowSize, 0, gl.DEPTH_COMPONENT, gl.UNSIGNED_INT, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.shadowFramebuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, this.shadowTexture, 0);
    gl.drawBuffers([gl.NONE]);
    gl.readBuffer(gl.NONE);
    const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    if (status !== gl.FRAMEBUFFER_COMPLETE) throw new Error(`Shadow framebuffer incomplete: 0x${status.toString(16)}`);
  }

  /** @param {number} width @param {number} height */
  ensureCaptureTarget(width, height) {
    const gl = this.gl;
    const safeWidth = Math.max(1, Math.min(gl.getParameter(gl.MAX_TEXTURE_SIZE), Math.trunc(width)));
    const safeHeight = Math.max(1, Math.min(gl.getParameter(gl.MAX_TEXTURE_SIZE), Math.trunc(height)));
    if (safeWidth === this.captureWidth && safeHeight === this.captureHeight) return;
    this.captureWidth = safeWidth;
    this.captureHeight = safeHeight;

    gl.bindTexture(gl.TEXTURE_2D, this.captureTexture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, safeWidth, safeHeight, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    gl.bindRenderbuffer(gl.RENDERBUFFER, this.captureDepth);
    gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT24, safeWidth, safeHeight);

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.captureFramebuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.captureTexture, 0);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, this.captureDepth);
    gl.drawBuffers([gl.COLOR_ATTACHMENT0]);
    const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    if (status !== gl.FRAMEBUFFER_COMPLETE) throw new Error(`Capture framebuffer incomplete: 0x${status.toString(16)}`);
  }

  computeLightViewProjection() {
    const view = mat4LookAt(this.lightPosition, this.lightTarget, v3(0, 1, 0));
    const projection = mat4Orthographic(-5.2, 5.2, -5.2, 5.2, 0.5, 26);
    return mat4Multiply(projection, view);
  }

  updateGroundGeometry() {
    const gl = this.gl;
    const extent = 22;
    const y = this.groundY;
    const vertices = new Float32Array([
      -extent, y, -extent,
      extent, y, -extent,
      extent, y, extent,
      -extent, y, -extent,
      extent, y, extent,
      -extent, y, extent,
    ]);
    gl.bindVertexArray(this.groundVao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.groundBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);
  }

  /** @param {number} ratio */
  setPixelRatio(ratio) {
    this.pixelRatio = Math.max(0.5, Math.min(3, Number(ratio) || 1));
  }

  resizeCanvasToDisplaySize() {
    const rect = this.canvas.getBoundingClientRect();
    const width = Math.max(1, Math.round(rect.width * this.pixelRatio));
    const height = Math.max(1, Math.round(rect.height * this.pixelRatio));
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
      return true;
    }
    return false;
  }

  disposePuzzle() {
    const gl = this.gl;
    for (const gpu of this.pieceGpu.values()) {
      gl.deleteVertexArray(gpu.vao);
      gl.deleteVertexArray(gpu.lineVao);
      for (const buffer of gpu.buffers) gl.deleteBuffer(buffer);
    }
    this.pieceGpu.clear();
    this.pieceColorLookup.clear();
    this.faceIdBaseByPiece.clear();
    this.gpuBuffers = 0;
  }

  /** @param {CompiledPuzzle} puzzle */
  setPuzzle(puzzle) {
    const gl = this.gl;
    this.disposePuzzle();
    this.puzzle = puzzle;
    const minimumY = Math.min(...puzzle.pieces.flatMap((piece) => piece.polyhedron.vertices.map((vertex) => vertex.y)));
    this.groundY = minimumY - 0.42;
    this.updateGroundGeometry();

    let faceIdBase = 0;
    for (let pieceIndex = 0; pieceIndex < puzzle.pieces.length; pieceIndex += 1) {
      const piece = puzzle.pieces[pieceIndex];
      if (!piece.renderable) continue;
      this.faceIdBaseByPiece.set(piece.id, faceIdBase);
      const mesh = buildPieceMeshData(puzzle, piece, pieceIndex, faceIdBase);
      const vao = gl.createVertexArray();
      const lineVao = gl.createVertexArray();
      if (!vao || !lineVao) throw new Error(`Could not allocate VAO for ${piece.id}.`);
      /** @type {WebGLBuffer[]} */
      const buffers = [];
      attachAttribute(gl, vao, 0, mesh.positions, 3, buffers);
      attachAttribute(gl, vao, 1, mesh.normals, 3, buffers);
      attachAttribute(gl, vao, 2, mesh.colors, 3, buffers);
      attachAttribute(gl, vao, 3, mesh.material, 2, buffers);
      attachAttribute(gl, vao, 4, mesh.faceColors, 3, buffers);
      attachAttribute(gl, vao, 5, mesh.surfaces, 1, buffers);
      attachAttribute(gl, lineVao, 0, mesh.linePositions, 3, buffers);
      const gpu = {
        vao,
        lineVao,
        buffers,
        vertexCount: mesh.positions.length / 3,
        lineVertexCount: mesh.linePositions.length / 3,
        pieceColor: mesh.pieceColor,
        pieceId: piece.id,
        triangleCount: mesh.triangleCount,
      };
      this.pieceGpu.set(piece.id, gpu);
      this.pieceColorLookup.set(byteColorKey(mesh.pieceColor), piece.id);
      this.gpuBuffers += buffers.length;
      faceIdBase += piece.polyhedron.faces.length;
    }
    gl.bindVertexArray(null);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
  }

  /**
   * @param {Map<string,Float32Array>} modelMatrices
   * @param {Map<string,number>} highlights
   */
  renderShadow(modelMatrices, highlights = new Map()) {
    const gl = this.gl;
    const bundle = this.programs.shadow;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.shadowFramebuffer);
    gl.viewport(0, 0, this.shadowSize, this.shadowSize);
    gl.colorMask(false, false, false, false);
    gl.clearDepth(1);
    gl.clear(gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.CULL_FACE);
    gl.enable(gl.POLYGON_OFFSET_FILL);
    gl.polygonOffset(1.4, 2.2);
    gl.useProgram(bundle.program);
    uniformMatrix4(gl, bundle.uniforms.u_lightViewProjection, this.lightViewProjection);
    for (const [pieceId, gpu] of this.pieceGpu) {
      const model = modelMatrices.get(pieceId);
      if (!model) continue;
      uniformMatrix4(gl, bundle.uniforms.u_model, model);
      gl.bindVertexArray(gpu.vao);
      gl.drawArrays(gl.TRIANGLES, 0, gpu.vertexCount);
    }
    gl.disable(gl.POLYGON_OFFSET_FILL);
    gl.colorMask(true, true, true, true);
    gl.bindVertexArray(null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  /** @param {ViewData} viewData */
  drawGround(viewData) {
    const gl = this.gl;
    const bundle = this.programs.ground;
    gl.useProgram(bundle.program);
    uniformMatrix4(gl, bundle.uniforms.u_view, viewData.view);
    uniformMatrix4(gl, bundle.uniforms.u_viewProjection, viewData.viewProjection);
    uniformMatrix4(gl, bundle.uniforms.u_lightViewProjection, this.lightViewProjection);
    uniform3(gl, bundle.uniforms.u_fogColor, FOG_COLOR);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.shadowTexture);
    if (bundle.uniforms.u_shadowMap) gl.uniform1i(bundle.uniforms.u_shadowMap, 0);
    if (bundle.uniforms.u_shadowTexel) gl.uniform2f(bundle.uniforms.u_shadowTexel, 1 / this.shadowSize, 1 / this.shadowSize);
    gl.bindVertexArray(this.groundVao);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    this.drawCalls += 1;
  }

  /**
   * @param {WebGLFramebuffer|null} framebuffer
   * @param {number} width
   * @param {number} height
   * @param {ViewData} viewData
   * @param {Map<string,Float32Array>} modelMatrices
   * @param {Map<string,number>} highlights
   */
  renderStudioTarget(framebuffer, width, height, viewData, modelMatrices, highlights) {
    const gl = this.gl;
    const bundle = this.programs.studio;
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
    gl.viewport(0, 0, width, height);
    gl.clearColor(FOG_COLOR[0], FOG_COLOR[1], FOG_COLOR[2], 1);
    gl.clearDepth(1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.CULL_FACE);
    gl.disable(gl.BLEND);
    gl.enable(gl.DITHER);
    this.drawCalls = 0;
    if (this.showGround) this.drawGround(viewData);

    gl.useProgram(bundle.program);
    uniformMatrix4(gl, bundle.uniforms.u_view, viewData.view);
    uniformMatrix4(gl, bundle.uniforms.u_viewProjection, viewData.viewProjection);
    uniformMatrix4(gl, bundle.uniforms.u_lightViewProjection, this.lightViewProjection);
    uniform3(gl, bundle.uniforms.u_cameraPosition, viewData.eye);
    uniform3(gl, bundle.uniforms.u_lightDirection, this.lightDirection);
    uniform3(gl, bundle.uniforms.u_lightColor, [1.0, 0.94, 0.84]);
    uniform3(gl, bundle.uniforms.u_fogColor, FOG_COLOR);
    const accent = this.puzzle?.spec.appearance.accentColor ?? [0.2, 0.75, 1];
    uniform3(gl, bundle.uniforms.u_accentColor, accent);
    if (bundle.uniforms.u_exposure) gl.uniform1f(bundle.uniforms.u_exposure, this.exposure);
    if (bundle.uniforms.u_shadowTexel) gl.uniform2f(bundle.uniforms.u_shadowTexel, 1 / this.shadowSize, 1 / this.shadowSize);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.shadowTexture);
    if (bundle.uniforms.u_shadowMap) gl.uniform1i(bundle.uniforms.u_shadowMap, 0);

    for (const [pieceId, gpu] of this.pieceGpu) {
      const model = modelMatrices.get(pieceId);
      if (!model) continue;
      uniformMatrix4(gl, bundle.uniforms.u_model, model);
      uniformMatrix3(gl, bundle.uniforms.u_normalMatrix, normalMatrix3FromMat4(model));
      if (bundle.uniforms.u_highlight) gl.uniform1f(bundle.uniforms.u_highlight, highlights.get(pieceId) ?? 0);
      gl.bindVertexArray(gpu.vao);
      gl.drawArrays(gl.TRIANGLES, 0, gpu.vertexCount);
      this.drawCalls += 1;
    }

    if (this.showEdges) {
      const lineBundle = this.programs.line;
      gl.useProgram(lineBundle.program);
      uniformMatrix4(gl, lineBundle.uniforms.u_viewProjection, viewData.viewProjection);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.depthMask(false);
      for (const [pieceId, gpu] of this.pieceGpu) {
        const model = modelMatrices.get(pieceId);
        if (!model) continue;
        const highlight = highlights.get(pieceId) ?? 0;
        uniformMatrix4(gl, lineBundle.uniforms.u_model, model);
        if (lineBundle.uniforms.u_color) {
          if (highlight > 0.75) gl.uniform4f(lineBundle.uniforms.u_color, 0.3, 0.86, 1, 0.95);
          else gl.uniform4f(lineBundle.uniforms.u_color, 0.003, 0.007, 0.015, 0.62);
        }
        gl.bindVertexArray(gpu.lineVao);
        gl.drawArrays(gl.LINES, 0, gpu.lineVertexCount);
        this.drawCalls += 1;
      }
      gl.depthMask(true);
      gl.disable(gl.BLEND);
    }

    gl.bindVertexArray(null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  /**
   * @param {WebGLFramebuffer|null} framebuffer
   * @param {number} width
   * @param {number} height
   * @param {ViewData} viewData
   * @param {Map<string,Float32Array>} modelMatrices
   * @param {keyof typeof OBSERVATION_MODE} mode
   */
  renderObservationTarget(framebuffer, width, height, viewData, modelMatrices, mode) {
    const gl = this.gl;
    const bundle = this.programs.observation;
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
    gl.viewport(0, 0, width, height);
    gl.clearColor(0, 0, 0, 1);
    gl.clearDepth(1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.CULL_FACE);
    gl.disable(gl.BLEND);
    // Instance/face IDs must survive byte readback exactly. Dithering is useful for pretty
    // gradients and catastrophic for segmentation labels, a distinction GPUs decline to
    // infer from our intentions.
    gl.disable(gl.DITHER);
    gl.useProgram(bundle.program);
    uniformMatrix4(gl, bundle.uniforms.u_view, viewData.view);
    uniformMatrix4(gl, bundle.uniforms.u_viewProjection, viewData.viewProjection);
    if (bundle.uniforms.u_mode) gl.uniform1i(bundle.uniforms.u_mode, OBSERVATION_MODE[mode]);
    if (bundle.uniforms.u_near) gl.uniform1f(bundle.uniforms.u_near, 2.2);
    if (bundle.uniforms.u_far) gl.uniform1f(bundle.uniforms.u_far, 12.0);

    this.drawCalls = 0;
    for (const [pieceId, gpu] of this.pieceGpu) {
      const model = modelMatrices.get(pieceId);
      if (!model) continue;
      uniformMatrix4(gl, bundle.uniforms.u_model, model);
      uniformMatrix3(gl, bundle.uniforms.u_normalMatrix, normalMatrix3FromMat4(model));
      uniform3(gl, bundle.uniforms.u_pieceColor, gpu.pieceColor);
      gl.bindVertexArray(gpu.vao);
      gl.drawArrays(gl.TRIANGLES, 0, gpu.vertexCount);
      this.drawCalls += 1;
    }
    gl.bindVertexArray(null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  /**
   * @param {{viewData:ViewData,modelMatrices:Map<string,Float32Array>,mode:'studio'|'albedo'|'piece'|'face'|'normal'|'depth',highlights?:Map<string,number>}} scene
   */
  render(scene) {
    const start = performance.now();
    this.resizeCanvasToDisplaySize();
    if (scene.mode === 'studio') {
      this.renderShadow(scene.modelMatrices, scene.highlights);
      this.renderStudioTarget(null, this.canvas.width, this.canvas.height, scene.viewData, scene.modelMatrices, scene.highlights ?? new Map());
    } else {
      this.renderObservationTarget(null, this.canvas.width, this.canvas.height, scene.viewData, scene.modelMatrices, scene.mode);
    }
    this.lastRenderMilliseconds = performance.now() - start;
  }

  /**
   * @param {{camera:OrbitCamera,modelMatrices:Map<string,Float32Array>,mode:'studio'|'albedo'|'piece'|'face'|'normal'|'depth',width?:number,height?:number,highlights?:Map<string,number>}} request
   */
  async capture(request) {
    const width = Math.max(64, Math.min(4096, Math.trunc(request.width ?? 1024)));
    const height = Math.max(64, Math.min(4096, Math.trunc(request.height ?? 1024)));
    this.ensureCaptureTarget(width, height);
    const viewData = request.camera.matrices(width / height);
    if (request.mode === 'studio') {
      this.renderShadow(request.modelMatrices, request.highlights);
      this.renderStudioTarget(this.captureFramebuffer, width, height, viewData, request.modelMatrices, request.highlights ?? new Map());
    } else {
      this.renderObservationTarget(this.captureFramebuffer, width, height, viewData, request.modelMatrices, request.mode);
    }
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.captureFramebuffer);
    const pixels = new Uint8Array(width * height * 4);
    gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    const flipped = flipPixelsVertically(pixels, width, height);
    return /** @type {Promise<Blob>} */ (pixelsToPngBlob(flipped, width, height));
  }

  /**
   * @param {number} cssX
   * @param {number} cssY
   * @param {OrbitCamera} camera
   * @param {Map<string,Float32Array>} modelMatrices
   */
  pickPiece(cssX, cssY, camera, modelMatrices) {
    const rect = this.canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    const width = this.canvas.width;
    const height = this.canvas.height;
    this.ensureCaptureTarget(width, height);
    const viewData = camera.matrices(width / height);
    this.renderObservationTarget(this.captureFramebuffer, width, height, viewData, modelMatrices, 'piece');
    const x = Math.max(0, Math.min(width - 1, Math.floor((cssX - rect.left) / rect.width * width)));
    const yFromTop = Math.max(0, Math.min(height - 1, Math.floor((cssY - rect.top) / rect.height * height)));
    const y = height - 1 - yFromTop;
    const pixel = new Uint8Array(4);
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.captureFramebuffer);
    gl.readPixels(x, y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return this.pieceColorLookup.get(`${pixel[0]},${pixel[1]},${pixel[2]}`) ?? null;
  }


  segmentationLegend() {
    if (!this.puzzle) return { pieces: [], faces: [] };
    const puzzle = this.puzzle;
    /** @param {readonly number[]} color */
    const toBytes = (color) => color.map((channel) => Math.round(channel * 255));
    return {
      pieces: puzzle.pieces
        .map((piece, index) => ({ pieceId: piece.id, renderable: piece.renderable, rgb: toBytes(pieceIdColor(index, puzzle.pieces.length)) }))
        .filter((entry) => entry.renderable),
      faces: puzzle.pieces.flatMap((piece, pieceIndex) =>
        piece.renderable
          ? piece.polyhedron.faces.map((face, faceIndex) => ({
              pieceId: piece.id,
              faceIndex,
              tag: face.tag,
              kind: face.kind,
              rgb: toBytes(faceIdColor((this.faceIdBaseByPiece.get(piece.id) ?? 0) + faceIndex)),
            }))
          : [],
      ),
    };
  }

  stats() {
    return {
      drawCalls: this.drawCalls,
      gpuBuffers: this.gpuBuffers,
      renderMilliseconds: this.lastRenderMilliseconds,
      shadowMap: `${this.shadowSize}²`,
      canvas: `${this.canvas.width}×${this.canvas.height}`,
      gpu: this.gpuInfo,
    };
  }
}
