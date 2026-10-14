import * as THREE from 'three';
import { ARENA_CONFIG } from '../game/GameConfig';

/** Cámara elevada fija que siempre muestra todo el estadio. */
export class CameraController {
  readonly camera = new THREE.PerspectiveCamera(38, 1, 0.1, 300);
  private readonly elevation = THREE.MathUtils.degToRad(58);
  private shake = 0;
  private base = new THREE.Vector3();

  resize(width: number, height: number): void {
    const aspect = width / Math.max(1, height);
    this.camera.aspect = aspect;
    const R = ARENA_CONFIG.radius + 1.4;
    const vfov = THREE.MathUtils.degToRad(this.camera.fov);
    const hfov = 2 * Math.atan(Math.tan(vfov / 2) * aspect);
    const needV = (R * (Math.sin(this.elevation) + 0.35)) / Math.tan(vfov / 2);
    const needH = R / Math.tan(hfov / 2);
    const dist = Math.max(needV, needH) * (aspect < 1 ? 1.05 : 1);
    this.camera.position.set(0, Math.sin(this.elevation) * dist, Math.cos(this.elevation) * dist);
    this.camera.lookAt(0, aspect < 1 ? 1.2 : 0.4, aspect < 1 ? -0.9 : -0.3);
    this.camera.updateProjectionMatrix();
    this.base.copy(this.camera.position);
  }

  bump(amount: number): void {
    this.shake = Math.min(0.12, this.shake + amount);
  }

  update(dt: number): void {
    if (this.shake <= 0.001) {
      this.camera.position.copy(this.base);
      return;
    }
    this.shake *= Math.exp(-dt * 10);
    const t = performance.now() / 1000;
    this.camera.position.set(this.base.x + Math.sin(t * 50) * this.shake, this.base.y + Math.cos(t * 43) * this.shake * 0.5, this.base.z);
  }
}
