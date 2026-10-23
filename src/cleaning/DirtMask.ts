import {
  AddEquation,
  CustomBlending,
  HalfFloatType,
  LinearFilter,
  Mesh,
  OneFactor,
  OrthographicCamera,
  PlaneGeometry,
  Scene,
  ShaderMaterial,
  UnsignedByteType,
  Vector2,
  WebGLRenderTarget,
  type WebGLRenderer,
} from 'three';
import type { CleanableSurface } from '../scene/dirtLayer';

/** Longest side of the mask, in texels. 512 over a 1.5 m panel is about 3 mm per texel. */
const MASK_LONG_SIDE = 512;
/** Most brush stamps drawn in one frame (they are all drawn in a single render call). */
const MAX_STAMPS_PER_FRAME = 12;
/** Size of the brush noise features, in cycles per meter. */
const EDGE_NOISE_FREQUENCY = 28;

/**
 * Where a surface has been cleaned, stored in a render target in the surface's
 * UV space. Spraying draws soft, noise-edged brush quads into it with additive
 * blending; the material reads it back as a texture. The mask never leaves the
 * GPU, is never cleared during play, and its size is fixed, so spraying
 * allocates nothing.
 */
export class DirtMask {
  readonly target: WebGLRenderTarget;

  private readonly scene = new Scene();
  private readonly camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private readonly stamps: Mesh<PlaneGeometry, ShaderMaterial>[] = [];
  private readonly geometry = new PlaneGeometry(2, 2);
  private pendingStamps = 0;

  constructor(
    private readonly renderer: WebGLRenderer,
    private readonly surface: CleanableSurface,
  ) {
    const [width, height] = surface.sizeMeters;
    const longSide = Math.max(width, height);
    this.target = new WebGLRenderTarget(
      Math.max(8, Math.round((MASK_LONG_SIDE * width) / longSide)),
      Math.max(8, Math.round((MASK_LONG_SIDE * height) / longSide)),
      {
        // Half float keeps tiny per-frame additions from rounding away; 8 bit is the fallback.
        type: supportsHalfFloatBlending(renderer) ? HalfFloatType : UnsignedByteType,
        minFilter: LinearFilter,
        magFilter: LinearFilter,
        depthBuffer: false,
      },
    );
    surface.mask.value = this.target.texture;

    for (let i = 0; i < MAX_STAMPS_PER_FRAME; i++) {
      const stamp = new Mesh(this.geometry, createBrushMaterial(surface.sizeMeters));
      stamp.frustumCulled = false;
      stamp.visible = false;
      this.stamps.push(stamp);
      this.scene.add(stamp);
    }
    this.clear();
  }

  /**
   * Queues a brush at `uv` (0..1) with the given radius in meters and amount
   * of cleaning. Queued stamps are drawn together by `flush()`.
   * Stamps beyond the per-frame limit are dropped, which only happens with extreme jumps.
   */
  addStamp(u: number, v: number, radiusMeters: number, amount: number): void {
    if (this.pendingStamps >= MAX_STAMPS_PER_FRAME) return;
    const stamp = this.stamps[this.pendingStamps++];
    const [width, height] = this.surface.sizeMeters;
    const uniforms = stamp.material.uniforms;
    // Half extents of the brush box in UV units; it is square in meters, so the brush is round.
    uniforms.uCenter.value.set(u, v);
    uniforms.uHalfUv.value.set(radiusMeters / width, radiusMeters / height);
    uniforms.uAmount.value = amount;
    stamp.visible = true;
  }

  /** Draws every queued stamp into the mask in one render call. */
  flush(): void {
    if (this.pendingStamps === 0) return;
    renderOffscreen(this.renderer, this.target, this.scene, this.camera);
    for (let i = 0; i < this.pendingStamps; i++) this.stamps[i].visible = false;
    this.pendingStamps = 0;
  }

  dispose(): void {
    this.target.dispose();
    this.geometry.dispose();
    for (const stamp of this.stamps) stamp.material.dispose();
    this.surface.mask.value = null;
  }

  private clear(): void {
    const { renderer, target } = this;
    const previousTarget = renderer.getRenderTarget();
    renderer.setRenderTarget(target);
    renderer.clearColor();
    renderer.setRenderTarget(previousTarget);
  }
}

/**
 * Runs a render call into `target` without disturbing the main frame: the
 * previous target and auto-clear state are restored, and the frame counter is
 * not advanced, so stats such as FPS still count only the main render.
 */
export function renderOffscreen(
  renderer: WebGLRenderer,
  target: WebGLRenderTarget,
  scene: Scene,
  camera: OrthographicCamera,
): void {
  const previousTarget = renderer.getRenderTarget();
  const previousAutoClear = renderer.autoClear;
  renderer.setRenderTarget(target);
  renderer.autoClear = false;
  renderer.render(scene, camera);
  renderer.autoClear = previousAutoClear;
  renderer.setRenderTarget(previousTarget);
  renderer.info.render.frame -= 1;
}

function supportsHalfFloatBlending(renderer: WebGLRenderer): boolean {
  return renderer.extensions.has('EXT_color_buffer_float') || renderer.extensions.has('EXT_color_buffer_half_float');
}

function createBrushMaterial(sizeMeters: readonly [number, number]): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: {
      uCenter: { value: new Vector2() },
      uHalfUv: { value: new Vector2(0.05, 0.05) },
      uAmount: { value: 0 },
      uSizeMeters: { value: [sizeMeters[0], sizeMeters[1]] },
    },
    vertexShader: /* glsl */ `
      uniform vec2 uCenter;
      uniform vec2 uHalfUv;
      varying vec2 vLocal;
      varying vec2 vUv;
      void main() {
        vLocal = position.xy;
        vUv = uCenter + position.xy * uHalfUv;
        gl_Position = vec4( vUv * 2.0 - 1.0, 0.0, 1.0 );
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uAmount;
      uniform vec2 uSizeMeters;
      varying vec2 vLocal;
      varying vec2 vUv;

      float hash( vec2 p ) {
        vec3 p3 = fract( vec3( p.xyx ) * 0.1031 );
        p3 += dot( p3, p3.yzx + 33.33 );
        return fract( ( p3.x + p3.y ) * p3.z );
      }
      float noise( vec2 p ) {
        vec2 i = floor( p );
        vec2 f = fract( p );
        f = f * f * ( 3.0 - 2.0 * f );
        return mix( mix( hash( i ), hash( i + vec2( 1.0, 0.0 ) ), f.x ),
                    mix( hash( i + vec2( 0.0, 1.0 ) ), hash( i + vec2( 1.0, 1.0 ) ), f.x ), f.y );
      }

      void main() {
        // The noise is anchored to the surface, not to the brush, so successive
        // stamps agree on where the edge bulges and the washed area keeps a ragged outline.
        vec2 meters = vUv * uSizeMeters * ${EDGE_NOISE_FREQUENCY.toFixed(1)};
        float lump = noise( meters ) * 0.65 + noise( meters * 2.7 + 11.0 ) * 0.35;
        float reach = 0.5 + 0.5 * lump;           // where this part of the edge ends (0.5 .. 1)
        float r = length( vLocal );
        float falloff = 1.0 - smoothstep( 0.0, reach, r );
        falloff *= falloff;                        // strong core, long soft tail
        gl_FragColor = vec4( uAmount * falloff, 0.0, 0.0, 0.0 );
      }
    `,
    blending: CustomBlending,
    blendEquation: AddEquation,
    blendSrc: OneFactor,
    blendDst: OneFactor,
    blendSrcAlpha: OneFactor,
    blendDstAlpha: OneFactor,
    depthTest: false,
    depthWrite: false,
    transparent: true,
  });
}
