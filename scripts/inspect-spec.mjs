import { writeFile } from 'node:fs/promises';
import { compilePuzzle } from '../src/core/puzzle-compiler.js';
import { PuzzleEngine } from '../src/core/puzzle-engine.js';
import { createPreset, presetCatalog } from '../src/core/presets.js';

const [presetId = 'ghost-3', seed = 'artifact-001', outputFlag, outputPath] = process.argv.slice(2);
if (presetId === '--list') {
  console.log([...presetCatalog.map((entry) => entry.id), 'alien'].join('\n'));
  process.exit(0);
}

const puzzle = compilePuzzle(createPreset(presetId, seed));
const engine = new PuzzleEngine(puzzle);
const report = {
  schema: 'kinescope.compile-report.v1',
  spec: puzzle.spec,
  frame: puzzle.frame,
  stats: puzzle.stats,
  moves: puzzle.moves,
  legalActionMask: engine.legalActionMask(),
  constraints: {
    bandages: puzzle.constraints.bandages.map((bandage) => ({
      id: bandage.id,
      label: bandage.label,
      pieceIds: bandage.pieceIds,
      cells: bandage.cells,
      centroid: bandage.centroid,
    })),
  },
  pieces: puzzle.pieces.map((piece) => ({
    id: piece.id,
    homeCoord: piece.homeCoord,
    renderable: piece.renderable,
    vertices: piece.polyhedron.vertices.length,
    faces: piece.polyhedron.faces.length,
    triangles: piece.polyhedron.triangles.length,
    volume: piece.polyhedron.volume,
    outerArea: piece.outerArea,
  })),
};
console.log(JSON.stringify(report, null, 2));
if (outputFlag === '--output' && outputPath) await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`);
