# Goal Ledger: Dungeon Tiers + Boss Design

Branch: `claude/goal-harness-dungeon-tiers-jq57uq`
Status: **harness only** — this file defines the goal for a *future* execution session. No feature code has been written against this ledger yet.

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
- [ ] How many levels per tier, and how many tiers before the boss?
- [ ] Boss HP value and how many hits it takes (fixed number vs. HP pool with variable damage)?
- [ ] Does per-hit difficulty escalation change the multiplication factors (`mps`/`rs` in `newProb()`), the wall/target geometry, or both?
- [ ] What happens on defeat/failure during a boss fight — does a Catastrophic miss reset boss HP, cost a "life", or just require a retry with no HP penalty?
- [ ] Visual design for the HP bar (must stay within the existing Undertale-inspired pixel style in `CLAUDE.md`).

## Sub-goal ledger

- [ ] Design a level-config schema (wall position, target position/HP, tier index, level index, difficulty params) and validate the wall-clearing physics for at least the first and last configured level by hand or with a small script before wiring it into the component.
- [ ] Replace the hardcoded `WALL_X`/`TARGET_X`/etc. constants with per-level config lookups driven by current tier/level state.
- [ ] Add tier/level progression state (which level the player is on, advance on `HIT`, don't advance on `MISS`/`WALL`/`CATASTROPHIC`).
- [ ] Implement boss encounter: HP state, multi-hit handling, per-hit difficulty escalation, victory condition and UI.
- [ ] Add HP bar rendering consistent with the existing pixel-art canvas style.
- [ ] Confirm the existing single-level alpha experience still works as level 1 of tier 1 (no regression to the golden path).

## Verification gate for this feature

In addition to the standing hook gate (`npm run lint` + `npm run build`, both must pass):
- [ ] Manual smoke test: play through every configured level in at least one full tier, confirm progression advances only on `HIT`.
- [ ] Manual smoke test: for every level (not just level 1), confirm a wrong-magnitude counterweight fails at multiple angles, and confirm the correct counterweight clears the wall within the intended angle range.
- [ ] Manual smoke test: full boss fight — verify HP decrements per hit, difficulty escalates, and victory state triggers correctly on the final hit.
- [ ] Manual smoke test: Catastrophic outcome during a boss fight behaves per whatever the open decision above resolves to (not left inconsistent/undefined).
- [ ] No new console errors introduced (check the browser console during all of the above, not just lint/build).

Do not report this feature done on lint/build passing alone — per `CLAUDE.md`, this repo has no automated test suite, so the manual smoke tests above are load-bearing evidence, not optional polish.
