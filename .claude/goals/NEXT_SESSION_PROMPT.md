# Prompt for the next session (dungeon-tiers-boss-design implementation)

Paste this into a fresh session to pick up implementation. It is self-contained and assumes no memory of the harness-setup session that produced it.

---

You're implementing a feature in the **Math Kingdom** repo (`rgorski3/louie-math-adventure`) — a React + Vite, Canvas 2D educational game teaching multiplication via trebuchet physics, no backend.

A prior session set up a "goal harness" for this work on branch `claude/goal-harness-dungeon-tiers-jq57uq` (already merged/available). Before writing any code:

1. **Read `CLAUDE.md` in the repo root.** It has non-negotiable invariants you must not violate — especially the non-bypassable-math rule, the three-tier outcome system, the pixel-art style constraints, and the ref-vs-state-during-render rule (violating that one fails lint, not just a style nit).
2. **Read `.claude/goals/dungeon-tiers-boss-design.md`.** That's the goal ledger for this exact feature: replace the single hardcoded level with a data-driven sequence of levels ("dungeon tiers") of escalating difficulty, ending in a multi-hit boss encounter with an HP bar.
3. **Resolve the "Open decisions" checklist in that ledger before implementing.** Things like how many levels per tier, boss HP value, what happens on a Catastrophic miss mid-boss-fight, and HP bar visual design are product/architecture calls — use `AskUserQuestion` to get answers from the user rather than inventing them. Don't skip this; the ledger flags them precisely because a prior session didn't have the authority to decide them.
4. **Work the "Sub-goal ledger" checklist top to bottom**, checking items off as you go (edit the file directly).
5. **Completion gate is automatic, not optional**: `.claude/settings.json` runs `npm run lint` after every edit to a `.js`/`.jsx` file and `npm run lint && npm run build` when you try to stop — both must exit 0 or the harness blocks you. There's no automated test suite, so you also need to satisfy the **manual smoke tests listed in the ledger's "Verification gate" section** (play through a full tier, verify wrong answers fail at every level, verify boss HP/escalation/victory) — run `npm run dev` and drive it, don't just claim done because lint/build passed.
6. If you hit a decision that changes the physics model, the level data shape, or the outcome-tier system mid-implementation, that's an architecture checkpoint per `CLAUDE.md` — surface it, don't decide alone.

When the feature is done, update the ledger file to reflect completion (not just checked boxes — change the status line at the top) and commit it alongside the code.
