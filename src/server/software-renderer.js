// @ts-check

import { deflateSync } from 'node:zlib';
import { compilePuzzle } from '../core/puzzle-compiler.js';
import { PuzzleEngine } from '../core/puzzle-engine.js';
import { crc32 } from '../core/zip.js';
import { logicalRotationToWorld } from '../core/frame.js';
import { v3 } from '../core/vec3.js';
import { buildPieceMeshData } from '../render/mesh-data.js';
import { mat4AroundOrigin, mat4LookAt, mat4Multiply, mat4Perspective } from '../render/mat4.js';

/** @typedef {import('../core/puzzle-compiler.js').PuzzleSpec} PuzzleSpec */
/** @typedef {'studio'|'albedo'|'piece'|'face'|'normal'|'depth'} RenderMode */

const PNG_SIGNATURE = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);

/** @param {Uint8Array} bytes */
function digestBytes(bytes) {
  const seeds = [0x811c9dc5, 0x9e3779b9, 0x85ebca6b, 0xc2b2ae35];
  const words = seeds.map((seed, lane) => {
    let hash = seed >>> 0;
    for (let index = lane; index < bytes.length; index += 4) {
      hash ^= bytes[index];
      hash = Math.imul(hash, 16777619);
      hash ^= hash >>> 13;
    }
    return (hash >>> 0).toString(16).padStart(8, '0');
  });
  return `kinescope-png1-${words.join('')}`;
}

/** @param {number} value */
function clampByte(value) {
  return Math.max(0, Math.min(255, Math.round(value)));
}

/** @param {number} value */
function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

/** @param {string} type @param {Uint8Array} data */
function pngChunk(type, data) {
  const typeBytes = new TextEncoder().encode(type);
  const output = new Uint8Array(12 + data.length);
  const view = new DataView(output.buffer);
  view.setUint32(0, data.length, false);
  output.set(typeBytes, 4);
  output.set(data, 8);
  const crcInput = new Uint8Array(typeBytes.length + data.length);
  crcInput.set(typeBytes);
  crcInput.set(data, typeBytes.length);
  view.setUint32(8 + data.length, crc32(crcInput), false);
  return output;
}

/** @param {Uint8Array[]} arrays */
function concatBytes(arrays) {
  const length = arrays.reduce((sum, array) => sum + array.length, 0);
  const output = new Uint8Array(length);
  let offset = 0;
  for (const array of arrays) {
    output.set(array, offset);
    offset += array.length;
  }
  return output;
}

/** @param {Uint8Array} rgba @param {number} width @param {number} height */
export function encodePng(rgba, width, height) {
  if (rgba.length !== width * height * 4) throw new Error('RGBA byte length does not match image dimensions.');
  const raw = new Uint8Array(height * (1 + width * 4));
  for (let y = 0; y < height; y += 1) {
    const destination = y * (1 + width * 4);
    raw[destination] = 0;
    raw.set(rgba.subarray(y * width * 4, (y + 1) * width * 4), destination + 1);
  }
  const ihdr = new Uint8Array(13);
  const view = new DataView(ihdr.buffer);
  view.setUint32(0, width, false);
  view.setUint32(4, height, false);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  const compressed = new Uint8Array(deflateSync(raw, { level: 6 }));
  return concatBytes([
    PNG_SIGNATURE,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', compressed),
    pngChunk('IEND', new Uint8Array()),
  ]);
}

/** @param {ArrayLike<number>} matrix @param {[number,number,number]} point */
function transform4(matrix, point) {
  const [x, y, z] = point;
  return [
    matrix[0] * x + matrix[4] * y + matrix[8] * z + matrix[12],
    matrix[1] * x + matrix[5] * y + matrix[9] * z + matrix[13],
    matrix[2] * x + matrix[6] * y + matrix[10] * z + matrix[14],
    matrix[3] * x + matrix[7] * y + matrix[11] * z + matrix[15],
  ];
}

/** @param {ArrayLike<number>} matrix @param {[number,number,number]} direction */
function transform3(matrix, direction) {
  const [x, y, z] = direction;
  return [
    matrix[0] * x + matrix[4] * y + matrix[8] * z,
    matrix[1] * x + matrix[5] * y + matrix[9] * z,
    matrix[2] * x + matrix[6] * y + matrix[10] * z,
  ];
}

/** @param {number[]} vector */
function normalize3(vector) {
  const length = Math.hypot(vector[0], vector[1], vector[2]) || 1;
  return [vector[0] / length, vector[1] / length, vector[2] / length];
}

/** @param {number[]} a @param {number[]} b */
function dot3(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

/** @param {number} x */
function aces(x) {
  return clamp01((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14));
}

/** @param {number[]} albedo @param {number[]} normal @param {number[]} world @param {number[]} eye */
function studioColor(albedo, normal, world, eye) {
  const n = normalize3(normal);
  const light = normalize3([0.5, 0.82, 0.34]);
  const view = normalize3([eye[0] - world[0], eye[1] - world[1], eye[2] - world[2]]);
  const diffuse = Math.max(0, dot3(n, light));
  const rim = (1 - Math.max(0, dot3(n, view))) ** 2.6;
  const sky = 0.5 + 0.5 * n[1];
  return albedo.map((channel, index) => {
    const ambient = channel * (0.18 + 0.16 * sky);
    const direct = channel * diffuse * 1.5;
    const coolRim = [0.12, 0.2, 0.34][index] * rim;
    return Math.pow(aces((ambient + direct + coolRim) * 1.06), 1 / 2.2);
  });
}

/** @param {number} ax @param {number} ay @param {number} bx @param {number} by @param {number} px @param {number} py */
function edge(ax, ay, bx, by, px, py) {
  return (px - ax) * (by - ay) - (py - ay) * (bx - ax);
}

/** @param {PuzzleEngine} engine @param {{yaw?:number,pitch?:number,distance?:number,fovDegrees?:number,target?:number[],near?:number,far?:number}} camera @param {number} aspect */
function cameraMatrices(engine, camera, aspect) {
  const target = camera.target ?? [0, 0.08, 0];
  const distance = Number(camera.distance ?? Math.max(6.8, engine.puzzle.spec.size * 2.7));
  const yaw = Number(camera.yaw ?? 0.72);
  const pitch = Number(camera.pitch ?? 0.38);
  const near = Number(camera.near ?? 0.05);
  const far = Number(camera.far ?? 60);
  const cp = Math.cos(pitch);
  const eye = [
    target[0] + distance * cp * Math.sin(yaw),
    target[1] + distance * Math.sin(pitch),
    target[2] + distance * cp * Math.cos(yaw),
  ];
  const view = mat4LookAt(v3(...eye), v3(target[0], target[1], target[2]), v3(0, 1, 0));
  const projection = mat4Perspective((Number(camera.fovDegrees ?? 38) * Math.PI) / 180, aspect, near, far);
  return { eye, target, near, far, view, projection, viewProjection: mat4Multiply(projection, view) };
}

/** @param {PuzzleEngine} engine */
function modelMatrices(engine) {
  const output = new Map();
  for (const piece of engine.puzzle.pieces) {
    if (!piece.renderable) continue;
    const worldRotation = logicalRotationToWorld(engine.puzzle.frame, engine.getPieceTransform(piece.id));
    output.set(piece.id, mat4AroundOrigin(worldRotation, engine.puzzle.frame.origin));
  }
  return output;
}

/**
 * Deterministic dependency-free CPU rasterizer for API-side dataset generation.
 * It is intentionally not a photoreal path tracer; it is a synchronized ground-truth renderer.
 *
 * @param {{spec:PuzzleSpec,state?:ReturnType<PuzzleEngine['serialize']>,sequence?:string[],mode?:RenderMode,width?:number,height?:number,camera?:Record<string,unknown>,background?:[number,number,number]}} request
 */
export function renderPuzzlePng(request) {
  const width = Math.max(32, Math.min(2048, Math.trunc(request.width ?? 512)));
  const height = Math.max(32, Math.min(2048, Math.trunc(request.height ?? 512)));
  const mode = request.mode ?? 'studio';
  if (!['studio', 'albedo', 'piece', 'face', 'normal', 'depth'].includes(mode)) throw new Error(`Unsupported render mode ${mode}.`);
  const puzzle = compilePuzzle(request.spec);
  const engine = new PuzzleEngine(puzzle);
  if (request.state) engine.load(request.state);
  for (const token of request.sequence ?? []) engine.applyMove(token);

  const rgba = new Uint8Array(width * height * 4);
  const defaultBackground = mode === 'studio' ? [0.012, 0.018, 0.032] : [0, 0, 0];
  const background = request.background ?? defaultBackground;
  for (let index = 0; index < width * height; index += 1) {
    rgba[index * 4] = clampByte(background[0] * 255);
    rgba[index * 4 + 1] = clampByte(background[1] * 255);
    rgba[index * 4 + 2] = clampByte(background[2] * 255);
    rgba[index * 4 + 3] = 255;
  }
  const zbuffer = new Float64Array(width * height);
  zbuffer.fill(Infinity);
  const camera = cameraMatrices(engine, /** @type {any} */ (request.camera ?? {}), width / height);
  const models = modelMatrices(engine);
  let faceIdBase = 0;
  let trianglesSubmitted = 0;
  let trianglesRasterized = 0;
  let fragmentWrites = 0;
  let uniquePixelsWritten = 0;
  const touchedPixels = new Uint8Array(width * height);
  const visiblePieceIds = new Set();

  for (let pieceIndex = 0; pieceIndex < puzzle.pieces.length; pieceIndex += 1) {
    const piece = puzzle.pieces[pieceIndex];
    if (!piece.renderable) continue;
    const model = models.get(piece.id);
    if (!model) continue;
    const mesh = buildPieceMeshData(puzzle, piece, pieceIndex, faceIdBase);
    const mvp = mat4Multiply(camera.viewProjection, model);
    for (let triangle = 0; triangle < mesh.triangleCount; triangle += 1) {
      trianglesSubmitted += 1;
      const vertices = [];
      let skip = false;
      for (let corner = 0; corner < 3; corner += 1) {
        const offset = triangle * 9 + corner * 3;
        const local = /** @type {[number,number,number]} */ ([mesh.positions[offset], mesh.positions[offset + 1], mesh.positions[offset + 2]]);
        const clip = transform4(mvp, local);
        if (clip[3] <= 1e-8) { skip = true; break; }
        const ndc = [clip[0] / clip[3], clip[1] / clip[3], clip[2] / clip[3]];
        const world4 = transform4(model, local);
        const normal = normalize3(transform3(model, /** @type {[number,number,number]} */ ([mesh.normals[offset], mesh.normals[offset + 1], mesh.normals[offset + 2]])));
        const view4 = transform4(camera.view, /** @type {[number,number,number]} */ ([world4[0], world4[1], world4[2]]));
        vertices.push({
          x: (ndc[0] * 0.5 + 0.5) * (width - 1),
          y: (1 - (ndc[1] * 0.5 + 0.5)) * (height - 1),
          z: ndc[2],
          viewDepth: -view4[2],
          world: [world4[0], world4[1], world4[2]],
          normal,
        });
      }
      if (skip || vertices.length !== 3) continue;
      const [a, b, c] = vertices;
      const area = edge(a.x, a.y, b.x, b.y, c.x, c.y);
      if (area >= -1e-9) continue;
      const minX = Math.max(0, Math.floor(Math.min(a.x, b.x, c.x)));
      const maxX = Math.min(width - 1, Math.ceil(Math.max(a.x, b.x, c.x)));
      const minY = Math.max(0, Math.floor(Math.min(a.y, b.y, c.y)));
      const maxY = Math.min(height - 1, Math.ceil(Math.max(a.y, b.y, c.y)));
      if (maxX < minX || maxY < minY) continue;
      trianglesRasterized += 1;
      const albedoOffset = triangle * 9;
      const albedo = [mesh.colors[albedoOffset], mesh.colors[albedoOffset + 1], mesh.colors[albedoOffset + 2]];
      const faceColor = [mesh.faceColors[albedoOffset], mesh.faceColors[albedoOffset + 1], mesh.faceColors[albedoOffset + 2]];
      for (let y = minY; y <= maxY; y += 1) {
        for (let x = minX; x <= maxX; x += 1) {
          const px = x + 0.5;
          const py = y + 0.5;
          const w0 = edge(b.x, b.y, c.x, c.y, px, py) / area;
          const w1 = edge(c.x, c.y, a.x, a.y, px, py) / area;
          const w2 = 1 - w0 - w1;
          if (w0 < -1e-8 || w1 < -1e-8 || w2 < -1e-8) continue;
          const depth = w0 * a.z + w1 * b.z + w2 * c.z;
          const pixel = y * width + x;
          if (depth >= zbuffer[pixel]) continue;
          zbuffer[pixel] = depth;
          const normal = normalize3([
            w0 * a.normal[0] + w1 * b.normal[0] + w2 * c.normal[0],
            w0 * a.normal[1] + w1 * b.normal[1] + w2 * c.normal[1],
            w0 * a.normal[2] + w1 * b.normal[2] + w2 * c.normal[2],
          ]);
          const world = [
            w0 * a.world[0] + w1 * b.world[0] + w2 * c.world[0],
            w0 * a.world[1] + w1 * b.world[1] + w2 * c.world[1],
            w0 * a.world[2] + w1 * b.world[2] + w2 * c.world[2],
          ];
          const viewDepth = w0 * a.viewDepth + w1 * b.viewDepth + w2 * c.viewDepth;
          let color;
          if (mode === 'piece') color = mesh.pieceColor;
          else if (mode === 'face') color = faceColor;
          else if (mode === 'normal') color = normal.map((value) => value * 0.5 + 0.5);
          else if (mode === 'depth') {
            const scalar = 1 - clamp01((viewDepth - camera.near) / (camera.far - camera.near));
            color = [scalar, scalar, scalar];
          } else if (mode === 'albedo') color = albedo;
          else color = studioColor(albedo, normal, world, camera.eye);
          const byteOffset = pixel * 4;
          rgba[byteOffset] = clampByte(color[0] * 255);
          rgba[byteOffset + 1] = clampByte(color[1] * 255);
          rgba[byteOffset + 2] = clampByte(color[2] * 255);
          rgba[byteOffset + 3] = 255;
          fragmentWrites += 1;
          if (touchedPixels[pixel] === 0) {
            touchedPixels[pixel] = 1;
            uniquePixelsWritten += 1;
          }
          visiblePieceIds.add(piece.id);
        }
      }
    }
    faceIdBase += piece.polyhedron.faces.length;
  }

  const png = encodePng(rgba, width, height);
  const metadata = {
    schema: 'kinescope.render-metadata.v1',
    puzzleId: puzzle.spec.id,
    stateFingerprint: engine.stateFingerprint(),
    mode,
    width,
    height,
    camera: {
      eye: camera.eye,
      target: camera.target,
      near: camera.near,
      far: camera.far,
      ...(request.camera ?? {}),
    },
    statistics: {
      trianglesSubmitted,
      trianglesRasterized,
      fragmentWrites,
      uniquePixelsWritten,
      visiblePixelFraction: uniquePixelsWritten / (width * height),
      visiblePieceCount: visiblePieceIds.size,
      renderablePieceCount: puzzle.stats.renderablePieces,
    },
    imageDigest: digestBytes(png),
  };
  return { png, rgba, metadata };
}
