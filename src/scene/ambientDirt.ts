import type { MeshStandardMaterial, WebGLProgramParametersWithUniforms } from 'three';
import { ROOM } from '../config';

/**
 * Two things a tiled texture cannot do on its own, added to a material's
 * albedo in world space:
 *
 * 1. Accumulation. Dirt gathers where surfaces meet: the foot of walls and
 *    objects, the vertical corners of the room, along the wall edge of the
 *    floor and near the ceiling. The strength is modulated by the surface's own
 *    grime pattern (the roughness map), so it breaks up instead of reading as a
 *    smooth gradient.
 * 2. Large-scale staining and tone variation. Noise in world space is not
 *    periodic, so a 1.6 m wall tile does not show up as a repeating pattern
 *    across an 8 m wall. The stain noise is stretched vertically, which gives
 *    tall, drip-like discoloration on walls and irregular blotches on floors.
 *
 * The effect only darkens or tints albedo slightly; it never changes lighting.
 * Positions come from the model matrix, so it is independent of UVs and of how
 * textures are tiled. All patched materials share one shader program.
 */

/** Largest albedo reduction where dirt is at full strength (0.4 = 40% darker). */
const DIRT_STRENGTH = 0.42;
/** Large-scale tone variation, ± this fraction of albedo. */
const MACRO_VARIATION = 0.14;
/** Share of the dirt amount contributed by world-space stains (the rest is accumulation). */
const STAIN_SHARE = 0.55;

export function addAmbientDirt(material: MeshStandardMaterial): void {
  material.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms): void => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${VERTEX_DECLARATIONS}`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>\n${VERTEX_BODY}`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${FRAGMENT_FUNCTIONS}`)
      .replace('#include <color_fragment>', `#include <color_fragment>\n${FRAGMENT_BODY}`);
  };
  // Without this, patched and unpatched materials with equal parameters would share a program.
  material.customProgramCacheKey = (): string => 'ambient-dirt-v1';
}

const VERTEX_DECLARATIONS = /* glsl */ `
varying vec3 vDirtPosition;
varying vec3 vDirtNormal;
`;

const VERTEX_BODY = /* glsl */ `
vDirtPosition = ( modelMatrix * vec4( transformed, 1.0 ) ).xyz;
vDirtNormal = normalize( mat3( modelMatrix ) * objectNormal );
`;

const FRAGMENT_FUNCTIONS = /* glsl */ `
varying vec3 vDirtPosition;
varying vec3 vDirtNormal;

#define DIRT_HALF_WIDTH ${ROOM.halfWidth.toFixed(3)}
#define DIRT_HALF_DEPTH ${ROOM.halfDepth.toFixed(3)}
#define DIRT_ROOM_HEIGHT ${ROOM.height.toFixed(3)}
#define DIRT_STRENGTH ${DIRT_STRENGTH.toFixed(3)}
#define DIRT_MACRO ${MACRO_VARIATION.toFixed(3)}
#define DIRT_STAINS ${STAIN_SHARE.toFixed(3)}

// Cheap hash-based value noise; 0..1. Pure function of position, so it is stable between runs.
float dirtHash( vec3 p ) {
  p = fract( p * 0.3183099 + 0.1 );
  p *= 17.0;
  return fract( p.x * p.y * p.z * ( p.x + p.y + p.z ) );
}

float dirtNoise( vec3 x ) {
  vec3 i = floor( x );
  vec3 f = fract( x );
  f = f * f * ( 3.0 - 2.0 * f );
  return mix(
    mix( mix( dirtHash( i ), dirtHash( i + vec3( 1.0, 0.0, 0.0 ) ), f.x ),
         mix( dirtHash( i + vec3( 0.0, 1.0, 0.0 ) ), dirtHash( i + vec3( 1.0, 1.0, 0.0 ) ), f.x ), f.y ),
    mix( mix( dirtHash( i + vec3( 0.0, 0.0, 1.0 ) ), dirtHash( i + vec3( 1.0, 0.0, 1.0 ) ), f.x ),
         mix( dirtHash( i + vec3( 0.0, 1.0, 1.0 ) ), dirtHash( i + vec3( 1.0, 1.0, 1.0 ) ), f.x ), f.y ),
    f.z );
}
`;

const FRAGMENT_BODY = /* glsl */ `
{
  vec3 p = vDirtPosition;
  vec3 n = normalize( vDirtNormal );
  float upward = abs( n.y );     // 1 on floors, ceilings and shelf tops
  float vertical = 1.0 - upward; // 1 on walls and the sides of objects

  float toWallX = max( DIRT_HALF_WIDTH - abs( p.x ), 0.0 );
  float toWallZ = max( DIRT_HALF_DEPTH - abs( p.z ), 0.0 );

  float nearFloor = exp( -max( p.y, 0.0 ) / 0.45 );
  float nearCeiling = exp( -max( DIRT_ROOM_HEIGHT - p.y, 0.0 ) / 0.5 );
  float inCorner = exp( -toWallX / 0.45 ) * exp( -toWallZ / 0.45 );
  float alongWall = exp( -min( toWallX, toWallZ ) / 0.5 );

  float tendency = vertical * ( 0.5 * nearFloor + 0.35 * nearCeiling + 0.7 * inCorner )
                 + upward * 0.45 * alongWall;

  #ifdef USE_ROUGHNESSMAP
    float surfaceGrime = texture2D( roughnessMap, vRoughnessMapUv ).g;
  #else
    float surfaceGrime = 0.6;
  #endif
  // Irregular, non-repeating stains: noise stretched along Y so walls get tall blotches.
  float stainField = 0.6 * dirtNoise( p * vec3( 0.9, 0.3, 0.9 ) ) + 0.4 * dirtNoise( p * vec3( 2.7, 0.9, 2.7 ) );
  float stains = smoothstep( 0.5, 0.78, stainField );

  float dirt = clamp( tendency * ( 0.4 + 1.2 * surfaceGrime ) + DIRT_STAINS * stains * ( 0.5 + surfaceGrime ), 0.0, 1.0 );

  float macro = 0.65 * dirtNoise( p * 0.37 ) + 0.35 * dirtNoise( p * 1.1 );
  diffuseColor.rgb *= ( 1.0 - DIRT_STRENGTH * dirt ) * mix( 1.0 - DIRT_MACRO, 1.0 + DIRT_MACRO, macro );
}
`;
