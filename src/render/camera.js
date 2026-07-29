// @ts-check

import { add, cross, normalize, scale, sub, v3 } from '../core/vec3.js';
import { mat4LookAt, mat4Multiply, mat4Perspective } from './mat4.js';

/** @typedef {import('../core/vec3.js').Vec3} Vec3 */

export class OrbitCamera {
  /** @param {HTMLCanvasElement} canvas */
  constructor(canvas) {
    this.canvas = canvas;
    this.target = v3(0, 0.08, 0);
    this.distance = 8.15;
    this.yaw = 0.72;
    this.pitch = 0.38;
    this.fov = 38 * Math.PI / 180;
    this.near = 0.05;
    this.far = 60;
    this.minDistance = 3.4;
    this.maxDistance = 13;
    this.autoRotate = false;
    this.enabled = true;
    this.pointer = null;
    this.lastReleaseWasDrag = false;
    this.installEvents();
  }

  installEvents() {
    this.canvas.addEventListener('contextmenu', (event) => event.preventDefault());
    this.canvas.addEventListener('pointerdown', (event) => {
      if (!this.enabled) return;
      this.canvas.setPointerCapture(event.pointerId);
      this.pointer = {
        id: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        button: event.button,
        moved: false,
      };
    });
    this.canvas.addEventListener('pointermove', (event) => {
      if (!this.enabled || !this.pointer || this.pointer.id !== event.pointerId) return;
      const dx = event.clientX - this.pointer.x;
      const dy = event.clientY - this.pointer.y;
      if (Math.abs(dx) + Math.abs(dy) > 1.5) this.pointer.moved = true;
      this.pointer.x = event.clientX;
      this.pointer.y = event.clientY;
      const pan = this.pointer.button === 1 || this.pointer.button === 2 || event.shiftKey || event.ctrlKey || event.metaKey;
      if (pan) this.pan(dx, dy);
      else this.rotate(dx, dy);
    });
    const finish = (event) => {
      if (!this.pointer || this.pointer.id !== event.pointerId) return;
      this.canvas.releasePointerCapture(event.pointerId);
      this.lastReleaseWasDrag = this.pointer.moved;
      this.pointer = null;
    };
    this.canvas.addEventListener('pointerup', finish);
    this.canvas.addEventListener('pointercancel', finish);
    this.canvas.addEventListener('wheel', (event) => {
      if (!this.enabled) return;
      event.preventDefault();
      this.distance *= Math.exp(event.deltaY * 0.0012);
      this.distance = Math.max(this.minDistance, Math.min(this.maxDistance, this.distance));
    }, { passive: false });
  }

  /** @param {number} dx @param {number} dy */
  rotate(dx, dy) {
    this.yaw -= dx * 0.0052;
    this.pitch -= dy * 0.0046;
    const limit = Math.PI / 2 - 0.045;
    this.pitch = Math.max(-limit, Math.min(limit, this.pitch));
  }

  /** @param {number} dx @param {number} dy */
  pan(dx, dy) {
    const eye = this.position();
    const forward = normalize(sub(this.target, eye));
    const right = normalize(cross(forward, v3(0, 1, 0)));
    const up = normalize(cross(right, forward));
    const scaleFactor = this.distance * 0.00125;
    this.target = add(this.target, add(scale(right, -dx * scaleFactor), scale(up, dy * scaleFactor)));
  }

  /** @param {number} deltaSeconds */
  update(deltaSeconds) {
    if (this.autoRotate && !this.pointer) this.yaw += deltaSeconds * 0.16;
  }

  /** @returns {Vec3} */
  position() {
    const cp = Math.cos(this.pitch);
    return v3(
      this.target.x + this.distance * cp * Math.sin(this.yaw),
      this.target.y + this.distance * Math.sin(this.pitch),
      this.target.z + this.distance * cp * Math.cos(this.yaw),
    );
  }

  /** @param {number} aspect */
  matrices(aspect) {
    const eye = this.position();
    const view = mat4LookAt(eye, this.target, v3(0, 1, 0));
    const projection = mat4Perspective(this.fov, Math.max(0.05, aspect), this.near, this.far);
    return { eye, view, projection, viewProjection: mat4Multiply(projection, view) };
  }

  reset() {
    this.target = v3(0, 0.08, 0);
    this.distance = 8.15;
    this.yaw = 0.72;
    this.pitch = 0.38;
  }

  serialize() {
    return {
      target: [this.target.x, this.target.y, this.target.z],
      distance: this.distance,
      yaw: this.yaw,
      pitch: this.pitch,
      fovRadians: this.fov,
      near: this.near,
      far: this.far,
    };
  }
}
