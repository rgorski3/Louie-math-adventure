# Math Kingdom — Alpha Build Plan

## Status
Alpha scope locked. Single-player, no backend, no accounts, no COPPA concerns. Static front-end only.

---

## Platform
| Decision | Choice | Rationale |
|---|---|---|
| Hosting | Vercel | Free tier, git-push deploy, upgrades cleanly to serverless when co-op is ready |
| Physics/rendering | Matter.js + Canvas 2D | Spec-mandated; hand-rolled kinematics for deterministic educational control |
| Backend | None (deferred) | Supabase ready to add when persistence or co-op is needed |
| Accounts | None | Deferred with backend |

---

## Core Mechanic (Alpha Scope)

### What the player does
1. Reads a multiplication/ratio problem in the dialogue box
2. Types the counterweight answer (e.g. `12 × 9 = 108`)
3. Adjusts an angle slider and watches the live trajectory trail update
4. Clicks **FIRE**

### What the math controls
- The **counterweight answer** sets launch velocity (`v0 = V0_OPT × efficiency`)
- The **angle slider** (15°–80°) sets the arc — no trig required from the player
- One skill tested: **multiplication / ratio**

### Why the math is non-bypassable
A wall obstacle sits between the trebuchet and target. Validated geometry:
- Correct counterweight + ~60° angle → arc clears wall, lands in target zone
- Wrong counterweight → arc hits wall at any angle (mathematically verified)
- Low flat angle → hits wall even with correct counterweight (forces arc discovery)

---

## Three-Tier Outcome System

| Tier | Trigger | Behaviour |
|---|---|---|
| **Success** | Lands within ±30px of target | Particle burst, "DIRECT HIT", Next Level button |
| **Marginal** | CW error ≤ 5%, near miss | Trajectory trail stays visible, "Check your math" feedback, Try Again |
| **Catastrophic** | CW error > 20% | Explosion particles at trebuchet, "STRUCTURAL FAILURE", 5-second flavour before retry |

**Known tension:** The catastrophic lockout sits in friction with the design doc's "soften difficulty" philosophy. Monitor in playtesting with real kids.

**Fix from spec:** Reference Python uses exact equality (`!=`) for counterweight check — fragile for typed input. Alpha uses tolerance-based comparison throughout.

---

## Level Geometry (Validated Physics)

| Parameter | Value | Notes |
|---|---|---|
| Canvas | 800 × 400 px | |
| Ground | y = 360 | |
| Launch point | (110, 205) | Arm tip at 90° (vertical), above pivot |
| Wall | x = 380, top y = 175 | 185px tall; blocks wrong-velocity shots |
| Target | x = 680, radius ±30px | On ground |
| V0 optimal | 450 px/s | With correct counterweight |
| Gravity | 360 px/s² | Tuned for canvas scale |
| Optimal angle | ~60° | Discoverable via slider + trail |

---

## Graphic Theme

**Inspiration:** Undertale — pixel art, dark palette, expressive dialogue boxes, lo-fi simplicity

### Colour Palette
| Role | Hex | Use |
|---|---|---|
| Sky top | `#0d1b2a` | Deep navy — warm dark, not cold black |
| Sky bottom | `#1a3050` | Mid navy |
| Ground | `#3d2b1f` | Warm earthy brown |
| Wall | `#6b5840` | Stone with warm undertone |
| Trebuchet wood | `#8b5e3c` | Warm timber |
| UI gold | `#e8a020` | Dialogue box borders, labels, accents |
| Trail | `#f5a623` | Projectile trajectory dots — soft orange |
| Success burst | `#f0d060` | Warm gold sparks |
| Catastrophic | `#ff6a00` | Hot orange explosion |

### UI Style
- Black-fill dialogue box, off-white/cream (`#f5e6c8`) 4px border — Undertale signature
- `Courier New` / monospace throughout
- No border-radius anywhere
- Pixel-snapped canvas rendering (`imageSmoothingEnabled = false`)

### Pixel Art Approach
- All canvas drawing uses integer-snapped coordinates
- Stars rendered as 2–3px pixel squares at varying opacity
- Wall uses hand-drawn brick pattern with mortar lines
- Trebuchet drawn with chunky rectangles and a 7px arm line

---

## Game Flow

```
PROBLEM phase
  └─ Dialogue shows math problem
  └─ Player types counterweight answer
  └─ Clicks SET WEIGHT ▶

AIM phase
  └─ Live trajectory preview updates as slider moves
  └─ Player adjusts angle (15°–80°)
  └─ Clicks 🔥 FIRE!

FIRING phase
  └─ Trebuchet arm animates (loaded → fired, 140° sweep)
  └─ Projectile follows pre-computed trajectory
  └─ Trail rendered behind projectile
  └─ [if catastrophic: explosion particles, no projectile]

RESULT phase
  └─ HIT → success particles, "NEXT LEVEL ▶"
  └─ MISS/WALL → feedback text, "↺ TRY AGAIN" + "✎ FIX MATH"
  └─ CATASTROPHIC → failure message, "↺ REBUILD" + "✎ FIX MATH"
```

---

## Known Open Questions (Post-Alpha)
- **Failure tone:** Slapstick vs. consequential — not yet resolved; alpha defaults to slapstick explosion
- **Difficulty scaling:** Fixed level geometry in alpha; dynamic placement planned for future levels
- **Hint system:** Design doc specifies currency-costed hints; not in alpha scope
- **Co-op boss HP:** Deferred with Supabase backend
- **COPPA:** Not relevant until social/accounts features are added

---

## Tech Debt to Carry Forward
1. Matter.js proper integration (alpha uses hand-rolled kinematics)
2. Three-tier validation needs real tolerance range in production (currently `|error| / correct > threshold`)
3. Level geometry hardcoded — needs a level configuration system for progression
4. No save state — session resets on reload
