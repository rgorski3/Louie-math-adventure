# Math Kingdom — Dungeon Progression Specification

> **Status:** Draft (v0.2, 2026-06-19)
> **Scope:** Dungeon mode is a distinct game mode from the trebuchet mechanic. These are two separate gameplay pillars.

---

## Overview

Dungeon mode is the core exploration and combat experience in Math Kingdom. Players advance through a series of themed dungeons of increasing difficulty, solving math problems to defeat enemies, collecting keys, and unlocking new sections and tiers via boss encounters.

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

## Combat Mechanic (Dungeon-Specific)

> **Note:** The trebuchet mode is a separate game pillar. Dungeon combat uses its own mechanic.

**Open questions (high priority — needed before implementation):**
- What is the dungeon combat mechanic? How does the player attack enemies?
- How does math gate progress? (Correct answer = hit, wrong answer = miss? Or something else?)
- Do enemies have HP bars requiring multiple correct answers to defeat?
- Are there different combat rules per enemy type or dungeon tier?

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
| 1 | What is the dungeon combat mechanic? | **Critical** |
| 2 | What are keys used for (what do they unlock)? | High |
| 3 | What math skills does each dungeon tier test? | High |
| 4 | What are the rewards per tier? | High |
| 5 | Identity and design of the helper NPC | Medium |
| 6 | Purpose of revisiting completed sections | Medium |
| 7 | Does the NPC appear beyond the tutorial? | Low |
| 8 | Exact key charge values (drop amounts, threshold) | Low |
| 9 | Enemy HP — single-hit or multi-hit? | Depends on Q1 |

---

## Relationship to Existing Systems

| System | Status | Notes |
|--------|--------|-------|
| Trebuchet mode | Separate pillar | Not used inside dungeons |
| Math problem engine | Shared | Dungeon combat should reuse the problem generator with tier-appropriate difficulty |
| Hint system (Math_Kingdom_Design_Summary) | Deferred | Planned currency-costed hints apply to dungeon too |
| Supabase backend | Deferred | Needed for key/progress persistence across sessions |
| Collectibles / pets / legendary items | Future | High-tier dungeon rewards feed into this system |
