# Math Kingdom — Handoff for Fable
> Prepared for: claude-fable-5
> Branch: `claude/dungeon-progression-spec-kpod6c`
> Repo: `rgorski3/Louie-math-adventure`

---

## What this project is

**Math Kingdom** is a browser-based educational game for kids learning math. The aesthetic is directly inspired by **Undertale** — pixel art, dark palette, expressive dialogue boxes, lo-fi charm. The game is built in React + Vite, renders on a Canvas 2D, and is hosted on Vercel. No backend yet (Supabase is planned).

There are two gameplay pillars:

1. **Trebuchet mode** — already built. Player solves a multiplication problem to calibrate a trebuchet, adjusts an angle, fires at a castle wall. Physics-puzzle layer on top of math. This is the live alpha.

2. **Dungeon mode** — not yet built. This is where the session's design work happened. It is the *original* math battle concept the game is built around; the trebuchet is an expansion on it.

---

## What was designed this session

### The dungeon combat loop

Every turn:
1. A math problem appears
2. The enemy always attacks — the player steers a small **soul avatar** in an Undertale-style arena box to dodge projectiles
3. If the player answered **correctly** → they deal damage to the enemy's HP bar
4. If the player answered **wrongly** → they skip their attack but still have to dodge

Both player and enemies have HP bars. Combat has two layers running simultaneously: **math (offense)** and **dodge (defense)**.

---

### The dungeon tiers

Five regular dungeons plus one secret final tier, unlocked in sequence:

| Tier | Theme | Boss | What makes the boss fight distinct |
|------|-------|------|-------------------------------------|
| 1 | White / Stone | **Golem** | Fist slams vertically — slow, wide, readable |
| 2 | Fire | **Inferno Knight** | Diagonal sword cross — two fast cuts per turn |
| 3 | Ice | **Ice Serpent** | Winding curved body — entire body is the hazard |
| 4 | Poison | **Venomous Centipede** | Long segmented body snakes through the arena — thread the needle |
| 5 | Wind | **Gale Wraith** | Wind blades ricochet off walls — player tracks multiple at once |
| 🔒 | Secret | **Red Eye of Chaos** | See full design below |

Each tier has **3 sections**, each section has **3–5 standard enemies** + a boss. Completing a section's boss unlocks the next section. Players can revisit completed sections.

---

### The key system

- Defeating enemies drops **key charge** (a partial currency that fills a meter)
- Bosses drop significantly more key charge than standard enemies
- When the meter fills → player earns a full key
- **What keys actually unlock is still TBD** — this is a high-priority open question

---

### Red Eye of Chaos — the final boss (fully designed)

**Unlock condition:** 1,000 total correct answers lifetime across all dungeons (not in a row). Requires Supabase to track persistently.

#### Visual design (the creator has original art for this)
A humanoid stick figure floating slightly off the ground. Both hands grip a red katana. A wavy cape hangs behind him. His eyes are mismatched: one is small and green — almost unassuming. The other is large and terrible, like the Great Red Storm of Jupiter. The storm IS his eye.

#### Phase 1
Uses the red katana in creative attack patterns — slashes, sweeps, beams of red energy fired through the sword. Player takes damage normally and can deal damage normally.

#### Phase 2 — The Storm Awakens
Triggered at a HP threshold (TBD — likely 50%).

Visual transformation: a massive vortex erupts behind him. The small green eye disappears — his entire face becomes the storm eye. He grows four more energy arms, for **six total**. He continues firing energy blasts.

**The immune mechanic:** When Phase 2 begins, the boss is completely immune to damage. The only way to break through is to answer **6 math problems correctly** in sequence. Each correct answer doesn't hurt him — instead it charges the player's soul, cycling it through the rainbow:

- Hit 1 → soul turns **Red**
- Hit 2 → **Orange**
- Hit 3 → **Yellow**
- Hit 4 → **Green**
- Hit 5 → **Blue / Indigo**
- Hit 6 → **Violet** — soul fully charged, immunity shatters

After the 6th charge the player can deal damage again. The soul stays rainbow-cycling for the rest of the fight. The ROYGBIV progression is visible the whole time — kids can see their power building color by color.

---

### Tutorial / onboarding
- Runs on first launch before the dungeon
- **Interactive**, not a cutscene — player does things with guidance
- Starting screen shows visual examples: dungeons, castles, bricks, catapult
- A **separate NPC guide** (not Louie) walks the player through mechanics step by step
- NPC identity and design is TBD

---

## Open questions (what still needs decisions)

| Priority | Question |
|----------|----------|
| **High** | What math skills does each tier test? (multiplication → division → fractions → ?) |
| **High** | What are the rewards per tier? (gold, cosmetics, legendary items?) |
| **High** | What do keys actually unlock? (sections, chests, special content?) |
| **High** | What HP threshold triggers Red Eye of Chaos Phase 1→2? |
| Medium | Do standard enemies have thematic attacks, or just bosses? |
| Medium | Purpose of revisiting completed sections (farming, achievements, replay?) |
| Medium | Who is the tutorial NPC and what do they look like? |
| Low | Does the NPC persist as a hint system beyond the tutorial? |
| Low | Exact key charge drop amounts and full-key threshold numbers |

---

## Files to read

| File | What it is |
|------|------------|
| `Dungeon_Progression_Specification.md` | Full living spec — source of truth for everything above |
| `Design_Session_Handoff.md` | Technical handoff with repo/branch details and implementation order |
| `Math_Kingdom_Alpha_Plan.md` | Tech plan for the trebuchet alpha (canvas dimensions, physics constants, color palette) |
| `Math_Kingdom_Design_Summary.md` | Original high-level design philosophy (dual-phase loop, hint system, collectibles vision) |
| `src/MathKingdom.jsx` | The only implemented game code — the trebuchet alpha, 660 lines |

---

## Tone / design philosophy to preserve

- **Undertale DNA**: pixel art, dark palette, expressive dialogue, lo-fi. The existing color palette is documented in `Math_Kingdom_Alpha_Plan.md`.
- **Math is non-bypassable**: the game never lets you skip the math to progress. It's the only path forward.
- **Stakes feel real**: wrong answers have consequences (skip turn, still dodge). The design doc explicitly notes a tension between "soften difficulty" and keeping real pressure. That tension is intentional.
- **Long-term payoff**: the Red Eye of Chaos at 1,000 answers is the north star for the most dedicated players. The design should always be pointing toward that horizon.
