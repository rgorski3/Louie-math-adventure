// ──────────────────────────────────────────────
// SHARED — canvas constants, palette, pixel-art helpers, particles,
// problem generation, and UI style factories used by all three game
// sections (Battle / Build / Siege) and the hub.
// ──────────────────────────────────────────────
export const GW = 800, GH = 400;
export const GROUND_Y = 360;

// Undertale-inspired palette: dark navy / warm earth (see CLAUDE.md)
export const C = {
  skyTop:'#0d1b2a', skyBot:'#1a3050',
  ground:'#3d2b1f', groundTx:'#4a3525',
  wall:'#6b5840',   wallDk:'#4a3d2f', wallLt:'#8d7260',
  wood:'#8b5e3c',   woodDk:'#5c3a1e', metal:'#b89040',
  tR:'#cc3030',     tG:'#e8b828',
  dot:'#f5a623',
  proj:'#f0d060',   projE:'#c8a020',
  star:'#f0e6c8',
  dlgBg:'#000',     dlgBdr:'#f5e6c8',
  gold:'#e8a020',   white:'#ffffff',
  orange:'#ff6a00', red:'#cc2020', green:'#40d060',
};

// Deterministic stars (no random per render)
export const STARS = Array.from({ length: 55 }, (_, i) => ({
  x:  (i * 137.508 + 15) % GW,
  y:  Math.abs(Math.sin(i * 1.93)) * GROUND_Y * 0.82,
  sz: i % 7 === 0 ? 3 : 2,
  a:  0.3 + (i % 4) * 0.18,
}));

export function drawStars(ctx) {
  for (const s of STARS) {
    ctx.globalAlpha = s.a;
    ctx.fillStyle = C.star;
    ctx.fillRect(~~s.x, ~~s.y, s.sz, s.sz);
  }
  ctx.globalAlpha = 1;
}

// Pixel-art heart (Undertale SOUL), built from a fixed bitmap so it stays
// sharp at any scale — no strokes/arcs, matches the blocky art style.
export const HEART_BMP = [
  ' ## ## ',
  '#######',
  '#######',
  '#######',
  ' ##### ',
  '  ###  ',
  '   #   ',
];
export function drawHeart(ctx, cx, cy, scale, color) {
  const rows = HEART_BMP.length, cols = HEART_BMP[0].length;
  ctx.fillStyle = color;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (HEART_BMP[r][c] !== '#') continue;
      ctx.fillRect(
        ~~(cx - (cols * scale) / 2 + c * scale),
        ~~(cy - (rows * scale) / 2 + r * scale),
        scale, scale
      );
    }
  }
}

export function drawHpHud(ctx, hp, maxHp) {
  const s = 3, gap = 6, w = maxHp * (s * 7 + gap) - gap;
  const x0 = GW - w - 14, y0 = 22;
  ctx.font = 'bold 10px "Courier New",monospace';
  ctx.fillStyle = C.gold;
  ctx.fillText('HP', x0 - 22, y0 + 6);
  for (let i = 0; i < maxHp; i++) {
    const cx = x0 + i * (s * 7 + gap) + (s * 7) / 2;
    drawHeart(ctx, cx, y0, s, i < hp ? C.red : '#2a2a2a');
  }
}

// ── Particles ───────────────────────────────
export function mkParticles(x, y, { n = 20, colors = [C.gold], vx = 220, vyMin = 60, vyMax = 300, size = 10 }) {
  return Array.from({ length: n }, (_, i) => ({
    x, y,
    vx: (Math.random() - 0.5) * vx,
    vy: -vyMin - Math.random() * (vyMax - vyMin),
    color: colors[i % colors.length],
    life: 1, size: 3 + Math.random() * size,
  }));
}

// Advance + cull one frame of particles; returns the surviving array.
export function stepParticles(ps, dt) {
  for (const p of ps) {
    p.x += p.vx * dt; p.y += p.vy * dt;
    p.vy += 290 * dt; p.life -= dt * 1.9;
  }
  return ps.filter(p => p.life > 0);
}

export function renderParticles(ctx, ps) {
  for (const p of ps) {
    if (p.life <= 0) continue;
    ctx.globalAlpha = Math.max(0, p.life);
    ctx.fillStyle = p.color;
    const s = Math.max(1, ~~p.size);
    ctx.fillRect(~~p.x - ~~(s / 2), ~~p.y - ~~(s / 2), s, s);
  }
  ctx.globalAlpha = 1;
}

// ── Math problems ───────────────────────────
export const randInt = (min, max) => min + ~~(Math.random() * (max - min + 1));

// Multiplication problem with factors drawn from inclusive ranges.
export function mulProblem(aMin, aMax, bMin, bMax) {
  const a = randInt(aMin, aMax);
  const b = randInt(bMin, bMax);
  return { a, b, ans: a * b };
}

// ── Shared UI styles (Undertale dialogue box + buttons) ──
export const dlgStyle = {
  background: C.dlgBg,
  border: `4px solid ${C.dlgBdr}`,
  width: GW, maxWidth: '100%',
  padding: '14px 22px', minHeight: 90,
  fontFamily: '"Courier New", monospace',
  color: C.white, boxSizing: 'border-box',
};

export const btnStyle = (col, filled) => ({
  background: filled ? col : 'transparent',
  border: `2px solid ${col}`, color: filled ? '#000' : col,
  fontFamily: '"Courier New", monospace', fontWeight: 'bold',
  fontSize: 13, padding: '5px 15px', cursor: 'pointer', letterSpacing: 1,
});

export const inputStyle = {
  background: '#111', border: `2px solid ${C.gold}`,
  color: C.gold, fontFamily: '"Courier New", monospace',
  fontSize: 20, padding: '3px 10px', width: 95, outline: 'none',
};
