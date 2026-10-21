# AFTERGLOW

A browser-based, first-person 3D restoration simulator in the spirit of PowerWash Simulator:
bring forgotten, grimy things back to life.

**Current state: Milestone 0 — project foundation.** The app opens into a small, atmospheric,
abandoned restoration workshop: concrete floor, block walls, overhead lights, a workbench, steel
shelving and a dead arcade cabinet (the placeholder for the first restorable object). There are no
controls, cleaning mechanics or UI beyond a status screen and a dev-only debug overlay yet.

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
  config.ts                Shared constants: renderer, camera, room size, layout, palette
  style.css                Page styling (vignette, grain, wordmark, status screen)
  core/
    App.ts                 Owns renderer, camera, workshop; frame loop, resize, dispose()
    createRenderer.ts      WebGLRenderer setup (tone mapping, shadows, pixel ratio)
    cameraRig.ts           Fixed composed camera with subtle sway; FOV adapts to narrow windows
    StatusDisplay.ts       Initialization message and fatal-error screen
  scene/
    createWorkshop.ts      Composes the scene from the modules below (no geometry of its own)
    room.ts                Floor, walls, ceiling, beams, window, breaker panel, extinguisher
    lighting.ts            Light rig: daylight, key light, pendants (one dead, one flickering)
    materials.ts           Every shared material, built from procedural recipes
    environment.ts         Low-intensity image-based lighting for reflections
    workbench.ts           Bench, drawers, pegboard + tools, vise, work lamp, clutter
    shelving.ts            Steel shelving and its contents
    arcadeCabinet.ts       Placeholder arcade cabinet (the focal point)
    props.ts               Floor props: drums, crates, tires, hose, mop, drain
    objects.ts             Small reusable prop builders (cans, buckets, boxes, ...)
  procedural/              Deterministic canvas-generated textures (no image assets)
    noise.ts, random.ts    Tileable fractal noise and a seeded PRNG
    surfaces.ts            Turns a recipe into albedo + roughness/bump textures
    recipes.ts             Per-surface recipes (concrete, block wall, wood, steel, ...)
    marquee.ts             The faded AFTERGLOW marquee artwork
  util/
    geometry.ts            Box/cylinder/lathe helpers with UVs in meters
    dispose.ts             Releases GPU resources for an object tree
  debug/                   Dev-only FPS / renderer stats overlay
```

## How it works

- **Units and axes:** meters, +Y up. The room's open front is +Z; the camera looks toward -Z.
- **No external assets.** Geometry is procedural. Textures are generated on a canvas at startup from
  seeded recipes, so they are identical on every load. Startup takes a moment because of this.
- **Texel density:** helper geometry writes UVs in meters, so every surface shares one density
  regardless of mesh size.
- **Lighting:** a dim cool hemisphere fill, a cool daylight spot through the window, a warm key
  light on the arcade cabinet and amber pendants. Only three lights cast shadows.
- **Lifecycle:** `App.dispose()` stops the loop, removes listeners and releases geometries,
  materials, textures, shadow maps and the environment map.

## Known limitations

- First paint is delayed while procedural textures are generated at startup; a status screen shows meanwhile. (Measured only in a software-rendered sandbox, ~1.4 s to first frame there; real GPU timing is unmeasured.)
- There are many small meshes (roughly 300 geometries); no merging or instancing yet.
- The camera is a fixed viewing camera, not player controls.
- In very narrow (portrait) windows the arcade cabinet is partly cropped at the left edge.
