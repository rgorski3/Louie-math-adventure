# Math Kingdom — Alpha

A browser-based educational game teaching multiplication. Three sections behind a
kingdom hub: **Battle** (dungeon math combat with Undertale-style dodging),
**Build** (earn materials with math and construct your castle), and **Siege**
(trebuchet physics puzzle).

## Stack
- **React + Vite** — front-end only, no backend
- **Canvas 2D** — hand-rolled kinematics (Matter.js integration planned)
- **Vercel** — static hosting

## Local dev
```bash
npm install
npm run dev
```

## Deploy to Vercel
1. Push this repo to GitHub
2. Go to vercel.com → New Project → Import your repo
3. Vercel auto-detects Vite — just click Deploy

That's it. `vercel.json` handles the rest.

## Project files
| File | Purpose |
|---|---|
| `src/MathKingdom.jsx` | Kingdom hub — section select + shared material economy |
| `src/game/shared.js` | Palette, canvas constants, pixel-art + particle helpers |
| `src/game/BattleMode.jsx` | Battle section — Stone Dungeon combat |
| `src/game/BuildMode.jsx` | Build section — castle & defense construction |
| `src/game/TrebuchetMode.jsx` | Siege section — trebuchet physics puzzle |
| `src/App.jsx` | Root wrapper |
| `vercel.json` | Vercel build + SPA routing config |

## Design docs
See `Game_Structure_Redesign_Plan.md` for the current three-section structure,
`Math_Kingdom_Alpha_Plan.md` for the trebuchet design (level geometry, three-tier
outcome spec), and `Dungeon_Progression_Specification.md` for the battle roadmap.
