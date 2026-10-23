# AGENTS.md

Conventions for AI-assisted work on AFTERGLOW. Read `README.md` for the project layout.

## Stack

Vite + TypeScript (strict) + Three.js. npm only. No backend, no physics engine. Add a dependency
only with a clear need, and say why in the change description.

## Commands

- `npm run dev` — dev server
- `npm run typecheck` — must pass with no errors
- `npm run build` — must pass before work is considered done

There is no test runner yet. Verify changes by running the typecheck and build, then looking at the
running scene. Report exactly what you ran and what happened; do not claim checks you did not run.

## Code style

- Small, focused modules; one clear responsibility each. Name files for what they contain.
- Explicit types on exported functions. No `any`; justify any non-null assertion or cast.
- Plain control flow, no deep nesting, no duplicated code, no speculative abstractions.
- Comments explain *why* (non-obvious decisions), never restate the code.
- Shared constants go in `src/config.ts`; constants used by one module stay in that module.
- Don't create empty modules or stubs for future features.

## Module boundaries

- `core/` — renderer, camera, frame loop, page status. May import `scene/` and `config`.
- `cleaning/` — dirt mask, spray, water feedback, coverage. Imports `config` and `scene/` (dirt shader code, `CleanableSurface`). Used by `core/`.
- `player/` — first-person input, look, movement and collision. Imports only `config` and `util/`. Used by `core/`.
- `scene/` — builds the world. Never imports from `core/` or `debug/`.
- `procedural/` — pure texture generation. Imports nothing from `scene/` or `core/`.
- `util/` — generic helpers with no knowledge of the game.
- `debug/` — dev tools. Nothing outside `main.ts` may import it, and it must stay out of production
  builds (dynamic import behind `import.meta.env.DEV`).
- No circular imports. Dependencies point downward: `main → core → player/cleaning → scene → procedural/util`.

## Three.js practices

- World units are meters, +Y up. Use the geometry helpers in `util/geometry.ts` so UVs stay in meters.
- Share materials via `scene/materials.ts`; do not create materials inside per-object loops.
- Anything that owns GPU resources must be released by `dispose()`. Remove every event listener you add.
- Procedural textures are deterministic: use the seeded `createRng`, never `Math.random()`.
- Shadow-casting lights are expensive (each re-renders the scene). Keep the count low and justify more.
- Avoid APIs removed or deprecated in the installed Three.js (`PCFSoftShadowMap`, `Clock`); check
  `node_modules/three` when unsure.

## Scope discipline

- Make the smallest change that does the job. Don't rewrite or reformat unrelated code.
- Don't add features beyond the current milestone. Gameplay beyond first-person movement (cleaning,
  interaction, progression, saving) belongs to later milestones and needs an explicit request.
- Cleanable surfaces: keep dirt shader code in `scene/dirtLayer.ts`; mask and brush logic in `cleaning/`. Never read the mask back to the CPU per frame.
- New solid furniture or props the player should not walk through must be wrapped with `markSolid()`.
- Keep `README.md` and this file accurate whenever structure or commands change.
- Never commit generated output (`dist/`, `node_modules/`).
