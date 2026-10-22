# AFTERGLOW

A browser-based, first-person 3D restoration simulator in the spirit of PowerWash Simulator:
bring forgotten, grimy things back to life.

**Current state: Milestone 1 — first-person movement.** The app opens into a small, atmospheric,
abandoned restoration workshop: concrete floor, block walls, overhead lights, a workbench, steel
shelving and a dead arcade cabinet (the placeholder for the first restorable object). You can walk
around it and look at everything. There are no cleaning mechanics or interaction yet.

## Controls

| Input          | Action                                                         |
| -------------- | -------------------------------------------------------------- |
| Click the scene | Capture the mouse (enter mouse-look)                          |
| Mouse          | Look around (pitch is limited so the view never flips)         |
| `W A S D`      | Walk forward / left / back / right, relative to where you face |
| `Esc`          | Release the mouse so you can use the browser normally          |

Movement follows the horizontal view direction only, so looking up or down never changes your
height or speed. Diagonals are normalized. Keys are matched by physical position (`event.code`),
so on non-QWERTY layouts the keys in the WASD positions are used. Movement and look are active only
while the mouse is captured; losing focus, switching tabs or releasing the mouse clears all held keys.
No jumping, crouching, sprinting or interaction exists yet.

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
    ControlsHint.ts        One-line, fading controls / "click to look around" hint
    StatusDisplay.ts       Initialization message and fatal-error screen
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

- Mouse look is raw pointer-lock movement with no smoothing or acceleration; sensitivity is `PLAYER.lookSensitivity`.
- Collision is 2D (floor plane only): nothing is overhead-checked, which is fine because the eye is below every object and the ceiling is out of reach.
- First paint is delayed while procedural textures are generated at startup; a status screen shows meanwhile. Measured only in a software-rendered sandbox; real GPU timing is unmeasured.
- There are many small meshes (roughly 300 geometries); no merging or instancing yet.
- In very narrow (portrait) windows the arcade cabinet is partly cropped at the left edge.
