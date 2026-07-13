# Math Kingdom — Constraints

Browser educational game teaching multiplication. Three sections behind a kingdom hub (`src/MathKingdom.jsx`): Battle (`src/game/BattleMode.jsx`), Build (`src/game/BuildMode.jsx`), Siege/trebuchet (`src/game/TrebuchetMode.jsx`). React + Vite, Canvas 2D, no backend, no accounts. See `README.md`, `Game_Structure_Redesign_Plan.md`, and `Math_Kingdom_Alpha_Plan.md` for full design context.

## Non-negotiable invariants

- **Math must be non-bypassable** in every section. Siege: a wrong counterweight answer must fail (hit the wall, or miss) at every reachable angle; only the correct answer + a discoverable angle range clears the wall and hits the target. If you add or change level geometry, re-derive this with the trajectory math (`calcTraj`/`checkTraj` in `src/game/TrebuchetMode.jsx`) — don't eyeball it. Battle: only an exactly correct answer deals damage. Build: only an exactly correct answer earns materials or places a structure.
- **Three-tier outcome system stays intact**: Success (within `TARGET_R` of target), Marginal (`cwError <= 0.05`), Catastrophic (`cwError > 0.20`). Don't collapse these into a binary hit/miss.
- **Undertale-inspired pixel art style**: dark navy/warm-earth palette (see `C` object in `src/game/shared.js`), `Courier New`/monospace only, zero `border-radius` anywhere, `imageSmoothingEnabled = false`, integer-snapped canvas coordinates (`~~x`).
- **Refs vs. state**: mutable per-frame game data (position, trajectory, particles) lives in `useRef` and is read by the `requestAnimationFrame` loop — never read a ref's `.current` during React render (JSX or a hook's initializer argument). If a ref-held value needs to affect rendered output, mirror it into `useState` at the point it's written, or sync it via a `useEffect` keyed on the state. This is enforced by `eslint-plugin-react-hooks`'s `react-hooks/refs` rule — it is not stylistic, `npm run lint` will fail.
- **Alpha scope**: no backend, no accounts, no persistent save state (session resets on reload) — this is deliberate, don't add persistence without discussing it first.

## Completion gate (enforced by hooks, not memory)

`.claude/settings.json` runs `npm run lint` after every edit to a `.js`/`.jsx` file, and `npm run lint && npm run build` on Stop. Both must exit 0. There is no automated test suite in this repo currently — lint + build are the full automated gate. This means:
- Do not claim a task "done" based on reading the code back — the Stop hook will block you and hand back the failure if lint or build are broken.
- If the Stop hook blocks and you can't identify why after a couple of tries, stop and report the actual hook output to the user rather than guessing further fixes — that's the escalation path, not silent retrying.
- A hook that blocks on something outside the current task's scope (e.g. pre-existing failures unrelated to your change) is a harness bug — flag it, don't route around it with `--no-verify`-style workarounds.

## Manual verification (no test suite)

Because there's no automated test runner, any change to game logic (state transitions, physics, level flow) needs a manual smoke test before you claim it works: run `npm run dev` and drive the golden path of whichever section you touched — Siege: PROBLEM → AIM → FIRE → RESULT with a correct answer, plus a Catastrophic result with a wildly wrong answer; Battle: answer correctly (enemy takes damage) and wrongly (no damage), survive a dodge round; Build: earn materials at a work site and place a structure. Watch the browser console for errors. Don't rely on lint/build passing alone as evidence a UI change behaves correctly.

## Architecture checkpoints

Decisions that change the physics model, the level data shape, or the outcome-tier system are architecture-level — surface them to the user (or route to `/advisor` if available) rather than deciding unilaterally mid-task.
