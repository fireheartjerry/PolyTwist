// @ts-check

import { ghostPreset } from './core/presets.js';
import { downloadBlob, SceneController } from './render/scene-controller.js';

/** @typedef {ReturnType<SceneController['publicApi']>} LatentMechanicsLabApi */
/** @typedef {ReturnType<SceneController['agentApi']>} LatentMechanicsAgentApi */
/** @type {Window & typeof globalThis & {kinescope:LatentMechanicsLabApi,kineScopeAgent:LatentMechanicsAgentApi,twistyWorld:LatentMechanicsLabApi,twistyAgent:LatentMechanicsAgentApi,__KINESCOPE_READY__:boolean,__KINESCOPE_ERROR__?:string,__TWISTYWORLD_READY__:boolean,__TWISTYWORLD_ERROR__?:string}} */
const appWindow = /** @type {any} */ (window);

const aliasByMove = Object.freeze({ R: 'α', L: 'β', U: 'γ', D: 'δ', F: 'ε', B: 'ζ' });
const moveByAlias = Object.freeze(Object.fromEntries(Object.entries(aliasByMove).map(([move, alias]) => [alias, move])));

/** @template {HTMLElement} T @param {string} id @returns {T} */
function byId(id) {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing UI element #${id}`);
  return /** @type {T} */ (element);
}

const canvas = byId('world');
const loadingMessage = byId('loadingMessage');
const toast = byId('toast');
let toastTimer = 0;

/** @param {string} message @param {'info'|'error'} [kind] */
function showToast(message, kind = 'info') {
  window.clearTimeout(toastTimer);
  toast.textContent = message;
  toast.classList.toggle('error', kind === 'error');
  toast.classList.add('show');
  toastTimer = window.setTimeout(() => toast.classList.remove('show'), kind === 'error' ? 4200 : 2300);
}

/** @param {unknown} error */
function reportError(error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(error);
  showToast(message, 'error');
}

/** @param {string} token @param {boolean} unknown */
function displayToken(token, unknown) {
  const hasSuffix = token.endsWith("'") || token.endsWith('2');
  const base = (hasSuffix ? token.slice(0, -1) : token).toUpperCase();
  const suffix = hasSuffix ? token.slice(-1).replace(/'/g, '′') : '';
  return `${unknown ? aliasByMove[base] ?? base : base}${suffix}`;
}

/** @param {string} text */
function normalizeSequence(text) {
  let normalized = text.replace(/[’′]/g, "'");
  for (const [alias, move] of Object.entries(moveByAlias)) normalized = normalized.replaceAll(alias, move);
  return normalized.trim().split(/[\s,]+/).filter(Boolean);
}

/** @param {number} value @param {number} digits */
function formatNumber(value, digits = 2) {
  return Number(value).toLocaleString(undefined, { maximumFractionDigits: digits });
}

/** @param {number[]} matrix */
function formatMatrix(matrix) {
  return `[${matrix.slice(0, 3).join(', ')}]\n[${matrix.slice(3, 6).join(', ')}]\n[${matrix.slice(6, 9).join(', ')}]`;
}

/** @param {number[]} coord */
function formatCoord(coord) {
  return `[${coord.join(', ')}]`.replaceAll('-', '−');
}

/** @param {HTMLButtonElement} button @param {boolean} busy @param {string} busyLabel */
function setBusy(button, busy, busyLabel) {
  if (busy) {
    button.dataset.label = button.textContent ?? '';
    button.textContent = busyLabel;
    button.disabled = true;
  } else {
    button.textContent = button.dataset.label || button.textContent;
    button.disabled = false;
  }
}

/** @type {SceneController} */
let controller;
try {
  loadingMessage.textContent = 'Compiling exact mechanics and convex geometry';
  controller = new SceneController(/** @type {HTMLCanvasElement} */ (canvas), ghostPreset());
} catch (error) {
  appWindow.__KINESCOPE_ERROR__ = String(error);
  appWindow.__TWISTYWORLD_ERROR__ = String(error);
  loadingMessage.textContent = error instanceof Error ? error.message : String(error);
  loadingMessage.style.color = '#ff8595';
  throw error;
}

const elements = {
  fps: byId('fpsMetric'),
  triangles: byId('triMetric'),
  pieces: byId('pieceMetric'),
  state: byId('stateMetric'),
  puzzleName: byId('puzzleName'),
  puzzleDescription: byId('puzzleDescription'),
  solvedBadge: byId('solvedBadge'),
  preset: /** @type {HTMLSelectElement} */ (byId('presetSelect')),
  seed: /** @type {HTMLInputElement} */ (byId('artifactSeed')),
  generate: /** @type {HTMLButtonElement} */ (byId('generateArtifactButton')),
  moveGrid: byId('moveGrid'),
  sequence: /** @type {HTMLInputElement} */ (byId('sequenceInput')),
  runSequence: /** @type {HTMLButtonElement} */ (byId('runSequenceButton')),
  unknown: /** @type {HTMLInputElement} */ (byId('unknownMechanicsToggle')),
  scrambleLength: /** @type {HTMLInputElement} */ (byId('scrambleLength')),
  scrambleLengthOutput: byId('scrambleLengthOutput'),
  scramble: /** @type {HTMLButtonElement} */ (byId('scrambleButton')),
  undo: /** @type {HTMLButtonElement} */ (byId('undoButton')),
  redo: /** @type {HTMLButtonElement} */ (byId('redoButton')),
  reset: /** @type {HTMLButtonElement} */ (byId('resetButton')),
  speed: /** @type {HTMLInputElement} */ (byId('speedRange')),
  speedOutput: byId('speedOutput'),
  modeGrid: byId('modeGrid'),
  capture: /** @type {HTMLButtonElement} */ (byId('captureButton')),
  bundle: /** @type {HTMLButtonElement} */ (byId('bundleButton')),
  inspectorEmpty: byId('inspectorEmpty'),
  inspectorData: byId('inspectorData'),
  pieceId: byId('pieceIdValue'),
  pieceCoord: byId('pieceCoordValue'),
  pieceVertices: byId('pieceVertices'),
  pieceFaces: byId('pieceFaces'),
  pieceTriangles: byId('pieceTriangles'),
  pieceVolume: byId('pieceVolume'),
  pieceBandage: byId('pieceBandage'),
  pieceBandageValue: byId('pieceBandageValue'),
  pieceOrientation: byId('pieceOrientation'),
  clearSelection: /** @type {HTMLButtonElement} */ (byId('clearSelectionButton')),
  renderer: byId('rendererValue'),
  drawCalls: byId('drawCallsValue'),
  buffers: byId('buffersValue'),
  shadow: byId('shadowValue'),
  timeline: byId('timelineTrack'),
  moveCount: byId('moveCount'),
  cancelQueue: /** @type {HTMLButtonElement} */ (byId('cancelQueueButton')),
  queueCount: byId('queueCount'),
  cameraReset: /** @type {HTMLButtonElement} */ (byId('cameraResetButton')),
  autoRotate: /** @type {HTMLButtonElement} */ (byId('autoRotateButton')),
  specButton: /** @type {HTMLButtonElement} */ (byId('specButton')),
  specDialog: /** @type {HTMLDialogElement} */ (byId('specDialog')),
  specEditor: /** @type {HTMLTextAreaElement} */ (byId('specEditor')),
  specError: byId('specError'),
  copySpec: /** @type {HTMLButtonElement} */ (byId('copySpecButton')),
  formatSpec: /** @type {HTMLButtonElement} */ (byId('formatSpecButton')),
  applySpec: /** @type {HTMLButtonElement} */ (byId('applySpecButton')),
};

let lastPuzzleId = '';
let lastUnknown = true;

/** @param {ReturnType<SceneController['snapshot']>} snapshot */
function rebuildMoveGrid(snapshot) {
  elements.moveGrid.replaceChildren();
  for (const move of snapshot.mechanics.moves) {
    for (const suffix of ['', "'"]) {
      const token = `${move.id}${suffix}`;
      const button = document.createElement('button');
      button.className = 'move-button';
      button.dataset.token = token;
      button.dataset.moveId = move.id;
      const visibleToken = displayToken(token, snapshot.mechanics.unknown);
      button.title = snapshot.mechanics.unknown ? `Apply withheld action ${visibleToken}` : `Apply ${token}`;
      button.innerHTML = `<span>${visibleToken}</span>`;
      button.addEventListener('click', () => controller.applyMove(token).catch(reportError));
      elements.moveGrid.append(button);
    }
  }
}

/** @param {ReturnType<SceneController['snapshot']>} snapshot */
function updateMoveLegality(snapshot) {
  for (const node of elements.moveGrid.querySelectorAll('.move-button')) {
    const button = /** @type {HTMLButtonElement} */ (node);
    const moveId = button.dataset.moveId ?? '';
    const legal = snapshot.mechanics.legalActionMask[moveId] !== false;
    const disclose = !snapshot.mechanics.unknown;
    button.classList.toggle('blocked', disclose && !legal);
    button.disabled = disclose && !legal;
    button.title = disclose
      ? (!legal
        ? `${button.dataset.token} is blocked by the current rigid-piece constraints`
        : `Apply ${button.dataset.token}`)
      : `Apply withheld action ${displayToken(button.dataset.token ?? '', true)}`;
  }
}

/** @param {ReturnType<SceneController['snapshot']>} snapshot */
function renderTimeline(snapshot) {
  const unknown = snapshot.mechanics.unknown;
  const nodes = [];
  const history = snapshot.state.history.slice(-26);
  for (const token of history) {
    const item = document.createElement('span');
    item.className = 'trace-token';
    item.textContent = displayToken(token, unknown);
    item.title = unknown ? 'Withheld action' : token;
    nodes.push(item);
  }
  if (snapshot.motion.activeToken) {
    const item = document.createElement('span');
    item.className = 'trace-token active';
    item.textContent = displayToken(snapshot.motion.activeToken, unknown);
    item.style.setProperty('--progress', `${snapshot.motion.activeProgress * 100}%`);
    nodes.push(item);
  }
  for (const token of snapshot.motion.queuedTokens.slice(0, 18)) {
    const item = document.createElement('span');
    item.className = 'trace-token queued';
    item.textContent = displayToken(token, unknown);
    nodes.push(item);
  }
  if (nodes.length === 0) {
    const empty = document.createElement('span');
    empty.className = 'timeline-empty';
    empty.textContent = 'No transformations committed';
    nodes.push(empty);
  }
  elements.timeline.replaceChildren(...nodes);
}

/** @param {ReturnType<SceneController['snapshot']>} snapshot */
function updateUi(snapshot) {
  elements.fps.textContent = snapshot.render.fps ? snapshot.render.fps.toFixed(0) : '--';
  elements.triangles.textContent = formatNumber(snapshot.puzzle.stats.totalTriangles, 0);
  elements.pieces.textContent = String(snapshot.puzzle.stats.renderablePieces);
  const queueSize = snapshot.motion.queuedTokens.length;
  if (snapshot.motion.activeToken) {
    elements.state.textContent = `${displayToken(snapshot.motion.activeToken, snapshot.mechanics.unknown)} · ${queueSize} QUEUED`;
  } else {
    elements.state.textContent = snapshot.state.solved ? 'CANONICAL' : 'PERTURBED';
  }
  elements.puzzleName.textContent = snapshot.puzzle.name;
  elements.puzzleDescription.textContent = snapshot.puzzle.description;
  elements.solvedBadge.textContent = snapshot.state.solved ? 'SOLVED' : 'TRANSFORMED';
  elements.solvedBadge.classList.toggle('unsolved', !snapshot.state.solved);
  elements.unknown.checked = snapshot.mechanics.unknown;
  elements.sequence.placeholder = snapshot.mechanics.unknown ? 'α γ α′ γ′' : 'R U R′ U′';
  elements.speed.value = String(snapshot.motion.speed);
  elements.speedOutput.textContent = `${snapshot.motion.speed.toFixed(1)}/s`;

  if (snapshot.puzzle.id.startsWith('alien-')) elements.preset.value = 'alien';
  else if ([...elements.preset.options].some((option) => option.value === snapshot.puzzle.id)) elements.preset.value = snapshot.puzzle.id;

  if (lastPuzzleId !== snapshot.puzzle.id || lastUnknown !== snapshot.mechanics.unknown) {
    rebuildMoveGrid(snapshot);
    lastPuzzleId = snapshot.puzzle.id;
    lastUnknown = snapshot.mechanics.unknown;
  }
  updateMoveLegality(snapshot);

  for (const button of elements.modeGrid.querySelectorAll('[data-mode]')) {
    button.classList.toggle('active', button.getAttribute('data-mode') === snapshot.render.mode);
  }

  const piece = snapshot.selectedPiece;
  elements.inspectorEmpty.hidden = Boolean(piece);
  elements.inspectorData.hidden = !piece;
  if (piece) {
    elements.pieceId.textContent = piece.pieceId;
    elements.pieceCoord.textContent = `${formatCoord(piece.homeCoord)} → ${formatCoord(piece.currentCoord)}`;
    elements.pieceVertices.textContent = String(piece.vertices);
    elements.pieceFaces.textContent = String(piece.faces);
    elements.pieceTriangles.textContent = String(piece.triangles);
    elements.pieceVolume.textContent = piece.volume.toFixed(4);
    elements.pieceBandage.hidden = !piece.bandage;
    elements.pieceBandageValue.textContent = piece.bandage
      ? `${piece.bandage.label} · ${piece.bandage.pieceIds.length} pieces`
      : '';
    elements.pieceOrientation.textContent = formatMatrix(piece.orientation);
  }

  const rendererStats = snapshot.render.rendererStats;
  elements.renderer.textContent = rendererStats.gpu.renderer;
  elements.renderer.title = `${rendererStats.gpu.vendor} · ${rendererStats.gpu.renderer}`;
  elements.drawCalls.textContent = String(rendererStats.drawCalls);
  elements.buffers.textContent = String(rendererStats.gpuBuffers);
  elements.shadow.textContent = rendererStats.shadowMap;
  elements.moveCount.textContent = `${snapshot.state.history.length} MOVE${snapshot.state.history.length === 1 ? '' : 'S'}`;
  elements.queueCount.textContent = String(queueSize + (snapshot.motion.activeToken ? 1 : 0));
  elements.undo.disabled = snapshot.state.history.length === 0 || Boolean(snapshot.motion.activeToken);
  elements.redo.disabled = snapshot.state.future.length === 0 || Boolean(snapshot.motion.activeToken);
  elements.cancelQueue.disabled = queueSize === 0 && !snapshot.motion.activeToken;
  renderTimeline(snapshot);
}

controller.subscribe(updateUi);
controller.start();

async function loadSelectedPreset() {
  const preset = elements.preset.value;
  document.body.classList.remove('ready');
  loadingMessage.textContent = preset === 'alien' ? 'Generating and validating unseen geometry' : 'Compiling puzzle specification';
  await new Promise((resolve) => requestAnimationFrame(resolve));
  try {
    controller.setPreset(preset, elements.seed.value.trim() || 'artifact-001');
    showToast(`${controller.puzzle.spec.name} compiled successfully`);
  } catch (error) {
    reportError(error);
  } finally {
    document.body.classList.add('ready');
  }
}

elements.preset.addEventListener('change', loadSelectedPreset);
elements.generate.addEventListener('click', () => {
  elements.preset.value = 'alien';
  loadSelectedPreset();
});
elements.seed.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    elements.preset.value = 'alien';
    loadSelectedPreset();
  }
});

elements.unknown.addEventListener('change', () => controller.setUnknownMechanics(elements.unknown.checked));
elements.sequence.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') elements.runSequence.click();
});
elements.runSequence.addEventListener('click', async () => {
  const tokens = normalizeSequence(elements.sequence.value);
  if (tokens.length === 0) return;
  setBusy(elements.runSequence, true, 'RUNNING');
  try {
    await controller.applySequence(tokens);
  } catch (error) {
    reportError(error);
  } finally {
    setBusy(elements.runSequence, false, 'RUNNING');
  }
});

elements.scrambleLength.addEventListener('input', () => {
  elements.scrambleLengthOutput.textContent = elements.scrambleLength.value;
});
elements.scramble.addEventListener('click', async () => {
  setBusy(elements.scramble, true, 'RUNNING');
  try {
    const tokens = await controller.scramble(Number(elements.scrambleLength.value), elements.seed.value || 'artifact-001');
    elements.sequence.value = tokens.map((token) => displayToken(token, controller.unknownMechanics)).join(' ');
  } catch (error) {
    reportError(error);
  } finally {
    setBusy(elements.scramble, false, 'RUNNING');
  }
});
elements.undo.addEventListener('click', () => controller.undo());
elements.redo.addEventListener('click', () => controller.redo());
elements.reset.addEventListener('click', () => {
  controller.reset();
  showToast('Artifact returned to canonical state');
});
elements.cancelQueue.addEventListener('click', () => controller.clearQueue());
elements.speed.addEventListener('input', () => controller.setMoveSpeed(Number(elements.speed.value)));

elements.modeGrid.addEventListener('click', (event) => {
  const target = /** @type {HTMLElement|null} */ (event.target instanceof HTMLElement ? event.target.closest('[data-mode]') : null);
  if (!target) return;
  controller.setRenderMode(/** @type {any} */ (target.dataset.mode));
});

elements.capture.addEventListener('click', async () => {
  setBusy(elements.capture, true, 'RENDERING');
  try {
    const mode = controller.renderMode;
    const blob = await controller.capture(mode, { width: 1400, height: 1400 });
    downloadBlob(blob, `${controller.puzzle.spec.id}-${mode}.png`);
    showToast(`${mode} pass exported at 1400×1400`);
  } catch (error) {
    reportError(error);
  } finally {
    setBusy(elements.capture, false, 'RENDERING');
  }
});

elements.bundle.addEventListener('click', async () => {
  setBusy(elements.bundle, true, 'PACKAGING');
  try {
    const blob = await controller.exportBundle({ width: 1024, height: 1024 });
    downloadBlob(blob, controller.bundleFilename());
    showToast('Research episode exported with six synchronized passes');
  } catch (error) {
    reportError(error);
  } finally {
    setBusy(elements.bundle, false, 'PACKAGING');
  }
});

elements.clearSelection.addEventListener('click', () => {
  controller.selectedPieceId = null;
  controller.emit(true);
});
elements.cameraReset.addEventListener('click', () => controller.camera.reset());
elements.autoRotate.addEventListener('click', () => {
  controller.camera.autoRotate = !controller.camera.autoRotate;
  elements.autoRotate.classList.toggle('active', controller.camera.autoRotate);
});

elements.specButton.addEventListener('click', () => {
  elements.specEditor.value = JSON.stringify(controller.puzzle.spec, null, 2);
  elements.specError.textContent = '';
  elements.specDialog.showModal();
});
elements.copySpec.addEventListener('click', async (event) => {
  event.preventDefault();
  try {
    await navigator.clipboard.writeText(elements.specEditor.value);
    showToast('Specification copied');
  } catch (error) {
    reportError(error);
  }
});
elements.formatSpec.addEventListener('click', (event) => {
  event.preventDefault();
  try {
    elements.specEditor.value = JSON.stringify(JSON.parse(elements.specEditor.value), null, 2);
    elements.specError.textContent = '';
  } catch (error) {
    elements.specError.textContent = error instanceof Error ? error.message : String(error);
  }
});
elements.applySpec.addEventListener('click', async (event) => {
  event.preventDefault();
  elements.specError.textContent = '';
  try {
    const spec = JSON.parse(elements.specEditor.value);
    controller.setPuzzleSpec(spec);
    elements.specDialog.close();
    showToast('Custom artifact compiled and validated');
  } catch (error) {
    elements.specError.textContent = error instanceof Error ? error.message : String(error);
  }
});

window.addEventListener('keydown', (event) => {
  const target = event.target;
  if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) return;
  const key = event.key.toUpperCase();
  if (['R', 'L', 'U', 'D', 'F', 'B'].includes(key)) {
    event.preventDefault();
    controller.applyMove(`${key}${event.shiftKey ? "'" : ''}`).catch(reportError);
  } else if (event.code === 'Space') {
    event.preventDefault();
    elements.scramble.click();
  } else if (key === 'Z') {
    event.preventDefault();
    controller.undo();
  } else if (key === 'Y') {
    event.preventDefault();
    controller.redo();
  } else if (event.key === 'Escape' && !elements.specDialog.open) {
    controller.clearQueue();
  }
});

appWindow.kinescope = controller.publicApi();
appWindow.kineScopeAgent = controller.agentApi();
// Deprecated compatibility aliases for v0.2 harnesses.
appWindow.twistyWorld = appWindow.kinescope;
appWindow.twistyAgent = appWindow.kineScopeAgent;
appWindow.__KINESCOPE_READY__ = true;
appWindow.__TWISTYWORLD_READY__ = true;
appWindow.dispatchEvent(new CustomEvent('kinescope:ready', { detail: { version: appWindow.kinescope.version } }));
appWindow.dispatchEvent(new CustomEvent('twistyworld:ready', { detail: { version: appWindow.kinescope.version, deprecated: true } }));
document.body.classList.add('ready');
loadingMessage.textContent = 'Ready';
