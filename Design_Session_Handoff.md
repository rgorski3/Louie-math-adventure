# Design Session Handoff

Quick-load context for a new session. Read this first.

---

## What this game is

Louie's Math Adventure — browser game (React + Canvas 2D, Vercel). Two modes:
- **Trebuchet mode** (`MathKingdom.jsx`): solve multiplication → fire trebuchet over wall.
- **Dungeon mode** (`DungeonGame.jsx`): Undertale-style boss fights where math = offense, dodging = defense.

---

## Dungeon mode — locked decisions

### 5 Dungeon Tiers + 1 Secret Boss

| Tier | Dungeon | Boss | Math Skill |
|------|---------|------|------------|
| 1 | Stone | Gargoyle King | Multiplication ×1–5 |
| 2 | Fire | Inferno Drake | Multiplication ×6–12 |
| 3 | Ice | Glacial Specter | Basic division |
| 4 | Poison | Venom Hydra | Mixed ops (× then +/−) |
| 5 | Wind | Storm Sovereign | Ratio word problems |
| 6 (secret) | Final Trial | Red Eye of Chaos | All skills, mixed |

### Combat Loop (per turn)

1. Math problem appears → player types answer → submits
2. Dodge phase starts (5.5 seconds): boss fires attack patterns into the arena
3. Player moves their soul (arrow keys) to dodge bullets
4. Turn ends:
   - Correct answer + survived → boss takes 1 HP damage
   - Wrong answer + survived → no damage (but they still had to dodge)
   - Player takes 3 hits total before Game Over (hearts system)

### Key System (locked)

Each boss drops a key that unlocks the next dungeon tier. Linear gate.
- Gargoyle King → Ember Key → unlocks Fire Dungeon
- Inferno Drake → Frost Key → unlocks Ice Dungeon
- Glacial Specter → Venom Key → unlocks Poison Dungeon
- Venom Hydra → Gale Key → unlocks Wind Dungeon
- Storm Sovereign → Chaos Key → unlocks Red Eye of Chaos
- Red Eye → no key (final boss)

### Reward System (locked)

Clearing a boss gives a **cosmetic trophy** displayed on the dungeon select screen. No stat effect. Keeps the game skill-based.

### Red Eye of Chaos — 2-Phase Fight (locked)

**Appearance:** Humanoid stick figure in pixel art — katana in right hand, storm eye in head, red iris glowing.

**Phase 1:** 12 HP. Standard combat. When HP reaches 0: *boss refuses to die* (Undyne-style). Transforms.

**Phase 2:** HP resets to 12. Boss is **immune** (no damage possible).
- To break immunity: player must charge soul through all 7 ROYGBIV colors
- Each *correct* math answer advances the soul color one step (Red → Orange → Yellow → Green → Blue → Indigo → Violet)
- Wrong answers do not advance the counter
- After 7 correct answers: immunity shatters, one damage dealt, normal combat resumes
- ROYGBIV progress shown as 7 color swatches left of the arena

**Unlock requirement:** 1,000 lifetime correct answers (tracked in localStorage).

### Attack Patterns (Undertale-style, by boss)

All bosses have 3–4 named attack patterns, spawned in random order during each dodge phase.

| Boss | Attacks |
|------|---------|
| Gargoyle King | `stone_rain`, `stone_wall`, `stone_slab` |
| Inferno Drake | `fire_stream`, `fire_burst`, `fire_wall` |
| Glacial Specter | `ice_shards`, `ice_wall`, `ice_spiral` |
| Venom Hydra | `poison_ring`, `poison_trail`, `poison_burst` |
| Storm Sovereign | `wind_spiral`, `wind_cross`, `wind_swarm` |
| Red Eye of Chaos | `chaos_slash`, `chaos_storm`, `chaos_beam`, `chaos_rain` |

---

## Open questions resolved this session

| Question | Answer |
|----------|--------|
| Math skills per tier | Progression by operation type (see table above) |
| Rewards per tier | Cosmetic trophy + flavor badge only |
| What keys unlock | Next tier gate (linear) |
| Red Eye Phase 1→2 threshold | Phase 1 HP hits 0 → transformation (Phase 2 at full HP) |

---

## Technical notes

- Persistence: `localStorage` key `dungeon_saves` holds `{ unlocked: [tiers], trophies: [boss ids], totalCorrect: N }`
- Canvas: 800×480. Boss sprite in top 200px, dodge arena (360×235) in bottom half
- Soul speed: 195 px/s. Arena: `ARENA_X=220, ARENA_Y=215, ARENA_W=360, ARENA_H=235`
- Bullet collision: circle vs circle, hit clears all bullets + grants 0.7s grace period
- Wave spawn: every 1.8 seconds during dodge phase

---

## Still to do / polish ideas

- [ ] Sound effects (correct answer ding, hit thud, boss defeat fanfare)
- [ ] Animated phase transition for Red Eye (screen flash + text)
- [ ] Per-tier background art on the canvas
- [ ] Difficulty scaling within a tier (later turns spawn more bullets)
- [ ] Boss HP scales with number of previous clears (optional hard mode)
