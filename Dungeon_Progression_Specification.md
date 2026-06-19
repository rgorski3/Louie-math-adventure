# Math Kingdom — Dungeon Progression Specification

> **Status:** Draft (v0.3, 2026-06-19)
> **Scope:** Dungeon mode is the primary math battle experience. The trebuchet is a separate physics-puzzle mode that layers on top of the same math battle concept.

---

## Overview

Dungeon mode is the core math battle experience in Math Kingdom — the original concept the game is built around. Players advance through themed dungeons by solving math problems to defeat enemies, collecting keys, and unlocking new sections and tiers through boss encounters. The trebuchet mode is a separate gameplay pillar that expands on this same math-battle idea with a physics layer; the dungeon is the base form.

---

## Dungeon Tiers

Dungeons are unlocked sequentially. Each tier introduces a new visual theme, enemy types, and better rewards.

| Tier | Theme | Description | Enemies |
|------|-------|-------------|---------|
| 1 | White / Stone | Entry-level dungeon; basic enemies, forgiving difficulty | TBD |
| 2 | Fire | Mid-tier; flame-themed enemies, higher math difficulty | TBD |
| 3 | Ice | High-tier; frost-themed enemies, harder problems | TBD |
| 4+ | TBD | Strongest enemies; endgame content | TBD |

**Open questions:**
- What specific math skills does each tier test? (e.g., Tier 1 = multiplication, Tier 2 = division, Tier 3 = fractions?)
- What are the concrete rewards per tier? (Gold, cosmetics, legendary items?)
- What do enemy types look like / what makes them thematically distinct beyond visuals?

---

## Dungeon Structure

Each dungeon tier is divided into **3 sections**. Sections unlock sequentially; completed sections can be revisited freely.

```
Dungeon Tier
├── Section 1
│   ├── 3–5 Standard Enemies
│   └── Boss
├── Section 2  (unlocked after Section 1 boss)
│   ├── 3–5 Standard Enemies
│   └── Boss
└── Section 3  (unlocked after Section 2 boss)
    ├── 3–5 Standard Enemies
    └── Boss  ← completing unlocks next Dungeon Tier
```

---

## Key System

Keys are the primary progression currency within a dungeon.

- **Key charge** accumulates as players defeat enemies
  - Standard enemy defeat: drops a small amount of key charge (exact values TBD)
  - Boss defeat: drops a significantly larger key charge amount
- When key charge reaches a threshold (e.g., 100 charge = 1 key), the player earns a full key
- **Open question:** What are keys used for? (Unlock sections, chests, doors, special content?)

---

## Combat Mechanic

Dungeon combat is the original math battle concept: **solve a math problem → attack an enemy**. The trebuchet mode is a separate pillar that builds a physics-puzzle layer on top of this same idea; the dungeon is the direct form.

### Core loop (per turn)
1. Math problem is displayed
2. Player answers the problem
3. **Enemy always attacks** — player must dodge regardless of answer
4. **Correct answer** → player also deals a hit (reduces enemy HP)
5. **Wrong answer** → player cannot attack that turn; must still dodge the enemy's attack
6. Repeat until enemy HP reaches 0 → enemy defeated, key charge drops

Combat has two distinct layers:
- **Math** (offensive) — answering correctly is how you deal damage
- **Dodge** (defensive) — a separate action every turn regardless of whether you answered correctly

### Health bars
- **Enemies** have HP bars — multiple correct answers needed to defeat them
- **Player** has a HP bar — failing to dodge enemy attacks reduces it

### Dodge mechanic (Undertale-style)
- After each turn, the enemy attacks in a contained arena box
- Player controls a small soul/avatar with arrow keys or WASD
- Enemy projectiles or attack patterns fly through the box — player must move to avoid them
- Getting hit reduces player HP
- Attack patterns can escalate per dungeon tier and enemy type (bosses get more complex patterns)

### Open questions
- Do bosses have unique attack patterns / harder dodges, or just more HP?
- Do problem types or difficulty change per enemy, or are they uniform per tier?
- Are there different combat rules per dungeon tier or enemy type?

---

## Progression Flow

```
Start Game
└── Onboarding / Tutorial  (first-time only)
    └── Dungeon Select Screen
        └── Enter Dungeon Tier 1
            └── Section 1
                ├── Defeat 3–5 enemies (collect key charge)
                └── Defeat Boss (large key charge drop)
                    └── Section 2 unlocked
                        └── [repeat...]
                            └── Section 3 Boss defeated
                                └── Dungeon Tier 2 unlocked
```

Players can return to any previously completed section. Purpose of revisiting: TBD (farming key charge? achievement hunting? difficulty replay?).

---

## Onboarding / Tutorial Screen

The tutorial runs on first launch before the player enters the dungeon. It is **interactive**, not passive — the player performs guided actions rather than watching a cutscene.

### Starting Screen Visuals
The starting screen features illustrated examples of game elements:
- Dungeons
- Castles
- Bricks
- Catapult

These serve as a visual preview of the game world to orient the player.

### Helper NPC
- A distinct guide character (separate from Louie) appears on the tutorial screen
- Character identity and design: **TBD**
- The NPC walks the player through core dungeon mechanics interactively, step by step
- **Open question:** Does the NPC persist beyond the tutorial (e.g., as an in-dungeon hint system)?

---

## Open Questions Summary

| # | Question | Priority |
|---|----------|----------|
| 1 | Do bosses have unique/harder attack patterns, or just more HP? | High |
| 2 | What are keys used for (what do they unlock)? | High |
| 3 | What math skills does each dungeon tier test? | High |
| 4 | What are the rewards per tier? | High |
| 5 | Do bosses have unique attack patterns, or just more HP? | Medium |
| 6 | Identity and design of the helper NPC | Medium |
| 7 | Purpose of revisiting completed sections | Medium |
| 8 | Does the NPC appear beyond the tutorial? | Low |
| 9 | Exact key charge values (drop amounts, threshold) | Low |

---

## Relationship to Existing Systems

| System | Status | Notes |
|--------|--------|-------|
| Trebuchet mode | Separate pillar | Expands on the math battle concept with a physics layer; not the dungeon mechanic itself |
| Math problem engine | Shared | Dungeon combat should reuse the problem generator with tier-appropriate difficulty |
| Hint system (Math_Kingdom_Design_Summary) | Deferred | Planned currency-costed hints apply to dungeon too |
| Supabase backend | Deferred | Needed for key/progress persistence across sessions |
| Collectibles / pets / legendary items | Future | High-tier dungeon rewards feed into this system |
