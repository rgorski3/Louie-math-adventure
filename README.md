# Math Kingdom — Alpha

A browser-based educational game teaching multiplication via trebuchet physics.

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
| `src/MathKingdom.jsx` | Main game component — all physics, drawing, UI |
| `src/App.jsx` | Root wrapper |
| `vercel.json` | Vercel build + SPA routing config |

## Design doc
See `Math_Kingdom_Alpha_Plan.md` in the project root for full design decisions,
level geometry, three-tier outcome spec, and known open questions.
