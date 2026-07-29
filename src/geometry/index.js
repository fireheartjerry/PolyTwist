export { compileAffineGeometry } from './affine-compiler.js';
export { verifyAffineGeometry } from './affine-verifier.js';
export {
  clipExactPolyhedron,
  evaluateExactPlane,
  exactPointKey,
  intersectExactFaceWithPlane,
  intersectExactHalfspaces,
  validateExactPolyhedron,
} from './exact-polyhedron.js';
export {
  normalizePlane,
  parseRational,
  rationalKey,
  rationalToNumber,
} from './rational.js';
export { canonicalSha256, canonicalStringify, sha256 } from './sha256.js';
