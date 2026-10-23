import { BufferAttribute, BufferGeometry, Points, ShaderMaterial, Vector3, type PerspectiveCamera, type Scene } from 'three';

const STREAM_POOL = 360;
const MIST_POOL = 160;
const STREAM_RATE = 1000; // particles per second
const MIST_RATE = 110;
const STREAM_SPEED = 16; // m/s
const STREAM_SPREAD = 0.018; // radians, half-angle of the cone
const GRAVITY = 9.8;
const MIST_GRAVITY = 3.5;

/** Where the spray is going this frame. */
export interface SprayState {
  spraying: boolean;
  /** Nozzle position in the world. */
  origin: Vector3;
  /** Point the stream travels to: the impact point, or the end of its range. */
  target: Vector3;
  /** True if `target` is a real surface hit (mist appears there). */
  hit: boolean;
  /** Surface normal at the hit. */
  normal: Vector3;
}

/**
 * Water feedback: a stream of small droplets from the nozzle to the aim
 * point, and a little mist where it lands. Both are pooled `Points`
 * (nothing is allocated while spraying) and only the CPU positions change.
 */
export class SprayEffect {
  private readonly stream: ParticlePool;
  private readonly mist: ParticlePool;
  private streamCarry = 0;
  private mistCarry = 0;
  private readonly velocity = new Vector3();

  constructor(
    private readonly scene: Scene,
    private readonly camera: PerspectiveCamera,
    private readonly drawingBufferHeight: () => number,
  ) {
    this.stream = new ParticlePool(STREAM_POOL, 0.8);
    this.mist = new ParticlePool(MIST_POOL, 0.55);
    scene.add(this.stream.points, this.mist.points);
  }

  update(deltaSeconds: number, state: SprayState): void {
    if (state.spraying) {
      this.emitStream(deltaSeconds, state);
      if (state.hit) this.emitMist(deltaSeconds, state);
    }
    this.stream.step(deltaSeconds, GRAVITY);
    this.mist.step(deltaSeconds, MIST_GRAVITY);

    // Point size in pixels = size in meters x pixels per meter at distance 1.
    const pixelsPerMeter = this.drawingBufferHeight() / (2 * Math.tan((this.camera.fov * Math.PI) / 360));
    this.stream.setScale(pixelsPerMeter);
    this.mist.setScale(pixelsPerMeter);
  }

  /** Removes the stream at once, so releasing the button stops the water immediately. Mist fades out on its own. */
  stopStream(): void {
    this.stream.clear();
    this.streamCarry = 0;
    this.mistCarry = 0;
  }

  dispose(): void {
    this.scene.remove(this.stream.points, this.mist.points);
    this.stream.dispose();
    this.mist.dispose();
  }

  private emitStream(deltaSeconds: number, { origin, target }: SprayState): void {
    this.streamCarry += STREAM_RATE * deltaSeconds;
    const distance = origin.distanceTo(target);
    const travel = Math.max(0.02, distance / STREAM_SPEED);
    while (this.streamCarry >= 1) {
      this.streamCarry -= 1;
      // Aim so the droplet lands on the target after `travel`, arcing under gravity.
      const spread = STREAM_SPREAD * distance;
      this.velocity
        .set(
          (target.x - origin.x + (Math.random() - 0.5) * spread) / travel,
          (target.y - origin.y + (Math.random() - 0.5) * spread) / travel + 0.5 * GRAVITY * travel,
          (target.z - origin.z + (Math.random() - 0.5) * spread) / travel,
        );
      // Spawn along the first moments of the path so the stream starts as a line, not a puff.
      const head = Math.random() * deltaSeconds;
      this.stream.spawn(
        origin.x + this.velocity.x * head,
        origin.y + this.velocity.y * head,
        origin.z + this.velocity.z * head,
        this.velocity,
        travel - head,
        0.011 + Math.random() * 0.007,
      );
    }
  }

  private emitMist(deltaSeconds: number, { target, normal }: SprayState): void {
    this.mistCarry += MIST_RATE * deltaSeconds;
    while (this.mistCarry >= 1) {
      this.mistCarry -= 1;
      const outward = 0.3 + Math.random() * 1.1;
      this.velocity.set(
        normal.x * outward + (Math.random() - 0.5) * 1.4,
        normal.y * outward + (Math.random() - 0.2) * 1.2,
        normal.z * outward + (Math.random() - 0.5) * 1.4,
      );
      this.mist.spawn(
        target.x + normal.x * 0.01,
        target.y + normal.y * 0.01,
        target.z + normal.z * 0.01,
        this.velocity,
        0.3 + Math.random() * 0.4,
        0.012 + Math.random() * 0.02,
      );
    }
  }
}

/** A fixed-size pool of fading round points. Dead particles are simply not drawn (alpha 0). */
class ParticlePool {
  readonly points: Points;
  private readonly positions: Float32Array;
  private readonly velocities: Float32Array;
  private readonly ages: Float32Array;
  private readonly lives: Float32Array;
  private readonly sizes: Float32Array;
  private readonly alphas: Float32Array;
  private readonly geometry = new BufferGeometry();
  private readonly material: ShaderMaterial;
  private readonly peakAlpha: number;
  private next = 0;

  constructor(
    private readonly count: number,
    peakAlpha: number,
  ) {
    this.peakAlpha = peakAlpha;
    this.positions = new Float32Array(count * 3);
    this.velocities = new Float32Array(count * 3);
    this.ages = new Float32Array(count);
    this.lives = new Float32Array(count).fill(0);
    this.sizes = new Float32Array(count);
    this.alphas = new Float32Array(count);

    this.geometry.setAttribute('position', new BufferAttribute(this.positions, 3).setUsage(35048));
    this.geometry.setAttribute('aSize', new BufferAttribute(this.sizes, 1).setUsage(35048));
    this.geometry.setAttribute('aAlpha', new BufferAttribute(this.alphas, 1).setUsage(35048));

    this.material = new ShaderMaterial({
      uniforms: { uScale: { value: 600 } },
      vertexShader: /* glsl */ `
        attribute float aSize;
        attribute float aAlpha;
        uniform float uScale;
        varying float vAlpha;
        void main() {
          vec4 viewPosition = modelViewMatrix * vec4( position, 1.0 );
          vAlpha = aAlpha;
          gl_PointSize = max( 1.0, aSize * uScale / max( -viewPosition.z, 0.05 ) );
          gl_Position = projectionMatrix * viewPosition;
        }
      `,
      fragmentShader: /* glsl */ `
        varying float vAlpha;
        void main() {
          float d = length( gl_PointCoord - 0.5 );
          float disc = 1.0 - smoothstep( 0.18, 0.5, d );
          gl_FragColor = vec4( 0.74, 0.86, 0.97, disc * vAlpha );
        }
      `,
      transparent: true,
      depthWrite: false,
    });

    this.points = new Points(this.geometry, this.material);
    this.points.name = 'spray-particles';
    this.points.frustumCulled = false;
    this.points.renderOrder = 10;
    // Particles must never be hit by the aim ray.
    this.points.raycast = (): void => {};
  }

  spawn(x: number, y: number, z: number, velocity: Vector3, life: number, size: number): void {
    const i = this.next;
    this.next = (this.next + 1) % this.count; // overwrites the oldest when the pool is full
    this.positions[i * 3] = x;
    this.positions[i * 3 + 1] = y;
    this.positions[i * 3 + 2] = z;
    this.velocities[i * 3] = velocity.x;
    this.velocities[i * 3 + 1] = velocity.y;
    this.velocities[i * 3 + 2] = velocity.z;
    this.ages[i] = 0;
    this.lives[i] = life;
    this.sizes[i] = size;
  }

  step(deltaSeconds: number, gravity: number): void {
    let anyAlive = false;
    for (let i = 0; i < this.count; i++) {
      const life = this.lives[i];
      if (life <= 0) continue;
      const age = this.ages[i] + deltaSeconds;
      if (age >= life) {
        this.lives[i] = 0;
        this.alphas[i] = 0;
        continue;
      }
      anyAlive = true;
      this.ages[i] = age;
      this.velocities[i * 3 + 1] -= gravity * deltaSeconds;
      this.positions[i * 3] += this.velocities[i * 3] * deltaSeconds;
      this.positions[i * 3 + 1] += this.velocities[i * 3 + 1] * deltaSeconds;
      this.positions[i * 3 + 2] += this.velocities[i * 3 + 2] * deltaSeconds;
      const t = age / life;
      // Quick fade in, fade out over the last part of life.
      this.alphas[i] = this.peakAlpha * Math.min(1, t * 8) * (1 - t * t);
    }
    this.points.visible = anyAlive;
    this.geometry.attributes.position.needsUpdate = anyAlive;
    this.geometry.attributes.aAlpha.needsUpdate = anyAlive;
    this.geometry.attributes.aSize.needsUpdate = anyAlive;
  }

  setScale(pixelsPerMeter: number): void {
    this.material.uniforms.uScale.value = pixelsPerMeter;
  }

  clear(): void {
    this.lives.fill(0);
    this.alphas.fill(0);
    this.points.visible = false;
    this.geometry.attributes.aAlpha.needsUpdate = true;
  }

  dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
  }
}
