# Math Kingdom — Game Structure Redesign Plan

> **Status:** v1.0, 2026-07-12
> **Branch:** `claude/game-battle-building-redesign-a4hxjf`
> **Supersedes:** the battle-in-trebuchet structure merged in PR #4

---

## Why this redesign

PR #4 wired the Undertale-style dodge battle **into the trebuchet firing loop** — every
shot triggers a counterattack dodge box. That contradicts the design docs:

- `Dungeon_Progression_Specification.md`: *"Dungeon mode is the primary math battle
  experience. The trebuchet is a **separate** physics-puzzle mode."*
- `Math_Kingdom_Design_Summary.md` calls for a dual-phase loop: high-intensity math
  **sprints** and a relaxing **building/strategy** phase — the building phase was never built.

This plan restructures the game into three separate sections reachable from a hub,
plus a session-scoped shared material economy connecting them.

---

## New game structure

```
KINGDOM HUB (mode select)
├── ⚔ BATTLE  — dungeon math combat (the dodge box lives HERE now)
├── 🏰 BUILD   — earn materials with math, construct castle & defenses
└── 🎯 SIEGE   — the trebuchet physics puzzle (dodge box REMOVED)
```

- The hub is a pixel-art kingdom map screen in the existing Undertale style.
- A **materials bar** (🪨 stone · 🪵 wood · 🪙 gold) is owned by the hub and visible
  everywhere. Battle victories and Siege level clears award materials; Build both
  earns (quarry/lumber/mine problems) and spends them.
- Session-only, per alpha scope: reload resets everything. No backend, no accounts.

## File layout

| File | Role |
|---|---|
| `src/MathKingdom.jsx` | Hub: mode select, materials state, renders active mode |
| `src/game/shared.js` | Palette `C`, canvas constants, heart/HP drawing, particles, problem gen, shared UI styles |
| `src/game/TrebuchetMode.jsx` | The existing trebuchet game, dodge phase stripped out (`calcTraj`/`checkTraj` live here now) |
| `src/game/BattleMode.jsx` | NEW — dungeon combat section |
| `src/game/BuildMode.jsx` | NEW — castle building section |

---

## Section 1 — ⚔ BATTLE (dungeon combat)

Implements the alpha slice of `Dungeon_Progression_Specification.md`:
**Stone Dungeon, Tier 1, Section 1** — three standard enemies, then the Golem boss.

### Turn loop (per spec)
1. Math problem displayed (multiplication, difficulty ramps per enemy)
2. Player types answer
3. **Correct** → player attack lands: slash flash + damage number, enemy HP −1
4. **Wrong** → attack fizzles; the turn is not skipped-free — the enemy still attacks
5. **Enemy always counterattacks** → Undertale dodge box (moved verbatim from the
   old trebuchet DODGE phase): steer the soul heart with arrows/WASD
6. Repeat until enemy HP = 0 (victory, key charge + material drop) or player HP = 0
   (soul shatters → retry the same enemy with restored HP; dungeon position kept)

### Encounters
| # | Enemy | HP | Problems | Attack pattern |
|---|---|---|---|---|
| 1 | Pebble Sprite | 2 | 3–6 × 2–5 | slow falling rubble |
| 2 | Brick Bat | 2 | 4–7 × 3–6 | faster rubble, more spawns |
| 3 | Rubble Knight | 3 | 6–9 × 4–8 | dense mixed rubble |
| Boss | **GOLEM** | 4 | 7–12 × 6–9 | telegraphed vertical fist-slam columns (per spec) |

- Player HP: 3 hearts, invulnerability frames on hit — identical numbers to PR #4.
- Non-bypassable math: damage is only dealt on an exactly correct answer.
- Clearing the section shows key-charge earned and returns to the hub.
- Future tiers (Fire/Ice/Poison/Wind/Red Eye of Chaos) slot in as more encounter
  lists — the encounter array is the extension point.

## Section 2 — 🏰 BUILD (castle & defenses)

The missing "Strategy" phase from `Math_Kingdom_Design_Summary.md`. Relaxed pace, no
timer, no HP — but math stays non-bypassable.

### Earning materials — work sites
Three actions: **QUARRY** (stone), **LUMBER CAMP** (wood), **MINE** (gold).
Picking one deals a multiplication problem; a correct answer earns **exactly the
product** in that material (e.g. `7 × 6` → 42 stone) — the answer's magnitude *is*
the reward, so bigger problems visibly pay more. A wrong answer earns nothing and
shows the correct working.

### Spending materials — blueprints
The castle grounds are drawn on canvas with fixed build plots. Each blueprint's cost
is itself a math problem — you must compute the cost to place the structure:

| Blueprint | Cost problem (example) | Pays |
|---|---|---|
| Wall segment | "4 rows of 8 stone blocks" | 32 stone |
| Watchtower | "6 rows of 7 stone blocks" | 42 stone |
| Gate | "5 planks × 6 beams" | 30 wood |
| Ballista | "4 × 9 wood" + "2 × 6 gold" | 36 wood, 12 gold |
| Banner | "3 × 4 gold" | 12 gold |

Flow: pick blueprint → cost problem shown → type answer →
**correct + enough materials** = structure built (pixel-art piece appears on the
grounds, small particle burst) · **correct but short on materials** = "not enough
stone — visit the quarry" · **wrong** = builders refuse, retry.

The castle visibly grows as pieces are placed. Built structures persist for the
session and are drawn on the hub's kingdom map is a future nicety (not in scope).

## Section 3 — 🎯 SIEGE (trebuchet, cleaned up)

The existing trebuchet game with the PR #4 battle layer **removed**:
- Phases return to `PROBLEM → AIM → FIRING → RESULT` (no DODGE, no GAME_OVER,
  no player HP).
- Everything else is untouched: 2 tiers × 3 levels + Wall Warden boss, validated
  level geometry, three-tier outcome system (Success / Marginal / Catastrophic).
- Level clears award stone + gold to the shared material pool.

---

## Invariants preserved (per CLAUDE.md)

- **Non-bypassable math** in all three sections (trebuchet geometry untouched;
  battle damage and construction both gated on exact correct answers).
- **Three-tier outcome system** in Siege stays intact.
- **Undertale pixel style**: shared `C` palette, Courier New, zero border-radius,
  `imageSmoothingEnabled = false`, integer-snapped drawing.
- **Refs vs. state** discipline in every mode (raf loops read refs; JSX reads state).
- **Alpha scope**: no backend, no persistence — materials and progress reset on reload.

## Out of scope (future)

- Dungeon tiers 2–6, key spending, Red Eye of Chaos (needs persistence)
- Built structures affecting Battle/Siege gameplay (defense bonuses)
- Hint system, collectibles, trading, Supabase
