import RAPIER from '@dimforge/rapier3d-compat';
import { ARENA_CONFIG, PHYSICS_CONFIG } from './GameConfig';
import { buildSurfaceMesh, lipSegments, surfaceHeight } from './Arena';

let ready: Promise<void> | null = null;

export function initPhysics(): Promise<void> {
  if (!ready) ready = RAPIER.init();
  return ready;
}

export type Body = RAPIER.RigidBody;

/** Estadio fijo (misma malla que se dibuja) + cuerpos de los trompos. */
export class PhysicsWorld {
  readonly world: RAPIER.World;

  constructor() {
    this.world = new RAPIER.World({ x: 0, y: PHYSICS_CONFIG.gravity, z: 0 });
    this.world.timestep = PHYSICS_CONFIG.timestep;
    const a = ARENA_CONFIG;
    const mesh = buildSurfaceMesh(a);
    this.world.createCollider(
      RAPIER.ColliderDesc.trimesh(mesh.vertices, mesh.indices).setFriction(PHYSICS_CONFIG.friction).setRestitution(0.2),
    );
    const rMid = a.radius + a.lipThickness / 2;
    for (const seg of lipSegments(a)) {
      const half = a.lipHeight / 2;
      const yaw = -seg.angle;
      this.world.createCollider(
        RAPIER.ColliderDesc.cuboid(a.lipThickness / 2, half, seg.length / 2)
          .setTranslation(Math.cos(seg.angle) * rMid, surfaceHeight(a.radius, a) + half, Math.sin(seg.angle) * rMid)
          .setRotation({ x: 0, y: Math.sin(yaw / 2), z: 0, w: Math.cos(yaw / 2) })
          .setRestitution(0.5)
          .setFriction(0.05),
      );
    }
  }

  createSpinner(spec: { x: number; z: number; radius: number; mass: number }): Body {
    const r = Math.hypot(spec.x, spec.z);
    const body = this.world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(spec.x, surfaceHeight(r) + spec.radius + 0.02, spec.z)
        .setLinearDamping(PHYSICS_CONFIG.linearDamping)
        .lockRotations()
        .setCcdEnabled(true),
    );
    this.world.createCollider(
      RAPIER.ColliderDesc.ball(spec.radius)
        .setMass(spec.mass)
        .setRestitution(PHYSICS_CONFIG.restitution)
        .setFriction(PHYSICS_CONFIG.friction),
      body,
    );
    return body;
  }

  step(): void {
    this.world.step();
  }

  dispose(): void {
    this.world.free();
  }
}
