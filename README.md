# AFTERGLOW

A browser-based, first-person 3D restoration simulator in the spirit of PowerWash Simulator:
bring forgotten, grimy things back to life.

**Current state: Milestone 2 — real-time cleaning prototype.** The app opens into a small, atmospheric,
abandoned restoration workshop: concrete floor, block walls, overhead lights, a workbench, steel
shelving and a dead arcade cabinet (the placeholder for the first restorable object). You can walk
around it, look at everything and spray the dirt off one test panel on the right wall. Nothing else
is cleanable yet, and there are no jobs, upgrades or progression.

## Controls

| Input          | Action                                                         |
| -------------- | -------------------------------------------------------------- |
| Click the scene | Capture the mouse (enter mouse-look)                          |
| Mouse          | Look around (pitch is limited so the view never flips)         |
| `W A S D`      | Walk forward / left / back / right, relative to where you face |
| Hold left mouse | Spray water at the point under the dot (mouse must be captured) |
| `Esc`          | Release the mouse so you can use the browser normally          |

Movement follows the horizontal view direction only, so looking up or down never changes your
height or speed. Diagonals are normalized. Keys are matched by physical position (`event.code`),
so on non-QWERTY layouts the keys in the WASD positions are used. Movement and look are active only
while the mouse is captured; losing focus, switching tabs or releasing the mouse clears all held keys.
No jumping, crouching or sprinting exists. Releasing the button, losing focus or releasing the mouse stops the spray at once.

## Requirements

- Node.js 20.19 or newer (22 LTS recommended)
- npm
- A browser with WebGL 2

## Setup and run

```bash
npm install
npm run dev        # http://localhost:5173 with hot reload
```

## Scripts

| Command             | What it does                                            |
| ------------------- | ------------------------------------------------------- |
| `npm run dev`       | Vite dev server with hot reload and the debug overlay   |
| `npm run typecheck` | `tsc --noEmit` (strict mode)                            |
| `npm run build`     | Typecheck, then production build into `dist/`           |
| `npm run preview`   | Serve the production build locally                      |

## Debug overlay (dev only)

`npm run dev` shows a small panel (top right) with FPS, frame time, draw calls, triangles, and
geometry/texture/program counts. Press the backtick key (`` ` ``) to hide or show it. It is loaded with
a dynamic import behind `import.meta.env.DEV`, so it is not part of production builds.
Draw calls include shadow passes. In dev, the running app is also available in the console as `afterglow`.

## Project structure

```
index.html                 Page shell: canvas mount, status panel, presentation layers
src/
  main.ts                  Entry point: status screen, error reporting, app + dev tools startup
  config.ts                Shared constants: renderer, camera, room size, player, layout, palette
  style.css                Page styling (vignette, grain, wordmark, status screen)
  core/
    App.ts                 Owns renderer, camera, workshop; frame loop, resize, dispose()
    createRenderer.ts      WebGLRenderer setup (tone mapping, shadows, pixel ratio)
    cameraRig.ts           The player's camera and projection; FOV adapts to narrow windows
    CleaningHud.ts         Aiming dot and the test panel's cleaning percentage
    ControlsHint.ts        One-line, fading controls / "click to look around" hint
    StatusDisplay.ts       Initialization message and fatal-error screen
  cleaning/                Spray, dirt mask, water feedback and coverage (see below)
    CleaningSystem.ts      Per-frame: aim ray, brush stamps, feedback, coverage requests
    DirtMask.ts            Render-target mask in a surface's UV space + brush shader
    CoverageMeter.ts       64x64 GPU measurement, read back asynchronously
    SprayEffect.ts         Pooled droplet stream and impact mist
  player/                  First-person control (no knowledge of three.js scene contents)
    input.ts               Keys, mouse deltas, pointer lock; clears state on blur/unlock/hide
    PlayerController.ts    Yaw/pitch look, walking, applies the result to the camera
    collision.ts           Circle-vs-rectangle sliding collision on the floor plane
  scene/
    createWorkshop.ts      Composes the scene from the modules below (no geometry of its own)
    room.ts                Floor, walls, ceiling, beams, window, breaker panel, extinguisher
    lighting.ts            Light rig: daylight, key light, pendants (one dead, one flickering)
    materials.ts           Every shared material, built from procedural recipes
    ambientDirt.ts         Shader hook: world-space dirt accumulation and non-repeating staining
    environment.ts         Low-intensity image-based lighting for reflections
    workbench.ts           Bench, drawers, pegboard + tools, vise, work lamp, clutter
    shelving.ts            Steel shelving and its contents
    arcadeCabinet.ts       Placeholder arcade cabinet (the focal point)
    dirtLayer.ts           Procedural dirt shader layer + shared dirt GLSL; CleanableSurface
    testPanel.ts           The dirty enameled test panel (right wall)
    colliders.ts           Marks solid objects and measures their floor footprints
    props.ts               Floor props: drums, crates, tires, hose, mop, drain
    objects.ts             Small reusable prop builders (cans, buckets, boxes, ...)
  procedural/              Deterministic canvas-generated textures (no image assets)
    noise.ts, random.ts    Tileable fractal noise, domain warping and a seeded PRNG
    stains.ts              Irregular, noise-edged stain shapes that tile across texture edges
    surfaces.ts            Turns a recipe into albedo + roughness/bump textures
    recipes.ts             Per-surface recipes (concrete, block wall, wood, steel, ...)
    marquee.ts             The faded AFTERGLOW marquee artwork
  util/
    geometry.ts            Box/cylinder/lathe helpers with UVs in meters
    rect.ts                Floor-plane rectangle type
    dispose.ts             Releases GPU resources for an object tree
  debug/                   Dev-only FPS / renderer stats overlay
```

## How it works

- **Units and axes:** meters, +Y up. The room's open front is +Z; the camera looks toward -Z.
- **No external assets.** Geometry is procedural. Textures are generated on a canvas at startup from
  seeded recipes, so they are identical on every load. Startup takes a moment because of this.
- **Grime:** each texture layers multi-scale, domain-warped grime with stains and edge accumulation.
  `ambientDirt.ts` adds dirt in world space (floor, corners, ceiling) and large non-repeating
  stains. That shader noise is a pure function of position, so it is deterministic too.
- **Texel density:** helper geometry writes UVs in meters, so every surface shares one density
  regardless of mesh size.
- **Lighting:** a dim cool hemisphere fill, a cool daylight spot through the window, a warm key
  light on the arcade cabinet and amber pendants. Only three lights cast shadows.
- **Lifecycle:** `App.dispose()` stops the loop, removes listeners and releases geometries,
  materials, textures, shadow maps and the environment map.

## Cleaning

A cleanable surface is a mesh with 0..1 UVs plus a `CleanableSurface` record (`scene/dirtLayer.ts`).
Its material is an ordinary `MeshStandardMaterial` with a clean procedural finish; `addDirtLayer`
patches in a dirt layer whose **thickness** is a procedural noise function of position (so the dirt
is deterministic and has no texture to allocate). What has been cleaned is a **mask**:

- `DirtMask` owns one half-float render target per surface (512 texels on the long side, about 3 mm).
  Each frame while spraying, brush quads are drawn into it additively in a single render call.
  The brush is round in meters with a ragged, surface-anchored edge. The mask is never cleared,
  never read back, and never reallocated while playing.
- The shader shows dirt where `thickness - mask` is positive (soft step), so thin patches clear
  first, thick crust last, the boundary follows the dirt's own structure and widens with each pass,
  and the clean finish underneath is simply the unmodified material.
- `CleaningSystem` raycasts from the camera centre against the whole scene (max range 3.5 m). Only a
  first hit on a registered cleanable gets stamps; any other surface only gets water feedback. Brush
  radius grows with distance, and fast strokes are filled in with interpolated stamps.
- `CoverageMeter` renders, on a 64x64 grid, how much dirt was visible at the start and how much is
  visible now (same shader code as the material), and reads that 16 KB target back asynchronously
  at most four times a second. The percentage is dirt removed relative to the initial dirt, not time spent.
- `SprayEffect` is two pooled `Points` systems (a droplet stream from a nozzle offset to the aim point,
  and impact mist). Nothing is allocated per frame.

To make another object cleanable: give its mesh 0..1 UVs, call `addDirtLayer` on its material,
include its `CleanableSurface` in `Workshop.cleanables`. (The dirt look itself is still specific to the
test panel's shader; per-object dirt styles are future work.) Spray feedback and cleaning share the
frame loop; there is no second loop.

Mask trade-offs: a mask in UV space costs 512x375 half-float texels (about 1.5 MB) per surface and one tiny
render call per sprayed frame; it needs a surface with a unique, non-overlapping UV layout. Half-float
blending needs `EXT_color_buffer_float` or `EXT_color_buffer_half_float`; otherwise it falls back to
8-bit, where very light strokes quantize.

## Movement and collision

The player is a circle (`PLAYER.radius`) on the floor plane with the camera at a fixed eye height.
Each frame `PlayerController` turns input into a step, and `collision.ts` pushes the circle out of
every solid footprint and back inside the room, so you slide along walls and furniture. If no legal
position exists (a gap narrower than the player) the step is cancelled. Frame time is clamped to
`PLAYER.maxFrameSeconds` (0.1 s), so a stalled tab cannot teleport the player; below 10 fps the
player walks slower than real time.

Solid objects are tagged with `markSolid()` in `scene/`; their footprints are measured from the
geometry (axis-aligned boxes, so rotated or round objects get a slightly generous footprint).
Currently solid: arcade cabinet, workbench, shelving, drums, crates, cardboard box, bucket and mop,
tire stack. Not solid (walked over): hose coil, loose pipe, floor drain. Tag new furniture the same way.

## Known limitations

- Only the test panel is cleanable; the dirt look is tied to its shader. The mask resolution is fixed per surface.
- Spraying has no water physics, no sound and no wetness that persists on surfaces.
- Stats: the mask and coverage passes call `renderer.render` outside the main frame; the debug overlay's frame counter is corrected for this.
- Mouse look is raw pointer-lock movement with no smoothing or acceleration; sensitivity is `PLAYER.lookSensitivity`.
- Collision is 2D (floor plane only): nothing is overhead-checked, which is fine because the eye is below every object and the ceiling is out of reach.
- First paint is delayed while procedural textures are generated at startup; a status screen shows meanwhile. Measured only in a software-rendered sandbox; real GPU timing is unmeasured.
- There are many small meshes (roughly 300 geometries); no merging or instancing yet.
- In very narrow (portrait) windows the arcade cabinet is partly cropped at the left edge.
