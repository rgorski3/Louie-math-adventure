# Goal Ledger: Dungeon Tiers + Boss Design

Branch: `claude/goal-harness-dungeon-tiers-jq57uq` (harness) → `claude/dungeon-tiers-boss-design-ovz864` (implementation)
Status: **COMPLETE** — implemented and verified 2026-07-05. All open decisions resolved with the user, all sub-goals done, full verification gate passed (lint + build green; 46-check end-to-end smoke run in Chromium against the dev server with zero failures and zero console errors).

## Goal

Replace the single hardcoded trebuchet level with a **level-config system**: a sequence of levels ("dungeon tiers") of escalating difficulty, culminating in a **multi-hit boss encounter** with an HP bar. Confirmed with the user on 2026-07-05:

- **Tiers** = a sequence of individual levels, each harder than the last (not broad difficulty bands). Escalation happens level-by-level, not just tier-by-tier.
- **Boss** = a persistent-HP encounter. Requires multiple correct trebuchet hits to defeat. Problem difficulty escalates with each hit landed (not fixed).
- Alpha-scope constraints from `CLAUDE.md` still apply: no backend, no accounts, no save-state persistence (this includes boss HP — it resets on reload same as everything else, unless the user decides otherwise when this is picked up).

## Constraints (in addition to root `CLAUDE.md`)

- Every generated level (including boss hits) must independently satisfy the non-bypassable-math invariant: wrong counterweight fails at every angle, correct counterweight + discoverable angle clears the wall and lands in the target/boss zone. This must be re-verified per level geometry, not assumed to generalize from the alpha's single validated layout.
- The existing three-tier outcome system (Success / Marginal / Catastrophic) must apply to every shot, including boss hits — a boss fight is a sequence of normal shots against a target that has HP, not a new outcome model.
- Keep the `PROBLEM → AIM → FIRING → RESULT` phase flow intact; extend it (e.g. a `RESULT` that leads to "next level" vs "boss intro" vs "boss hit" vs "victory") rather than replacing it.
- Level/tier/boss data should be data-driven (a level config list/object), not copy-pasted level-specific branches in component logic — this repo's existing tech debt note ("level geometry hardcoded — needs a level configuration system") is exactly what this feature resolves.

## Open decisions for the executing session (architecture checkpoints — surface, don't decide silently)

These were out of scope for this harness-setup session and need a decision (ask the user, or route to `/advisor` if available) before or during implementation:
- [x] How many levels per tier, and how many tiers before the boss? — **Resolved 2026-07-05 (user):** 2 tiers × 3 levels, then the boss as the finale (7 encounters total).
- [x] Boss HP value and how many hits it takes (fixed number vs. HP pool with variable damage)? — **Resolved 2026-07-05 (user):** 3 HP, fixed damage — every Success removes exactly 1 HP; Marginal/WALL/MISS remove nothing.
- [x] Does per-hit difficulty escalation change the multiplication factors (`mps`/`rs` in `newProb()`), the wall/target geometry, or both? — **Resolved 2026-07-05 (user):** Both, per level (harder factor sets AND taller/closer walls + smaller/farther targets). Boss hits escalate math only; boss geometry stays fixed during the fight. Every geometry re-validated with the trajectory math.
- [x] What happens on defeat/failure during a boss fight — does a Catastrophic miss reset boss HP, cost a "life", or just require a retry with no HP penalty? — **Resolved 2026-07-05 (user):** No HP penalty — boss keeps its current HP, player rebuilds and retries the same strike (consistent with regular levels; no lives system).
- [x] Visual design for the HP bar (must stay within the existing Undertale-inspired pixel style in `CLAUDE.md`). — **Resolved 2026-07-05 (user):** Segmented pips above the boss sprite — three chunky square segments (cream border, red fill) that go dark when a hit lands, with a `BOSS` label in Courier New.
- [x] **Success gate (found during implementation physics audit):** the alpha's geometric-only HIT check lets wrong answers (up to 20% off) hit the target at some slider angle — the angle slider compensates for wrong velocity, and no wall geometry can fully prevent it. — **Resolved 2026-07-05 (user):** A geometric hit only counts as Success when the typed answer is exactly correct; a wrong-but-close answer that reaches the target "GLANCES OFF" (a Marginal-tier `DEFLECT` outcome: feedback + retry, no level clear / no boss damage). Matches the original spec's `player_counterweight != correct_counterweight` rule.

## Sub-goal ledger

- [x] Design a level-config schema (wall position, target position/HP, tier index, level index, difficulty params) and validate the wall-clearing physics for at least the first and last configured level by hand or with a small script before wiring it into the component. — `LEVELS` array in `src/MathKingdom.jsx` (`{tier, lvl, wallX, wallTop, wallW, targetX, targetR, probs}` + boss entry with `{boss, hp, hitProbs[]}`). All 7 geometries (not just first/last) validated with a script replicating `calcTraj`/`checkTraj`: each has a contiguous 4–5° hit band for the correct answer and flat angles blocked by the wall. Bands recorded in a comment above `LEVELS`.
- [x] Replace the hardcoded `WALL_X`/`TARGET_X`/etc. constants with per-level config lookups driven by current tier/level state. — `checkTraj`, `drawWall`, `drawTarget`, `drawLabels` all take the level object; constants deleted.
- [x] Add tier/level progression state (which level the player is on, advance on `HIT`, don't advance on `MISS`/`WALL`/`CATASTROPHIC`). — `levelIdx` state + `levelIdxRef` (loop-side), advance only from the `HIT` result button; `DEFLECT` (see Success gate decision) also does not advance.
- [x] Implement boss encounter: HP state, multi-hit handling, per-hit difficulty escalation, victory condition and UI. — `bossHp` state + `bossHpRef`; each Success decrements 1 HP; `hitProbs[hitsLanded]` escalates factor sets per strike; victory message + `PLAY AGAIN` reset on final hit.
- [x] Add HP bar rendering consistent with the existing pixel-art canvas style. — segmented square pips (cream 2px border, red fill → dark when spent) above the boss golem sprite, `BOSS` label in Courier New, integer-snapped, zero border-radius.
- [x] Confirm the existing single-level alpha experience still works as level 1 of tier 1 (no regression to the golden path). — Tier 1 Level 1 uses the exact alpha geometry (wall 380/175/28, target 680±30); golden path PROBLEM→AIM→FIRE→RESULT verified end-to-end.

## Verification gate for this feature

In addition to the standing hook gate (`npm run lint` + `npm run build`, both must pass):
- [x] Manual smoke test: play through every configured level in at least one full tier, confirm progression advances only on `HIT`. — Played all 6 levels of both tiers plus the boss in Chromium against `npm run dev`; progression buttons only appear on Success.
- [x] Manual smoke test: for every level (not just level 1), confirm a wrong-magnitude counterweight fails at multiple angles, and confirm the correct counterweight clears the wall within the intended angle range. — Per level: a +12% wrong answer fired at the hit-band angle and at 35° (both fail); the correct answer fired at the mid-band angle (Direct Hit). Level 1 additionally verified CATASTROPHIC (3× answer) and the DEFLECT Success gate (a wrong answer that geometrically reaches the target glances off with no progression).
- [x] Manual smoke test: full boss fight — verify HP decrements per hit, difficulty escalates, and victory state triggers correctly on the final hit. — Strikes 1→2→3 verified (strike counter + "N more hits" messages), per-strike factor sets escalate, final hit shows the crumble/victory state and `PLAY AGAIN` resets to Tier 1 Level 1 with full boss HP.
- [x] Manual smoke test: Catastrophic outcome during a boss fight behaves per whatever the open decision above resolves to (not left inconsistent/undefined). — Catastrophic misfire on strike 2 leaves boss HP unchanged (still strike 2/3 after rebuild), per the resolved no-HP-penalty decision. A boss-fight DEFLECT (off-by-one answer) also verified to do no damage.
- [x] No new console errors introduced (check the browser console during all of the above, not just lint/build). — Zero console errors / page errors captured across the entire 46-check run.

Do not report this feature done on lint/build passing alone — per `CLAUDE.md`, this repo has no automated test suite, so the manual smoke tests above are load-bearing evidence, not optional polish.
