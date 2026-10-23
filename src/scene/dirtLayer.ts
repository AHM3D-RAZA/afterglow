import type { Mesh, MeshStandardMaterial, Texture, WebGLProgramParametersWithUniforms } from 'three';

/**
 * A surface whose dirt can be sprayed away. The dirt itself is a procedural
 * layer evaluated in the material's shader; what has been cleaned lives in a
 * mask texture that the cleaning system owns and writes to.
 */
export interface CleanableSurface {
  readonly name: string;
  readonly mesh: Mesh;
  /** Size of the face in meters (along U, along V). UVs run 0..1 across it. */
  readonly sizeMeters: readonly [number, number];
  /** Cleaned amount per point (red channel). The cleaning system assigns the texture. */
  readonly mask: { value: Texture | null };
}

/**
 * Shared shader code: how thick the dirt is at each point, and how much of it
 * is still visible once `mask` worth of cleaning has been applied.
 *
 * Dirt shows wherever `thickness - mask` is positive. Cleaning therefore eats
 * the thin patches first and the thick crust last, so the cleaned edge follows
 * the dirt's own irregular structure and widens with every pass, instead of
 * being a disc that merely grows.
 *
 * Pure functions of position: the look is identical on every load, and the
 * coverage meter can evaluate exactly what the material draws.
 */
export const DIRT_GLSL = /* glsl */ `
float dirtHash( vec2 p ) {
  vec3 p3 = fract( vec3( p.xyx ) * 0.1031 );
  p3 += dot( p3, p3.yzx + 33.33 );
  return fract( ( p3.x + p3.y ) * p3.z );
}

float dirtNoise2( vec2 p ) {
  vec2 i = floor( p );
  vec2 f = fract( p );
  f = f * f * f * ( f * ( f * 6.0 - 15.0 ) + 10.0 );
  return mix( mix( dirtHash( i ), dirtHash( i + vec2( 1.0, 0.0 ) ), f.x ),
              mix( dirtHash( i + vec2( 0.0, 1.0 ) ), dirtHash( i + vec2( 1.0, 1.0 ) ), f.x ), f.y );
}

float dirtFbm( vec2 p ) {
  float sum = 0.0;
  float amplitude = 0.5;
  for ( int i = 0; i < 4; i++ ) {
    sum += amplitude * dirtNoise2( p );
    p = p * 2.03 + 17.1;
    amplitude *= 0.5;
  }
  return sum / 0.9375;
}

// Thickness of the dirt at uv (0..1 across a face of sizeMeters). Roughly 0.3 .. 1.6.
float dirtThickness( vec2 uv, vec2 sizeMeters ) {
  vec2 p = uv * sizeMeters;
  // Bend the coordinates so no lattice direction shows.
  vec2 warp = vec2( dirtNoise2( p * 1.6 + 3.1 ), dirtNoise2( p * 1.6 + 9.7 ) ) - 0.5;
  vec2 q = p + warp * 0.45;

  // Patchy coverage: contrast the broad noise so some areas are crusted and some nearly clear.
  float crust = smoothstep( 0.26, 0.74, dirtFbm( q * 2.3 ) );
  float fine = dirtFbm( q * 14.0 + 5.0 );
  float speck = smoothstep( 0.45, 0.85, dirtNoise2( q * 70.0 ) );
  // Runs of dirty water: noise stretched along the height of the face, in two widths.
  float runs = dirtNoise2( vec2( q.x * 15.0, q.y * 1.7 + 2.0 ) );
  float threads = dirtNoise2( vec2( q.x * 55.0, q.y * 3.5 + 7.0 ) );
  runs = smoothstep( 0.4, 0.9, runs ) * ( 0.7 + 0.5 * threads ) * ( 0.35 + 0.65 * uv.y );

  // Dirt gathers along the edges of the face and toward the bottom.
  vec2 toEdge = min( uv, 1.0 - uv ) * sizeMeters;
  float rim = exp( -min( toEdge.x, toEdge.y ) / 0.07 );
  float low = exp( -( uv.y * sizeMeters.y ) / 0.35 );

  return 0.05 + 0.45 * crust + 0.28 * fine + 0.18 * speck + 0.4 * runs + 0.3 * rim + 0.28 * low;
}

// How much dirt is still visible, 0..1, after cleaning amount \`mask\`.
float dirtVisibility( float thickness, float mask ) {
  return smoothstep( 0.0, 0.24, thickness - mask );
}
`;

const DIRT_VERTEX_DECLARATIONS = /* glsl */ `
varying vec2 vDirtUv;
`;

const DIRT_FRAGMENT_DECLARATIONS = /* glsl */ `
varying vec2 vDirtUv;
uniform sampler2D uCleanMask;
uniform vec2 uCleanSize;
${DIRT_GLSL}
`;

/** Runs after the base color is known: decides how much dirt covers it. */
const DIRT_COLOR = /* glsl */ `
float dirtThick = dirtThickness( vDirtUv, uCleanSize );
float cleaned = texture2D( uCleanMask, vDirtUv ).r;
float remaining = dirtThick - cleaned;
float dirtCover = dirtVisibility( dirtThick, cleaned );
// A thin, darker tide line where the dirt has just been eaten back.
float tideLine = smoothstep( 0.0, 0.05, remaining ) * ( 1.0 - smoothstep( 0.05, 0.2, remaining ) );
// Washed areas stay slightly damp and darker.
float damp = ( 1.0 - dirtCover ) * smoothstep( 0.05, 0.5, cleaned );

float tone = dirtNoise2( vDirtUv * uCleanSize * 5.0 + 40.0 );
vec3 dirtColor = mix( vec3( 0.2, 0.165, 0.12 ), vec3( 0.42, 0.37, 0.29 ), tone * 0.8 + 0.1 * dirtFbm( vDirtUv * uCleanSize * 30.0 ) );
dirtColor *= 1.0 - 0.35 * clamp( dirtThick - 0.9, 0.0, 1.0 );
float opacity = dirtCover * clamp( 0.3 + 0.55 * dirtThick, 0.0, 0.93 );

diffuseColor.rgb *= 1.0 - 0.06 * damp;
diffuseColor.rgb = mix( diffuseColor.rgb, dirtColor, opacity );
diffuseColor.rgb *= 1.0 - 0.25 * tideLine;
`;

/**
 * Adds the dirt layer to a standard material: dirt color over the clean
 * albedo, dull and non-metallic where dirt remains, glossier where washed.
 * The material needs a `uv` attribute running 0..1 across the face.
 */
export function addDirtLayer(material: MeshStandardMaterial, surface: CleanableSurface): void {
  const sizeUniform = { value: [surface.sizeMeters[0], surface.sizeMeters[1]] };

  material.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms): void => {
    shader.uniforms.uCleanMask = surface.mask;
    shader.uniforms.uCleanSize = sizeUniform;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${DIRT_VERTEX_DECLARATIONS}`)
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvDirtUv = uv;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${DIRT_FRAGMENT_DECLARATIONS}`)
      .replace('#include <color_fragment>', `#include <color_fragment>\n${DIRT_COLOR}`)
      .replace(
        '#include <roughnessmap_fragment>',
        '#include <roughnessmap_fragment>\nroughnessFactor = mix( mix( roughnessFactor * 0.75, roughnessFactor, 1.0 - damp ), 0.95, dirtCover );',
      )
      .replace(
        '#include <metalnessmap_fragment>',
        '#include <metalnessmap_fragment>\nmetalnessFactor *= 1.0 - dirtCover;',
      );
  };
  material.customProgramCacheKey = (): string => 'dirt-layer-v1';
}
