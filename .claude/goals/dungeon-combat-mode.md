# Goal Ledger: Dungeon Combat Mode (Tier 1 slice)

Branch: `claude/dungeon-tiers-boss-design-ovz864`
Status: **Tier 1 COMPLETE** — implemented and verified 2026-07-06. Mode select + full Stone Dungeon (3 sections × 4 enemies + boss doors + Golem finale) with the Undertale-style dodge arena. Lint/build green; 13-check end-to-end smoke run in Chromium (including a full-tier autopilot playthrough to TIER CLEAR) with zero failures and zero console errors. Tiers 2–5 and the Red Eye of Chaos are NOT built yet (see spec).

Source of truth for the design: `Dungeon_Progression_Specification.md` (v0.4 — the four
high-priority open questions were resolved with the user on 2026-07-06 and are marked
inline there: skill ladder per tier, keys+badges rewards, keys open boss doors, Red Eye
Phase 2 at 50% HP).

## What was built

- `src/App.jsx` — mode select screen (DUNGEON / TREBUCHET) + a `⬅ MENU` overlay button.
- `src/theme.js` — shared palette (`C`) extracted from `MathKingdom.jsx`; both modes import it.
- `src/DungeonMode.jsx` — Tier 1 Stone Dungeon:
  - Turn loop per spec: PROBLEM (type answer) → DODGE (enemy always attacks; steer the
    soul with arrows/WASD in an arena box) → RESOLVE (correct answer = 1 hit on the
    enemy AFTER the dodge; wrong answer = attack fizzles, correct answer revealed).
  - **Non-bypassable math:** damage only ever comes from an exactly-correct answer.
  - 3 sections (Outer Halls / Cracked Depths / Golem's Throne), 4 standard enemies each,
    escalating multiplication factors, boss door (1 key) per section.
  - Bosses: Stone Sentinel, Rock Colossus, GOLEM (telegraphed fist-slam columns per the
    spec's boss-pattern table; standard enemies use generic falling rocks / side pebbles).
  - Key system: +25 charge per standard kill, +50 per boss, 100 charge = 1 key.
  - Badges per section cleared (session-only, drawn on the map + tier-clear screen).
  - Defeat: retry the same fight (full HP both sides) or flee to map; a spent boss-door
    key is NOT re-charged on retry (softlock prevention).

## Tuning defaults chosen this session (not user decisions — adjust freely in playtesting)

- Player HP 10; projectile hit = 2 damage; 1.0s invulnerability after a hit, 0.6s grace
  at dodge start; full heal at the start of every encounter.
- Dodge phase: 5.5s standard, 6.5–7s bosses. Soul speed 165 px/s in a 240×180 box.
- Enemy HP: 2 (section 1), 2–3 (section 2), 3 (section 3); bosses 4 / 4 / 6.
- Turn-result message shows for 2.1s, then auto-advances.

## Verification (2026-07-06)

Automated gate: `npm run lint` + `npm run build` green. End-to-end smoke run in Chromium
against `npm run dev` (driver steers the soul via a dev-only `window.__dd` state export,
which is compiled out of production builds):
- [x] Mode select boots; dungeon map shows Section 1/3.
- [x] Wrong answer → "attack fizzles", enemy HP unchanged (math non-bypassable).
- [x] Taking hits while answering wrong → player HP drains → DEFEAT screen; retry
      restarts the fight at full HP. (Note: passively standing still in Section 1
      rarely kills — rocks are sparse by design for the target age.)
- [x] Full Tier 1 autopilot: all 12 standard enemies + 3 bosses defeated, keys forged
      and spent on boss doors each section, 3 badges earned, TIER CLEAR reached
      (autopilot finished with zero mid-run deaths — Tier 1 difficulty is fair).
- [x] Golem fist-slam telegraphs + slams work and are dodgeable (autopilot exited
      telegraphed columns and beat the Golem without dying).
- [x] Replay resets to Section 1; ⬅ MENU returns to mode select; trebuchet mode still
      boots to Tier 1 · Level 1/3 (no regression).
- [x] Zero browser console errors across the run.

## Next steps (future sessions)

- Tier 2 (Fire / division) onward — the section/enemy config shape in `DungeonMode.jsx`
  (`TIER1`) is ready to become a `TIERS` array; problem generation needs a division mode.
- Tutorial + helper NPC (identity TBD — medium-priority open question in the spec).
- Supabase backend before: lifetime correct-answer count (Red Eye unlock), persistent
  keys/badges/section unlocks. **Blocked on revising the no-persistence rule in CLAUDE.md.**
- Remaining spec open questions: #5–#9 (enemy thematic attacks, revisit purpose, NPC).
