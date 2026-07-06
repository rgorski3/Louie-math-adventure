# Math Kingdom — Design Session Handoff
> 2026-06-21 | Branch: `claude/dungeon-progression-spec-kpod6c`

This document is a complete handoff for the next context window. Read this first, then open `Dungeon_Progression_Specification.md` for the full living spec.

---

## What the project is

**Math Kingdom** — a browser-based educational game (React + Vite, Canvas 2D, hosted on Vercel). Target audience is kids learning math. Pixel art style inspired by Undertale.

**Two gameplay pillars (separate modes):**
1. **Dungeon mode** — the original math battle concept. Core loop. ← This session's focus.
2. **Trebuchet mode** — a physics-puzzle layer on top of the same math idea. Already built as an alpha (`src/MathKingdom.jsx`). The trebuchet alpha is live on Vercel.

The dungeon system is **entirely new** — nothing is implemented yet. The spec written this session is the foundation.

---

## All decisions locked in this session

### Game structure
- Dungeon mode = solve math problem → attack enemy (correct = hit, wrong = skip attack but still dodge)
- Player and enemies both have **HP bars**
- Dodge mechanic is **Undertale-style**: player steers a soul avatar in an arena box to avoid enemy projectiles
- Enemy always attacks every turn; player must dodge regardless of whether they answered correctly

### Dungeon tiers — 5 regular + 1 secret

| Tier | Theme | Boss | Boss Attack |
|------|-------|------|-------------|
| 1 | White / Stone | Golem | Vertical fist slam — slow, wide |
| 2 | Fire | Inferno Knight | Diagonal cross slash — two cuts per turn |
| 3 | Ice | Ice Serpent | Curved winding body through the arena |
| 4 | Poison | Venomous Centipede | Entire body is the hazard — thread the needle |
| 5 | Wind | Gale Wraith | Wind blades ricochet off arena walls |
| 🔒 | Secret | **Red Eye of Chaos** | See below — unlocks at 1,000 correct answers lifetime |

Each tier has **3 sections**, each section has **3–5 standard enemies** plus a boss. Sections unlock sequentially; completed sections can be revisited.

### Key system
- Defeating enemies drops **key charge** (partial currency)
- Key charge accumulates; when full (threshold TBD) → earn 1 key
- Boss defeats drop significantly more key charge than standard enemies
- What keys are used for → **TBD** (high priority)

### Red Eye of Chaos — final boss (fully designed)

**Unlock:** 1,000 total correct answers across all dungeons, lifetime, not in a row. Requires Supabase backend to track.

**Character design (artist is making original art):**
- Stick figure humanoid floating slightly off the ground
- Both hands holding a red katana
- Wavy cape
- Two mismatched eyes: small green (left) + large Jupiter storm eye (right)

**Phase 1:**
- Attacks with red katana in creative patterns + blasts of red energy
- Player can deal damage normally

**Phase 2 (triggers at HP threshold — TBD, e.g. 50%):**
- Visual: vortex erupts behind him, entire face becomes the storm eye, grows to 6 arms total
- Boss is **immune to damage** when Phase 2 starts
- Player must land **6 correct answers** to charge their soul through ROYGBIV:
  - Hit 1→R, 2→O, 3→Y, 4→G, 5→B/I, 6→V → immunity breaks
- After 6th hit: player deals damage, soul stays rainbow for the rest of the fight

### Tutorial / onboarding
- Runs on first launch, before dungeon select
- **Interactive** (player performs actions with guidance, not a passive cutscene)
- Starting screen shows: dungeons, castles, bricks, catapult
- A **separate NPC guide** character (not Louie) walks the player through mechanics
- NPC identity and design → TBD

---

## What still needs decisions (open questions)

| Priority | Question |
|----------|----------|
| **High** | What math skills does each tier test? (multiplication → division → fractions → ?) |
| **High** | What are the rewards per tier? (gold, cosmetics, legendary items?) |
| **High** | What are keys used for? (unlock sections, chests, doors?) |
| **High** | Phase 1→2 HP threshold for Red Eye of Chaos |
| Medium | Do standard enemies have thematic attacks, or just bosses? |
| Medium | Purpose of revisiting completed sections (farming, achievements?) |
| Medium | Identity and design of the helper NPC |
| Low | Does the NPC persist beyond the tutorial? |
| Low | Exact key charge drop values and full-key threshold |

---

## What's already built (trebuchet alpha)

`src/MathKingdom.jsx` — 660-line single component:
- Canvas: trebuchet, stone wall, target, starfield, animated arm
- Phases: PROBLEM → AIM → FIRING → RESULT
- Math: multiplication problem → counterweight answer → sets launch velocity
- Three outcomes: HIT, WALL/MISS, CATASTROPHIC
- "Next Level" button regenerates a random problem — no real level system yet

No dungeon code exists. The alpha is the trebuchet only.

---

## Repo / branch info

- **Repo:** `rgorski3/Louie-math-adventure`
- **Working branch:** `claude/dungeon-progression-spec-kpod6c`
- **Key files:**
  - `Dungeon_Progression_Specification.md` — full living spec (source of truth)
  - `Design_Session_Handoff.md` — this file
  - `Math_Kingdom_Alpha_Plan.md` — trebuchet alpha tech plan
  - `Math_Kingdom_Design_Summary.md` — original high-level design philosophy
  - `src/MathKingdom.jsx` — the only implemented game code

---

## Suggested next steps

1. **Answer the 4 high-priority open questions** above (especially math skills per tier and key usage) — these gate implementation
2. **Design the NPC guide character** — needed for tutorial implementation
3. **Begin dungeon implementation** — recommended order:
   - Combat screen (math problem + HP bars)
   - Undertale-style dodge arena
   - Standard enemy encounters
   - Key charge system
   - Section/dungeon structure + progression
   - Boss fights (Golem first, simplest pattern)
   - Red Eye of Chaos last (needs Supabase for lifetime answer tracking)
4. **Supabase backend** — needed for: key persistence, section unlock state, lifetime correct answer count (Red Eye unlock)
