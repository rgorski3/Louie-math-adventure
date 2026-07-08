import { useState, useEffect, useRef, useCallback } from "react";

// ──────────────────────────────────────────────
// CONSTANTS
// ──────────────────────────────────────────────
const GW = 800, GH = 400;
const GROUND_Y   = 360;

// Trebuchet geometry
const PIVOT_X    = 110, PIVOT_Y = 300;
const LONG_ARM   = 95,  SHORT_ARM = 38;
const LOADED_DEG = 330; // long arm: lower-right (counterweight raised upper-left)
const TOTAL_ROT  = 140; // CCW degrees traversed
// Arm at 90° (straight up) = launch point. Occurs at progress = 120/140
const LAUNCH_P   = 120 / 140;
const LAUNCH_X   = PIVOT_X;           // arm at 90°: tip directly above pivot
const LAUNCH_Y   = PIVOT_Y - LONG_ARM; // = 205

// Physics (hand-rolled kinematics, pixel-space)
const V0_OPT     = 450;  // px/s — correct counterweight gives this
const GRAV       = 360;  // px/s²

// ──────────────────────────────────────────────
// UNDERTALE-STYLE DODGE BATTLE BOX
// After every non-catastrophic shot the target/boss counterattacks: a
// bullet-hell box opens and the player must steer a heart soul clear of
// falling rubble (regular levels) or telegraphed slam columns (boss).
// ──────────────────────────────────────────────
const BOX = { x: 220, y: 82, w: 360, h: 210 };
const HEART_R      = 7;    // collision + draw half-size
const HEART_SPEED   = 210; // px/s
const PLAYER_MAX_HP = 3;
const INVULN_MS     = 700;
const DODGE_BASE_MS = 3400;
const ROCK_R        = 8;

// ──────────────────────────────────────────────
// LEVEL CONFIG — dungeon tiers + boss
// Every geometry here was validated against calcTraj/checkTraj: the correct
// answer (v0 = 450) has a contiguous band of ≥4 integer slider angles that
// clear the wall and land in the target zone, and flat angles hit the wall
// (arc discovery). Do not change numbers without re-running that validation.
//   T1-L1 hit band 58°–61° · T1-L2 56°–60° · T1-L3 56°–59°
//   T2-L1 55°–58° · T2-L2 54°–57° · T2-L3 53°–56° · BOSS 51°–55°
// ──────────────────────────────────────────────
const BOSS_NAME = 'THE WALL WARDEN';
const LEVELS = [
  { tier: 1, lvl: 1, wallX: 380, wallTop: 175, wallW: 28, targetX: 680, targetR: 30,
    probs: { mps: [3, 4, 5],      rs: [4, 5, 6] } },
  { tier: 1, lvl: 2, wallX: 380, wallTop: 165, wallW: 28, targetX: 695, targetR: 27,
    probs: { mps: [4, 5, 6],      rs: [6, 7, 8] } },
  { tier: 1, lvl: 3, wallX: 400, wallTop: 158, wallW: 28, targetX: 705, targetR: 25,
    probs: { mps: [6, 7, 8],      rs: [6, 7, 8] } },
  { tier: 2, lvl: 1, wallX: 410, wallTop: 150, wallW: 30, targetX: 715, targetR: 23,
    probs: { mps: [6, 8, 9],      rs: [7, 8, 9] } },
  { tier: 2, lvl: 2, wallX: 420, wallTop: 142, wallW: 30, targetX: 725, targetR: 21,
    probs: { mps: [7, 8, 9, 12],  rs: [8, 9, 11] } },
  { tier: 2, lvl: 3, wallX: 430, wallTop: 135, wallW: 32, targetX: 735, targetR: 19,
    probs: { mps: [9, 11, 12],    rs: [8, 11, 12] } },
  { boss: true, hp: 3, wallX: 450, wallTop: 128, wallW: 32, targetX: 745, targetR: 24,
    // Per-hit escalation: index = hits already landed (0, 1, 2)
    hitProbs: [
      { mps: [11, 12, 13], rs: [9, 11, 12] },
      { mps: [12, 13, 14], rs: [11, 12, 13] },
      { mps: [13, 14, 15], rs: [12, 13, 14] },
    ] },
];
const BOSS_IDX = LEVELS.length - 1;
const LVLS_PER_TIER = 3;

// Colours
const C = {
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
const STARS = Array.from({ length: 55 }, (_, i) => ({
  x:  (i * 137.508 + 15) % GW,
  y:  Math.abs(Math.sin(i * 1.93)) * GROUND_Y * 0.82,
  sz: i % 7 === 0 ? 3 : 2,
  a:  0.3 + (i % 4) * 0.18,
}));

// Distant background castle silhouette (deterministic, purely decorative)
const CASTLE_SIL = [
  { x: 40,  w: 22, h: 60 }, { x: 62,  w: 10, h: 40 },
  { x: 90,  w: 30, h: 78 }, { x: 120, w: 10, h: 46 },
  { x: 150, w: 18, h: 54 }, { x: 600, w: 20, h: 50 },
  { x: 630, w: 34, h: 84 }, { x: 664, w: 12, h: 48 },
  { x: 700, w: 22, h: 62 }, { x: 726, w: 12, h: 40 },
];

// ──────────────────────────────────────────────
// PHYSICS
// ──────────────────────────────────────────────
function cwError(cw, correct) {
  if (!cw || cw <= 0) return Infinity;
  return Math.abs(cw - correct) / correct;
}
function v0From(cw, correct) {
  if (cwError(cw, correct) > 0.20) return null;
  return V0_OPT * Math.min(cw / correct, 1.2);
}
function calcTraj(v0, deg) {
  const a  = deg * Math.PI / 180;
  const vx = v0 * Math.cos(a);
  const vy = v0 * Math.sin(a);
  const pts = [];
  for (let t = 0; t < 8; t += 1 / 60) {
    const x = LAUNCH_X + vx * t;
    const y = LAUNCH_Y - vy * t + 0.5 * GRAV * t * t;
    pts.push({ x, y });
    if (y > GROUND_Y + 20 || x > GW + 80) break;
  }
  return pts;
}
function checkTraj(pts, level) {
  for (let i = 1; i < pts.length; i++) {
    const { x, y } = pts[i], pp = pts[i - 1];
    if (x >= level.wallX - level.wallW / 2 - 3 && x <= level.wallX + level.wallW / 2 + 3 && y >= level.wallTop)
      return { type: 'WALL' };
    if (y >= GROUND_Y && pp.y < GROUND_Y) {
      const f  = (GROUND_Y - pp.y) / (y - pp.y);
      const lx = pp.x + f * (x - pp.x);
      return { type: Math.abs(lx - level.targetX) <= level.targetR ? 'HIT' : 'MISS', lx };
    }
  }
  return { type: 'MISS', lx: pts.at(-1)?.x ?? GW };
}

// ──────────────────────────────────────────────
// DRAWING
// ──────────────────────────────────────────────
function drawBg(ctx) {
  const g = ctx.createLinearGradient(0, 0, 0, GROUND_Y);
  g.addColorStop(0, C.skyTop); g.addColorStop(1, C.skyBot);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, GW, GROUND_Y);
  for (const s of STARS) {
    ctx.globalAlpha = s.a;
    ctx.fillStyle = C.star;
    ctx.fillRect(~~s.x, ~~s.y, s.sz, s.sz);
  }
  ctx.globalAlpha = 1;
  // Distant castle silhouette for background depth
  ctx.fillStyle = '#142338';
  for (const t of CASTLE_SIL) {
    ctx.fillRect(t.x, GROUND_Y - t.h, t.w, t.h);
    ctx.fillRect(t.x - 2, GROUND_Y - t.h - 6, 4, 6);
    ctx.fillRect(t.x + t.w - 2, GROUND_Y - t.h - 6, 4, 6);
  }
  ctx.fillStyle = C.ground;  ctx.fillRect(0, GROUND_Y, GW, GH - GROUND_Y);
  ctx.fillStyle = C.groundTx; ctx.fillRect(0, GROUND_Y, GW, 4);
  ctx.fillStyle = C.groundTx;
  for (let x = 0; x < GW; x += 44) {
    ctx.fillRect(x, GROUND_Y + 10, 26, 2);
    ctx.fillRect(x + 22, GROUND_Y + 22, 18, 2);
  }
}

function drawWall(ctx, level, ts = 0) {
  const wx = ~~(level.wallX - level.wallW / 2);
  const wh = GROUND_Y - level.wallTop;
  ctx.fillStyle = C.wall; ctx.fillRect(wx, ~~level.wallTop, level.wallW, wh);
  for (let row = 0; row * 16 < wh; row++) {
    const ry  = ~~(level.wallTop + row * 16);
    const off = (row % 2) * 10;
    ctx.fillStyle = C.wallDk;
    ctx.fillRect(wx, ry, level.wallW, 2);
    ctx.fillRect(wx + off + 5, ry + 2, 2, 14);
  }
  ctx.fillStyle = C.wallLt; ctx.fillRect(wx, ~~level.wallTop, 3, wh);
  for (let i = 0; i < 2; i++) {
    ctx.fillStyle = C.wall;   ctx.fillRect(wx + i * 13, ~~level.wallTop - 14, 10, 14);
    ctx.fillStyle = C.wallDk; ctx.fillRect(wx + i * 13, ~~level.wallTop - 14, 10, 2);
  }
  // Flickering torch bracketed to the wall (purely decorative)
  const tox = wx - 14, toy = ~~level.wallTop + 20;
  ctx.fillStyle = C.woodDk; ctx.fillRect(tox, toy, 4, 16);
  ctx.fillStyle = C.metal;  ctx.fillRect(tox - 2, toy - 3, 8, 4);
  const flick = 0.7 + 0.3 * Math.abs(Math.sin(ts / 130));
  ctx.globalAlpha = flick;
  ctx.fillStyle = C.orange; ctx.fillRect(tox - 3, toy - 12, 10, 10);
  ctx.fillStyle = C.gold;   ctx.fillRect(tox - 1, toy - 9, 6, 6);
  ctx.globalAlpha = 1;
}

function drawTarget(ctx, level, hit) {
  const tx = ~~level.targetX;
  const rOut = level.targetR - 4; // visual size tracks the hitbox
  ctx.fillStyle = C.woodDk;
  ctx.fillRect(tx - 2, GROUND_Y - 54, 4, 54);
  const rings = [
    { r: rOut,             c: C.tR },
    { r: ~~(rOut * 0.66),  c: C.tG },
    { r: ~~(rOut * 0.4),   c: C.tR },
    { r: 3,                c: hit ? '#fff' : C.tG },
  ];
  for (const { r, c } of rings) {
    ctx.fillStyle = c;
    ctx.fillRect(tx - r, GROUND_Y - 52 - r, r * 2, r * 2);
  }
  if (hit) {
    ctx.globalAlpha = 0.22;
    ctx.fillStyle = C.gold;
    ctx.fillRect(tx - 42, GROUND_Y - 100, 84, 78);
    ctx.globalAlpha = 1;
  }
}

function drawBoss(ctx, level, hp) {
  const bx = ~~level.targetX, by = GROUND_Y;
  if (hp <= 0) {
    // Crumbled rubble + victory glow
    ctx.fillStyle = C.wallDk; ctx.fillRect(bx - 26, by - 14, 52, 14);
    ctx.fillStyle = C.wall;   ctx.fillRect(bx - 16, by - 24, 30, 10);
    ctx.fillStyle = C.wall;   ctx.fillRect(bx - 32, by - 8,  14, 8);
    ctx.fillStyle = C.wallLt; ctx.fillRect(bx + 4,  by - 20, 6, 6);
    ctx.globalAlpha = 0.22;
    ctx.fillStyle = C.gold;
    ctx.fillRect(bx - 42, by - 74, 84, 66);
    ctx.globalAlpha = 1;
  } else {
    // Stone golem body
    ctx.fillStyle = C.wall;   ctx.fillRect(bx - 24, by - 56, 48, 56);
    ctx.fillStyle = C.wallDk; ctx.fillRect(bx - 24, by - 56, 48, 4);
    ctx.fillStyle = C.wallLt; ctx.fillRect(bx - 24, by - 56, 4, 56);
    // Shoulders
    ctx.fillStyle = C.wallDk;
    ctx.fillRect(bx - 34, by - 48, 10, 30);
    ctx.fillRect(bx + 24, by - 48, 10, 30);
    // Eyes + mouth
    ctx.fillStyle = C.red;
    ctx.fillRect(bx - 14, by - 44, 8, 8);
    ctx.fillRect(bx + 6,  by - 44, 8, 8);
    ctx.fillStyle = '#000';
    ctx.fillRect(bx - 10, by - 26, 20, 5);
    // Damage cracks appear as HP drops
    const dmg = level.hp - hp;
    ctx.fillStyle = C.wallDk;
    if (dmg >= 1) { ctx.fillRect(bx - 20, by - 52, 3, 14); ctx.fillRect(bx - 18, by - 40, 3, 8); }
    if (dmg >= 2) { ctx.fillRect(bx + 12, by - 30, 3, 16); ctx.fillRect(bx + 8,  by - 16, 3, 8); }
  }
  // HP pips (segmented squares, cream border, red fill → dark when spent)
  const pipW = 14, gap = 6;
  const total = level.hp;
  const w  = total * pipW + (total - 1) * gap;
  const x0 = ~~(bx - w / 2), y0 = by - 96;
  ctx.font = 'bold 10px "Courier New",monospace';
  ctx.fillStyle = C.gold;
  ctx.fillText('BOSS', ~~(bx - 12), y0 - 6);
  for (let i = 0; i < total; i++) {
    const px = x0 + i * (pipW + gap);
    ctx.fillStyle = C.dlgBdr;
    ctx.fillRect(px - 2, y0 - 2, pipW + 4, pipW + 4);
    ctx.fillStyle = i < hp ? C.red : '#181818';
    ctx.fillRect(px, y0, pipW, pipW);
  }
}

function drawTrebuchet(ctx, prog) {
  const px = PIVOT_X, py = PIVOT_Y;

  // Base + wheels
  ctx.fillStyle = C.woodDk; ctx.fillRect(px - 48, GROUND_Y - 13, 96, 13);
  for (const wx of [px - 44, px + 30]) {
    ctx.fillStyle = '#2e1a0a'; ctx.fillRect(wx, GROUND_Y - 11, 14, 11);
    ctx.fillStyle = C.metal;   ctx.fillRect(wx + 3, GROUND_Y - 7, 8, 3);
  }
  // Legs + brace
  ctx.fillStyle = C.wood;
  ctx.fillRect(px - 30, py, 8, GROUND_Y - py - 13);
  ctx.fillRect(px + 22, py, 8, GROUND_Y - py - 13);
  ctx.fillRect(px - 24, py + 32, 48, 7);
  // Pivot block
  ctx.fillStyle = C.metal; ctx.fillRect(px - 7, py - 7, 14, 14);

  // Arm
  const armRad = (LOADED_DEG + TOTAL_ROT * prog) * Math.PI / 180;
  const lx = ~~(px + LONG_ARM  * Math.cos(armRad));
  const ly = ~~(py - LONG_ARM  * Math.sin(armRad));
  const sx = ~~(px - SHORT_ARM * Math.cos(armRad));
  const sy = ~~(py + SHORT_ARM * Math.sin(armRad));

  ctx.strokeStyle = C.wood; ctx.lineWidth = 7; ctx.lineCap = 'square';
  ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(lx, ly); ctx.stroke();
  ctx.strokeStyle = C.woodDk; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(sx + 1, sy + 1); ctx.lineTo(lx + 1, ly + 1); ctx.stroke();

  // Counterweight box
  ctx.fillStyle = C.woodDk; ctx.fillRect(sx - 12, sy - 2, 24, 19);
  ctx.fillStyle = C.metal;  ctx.fillRect(sx -  9, sy + 2, 18,  5);

  // Sling rope fades out during fire
  const sa = Math.max(0, 1 - prog * 2.2);
  if (sa > 0.02) {
    ctx.globalAlpha = sa;
    ctx.strokeStyle = '#c0a060'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(lx, ly); ctx.lineTo(lx + 10, ly + 22); ctx.stroke();
    ctx.globalAlpha = 1;
  }
}

function drawTrail(ctx, pts, upTo, preview) {
  const lim = upTo !== undefined ? Math.min(upTo + 1, pts.length) : pts.length;
  for (let i = 0; i < lim; i += 4) {
    const { x, y } = pts[i];
    if (x < 0 || x > GW || y > GROUND_Y) break;
    ctx.globalAlpha = preview
      ? 0.40
      : Math.max(0.15, 0.78 - (i / Math.max(lim, 1)) * 0.62);
    ctx.fillStyle = C.dot;
    ctx.fillRect(~~x - 2, ~~y - 2, 4, 4);
  }
  ctx.globalAlpha = 1;
}

function drawProjectile(ctx, x, y) {
  ctx.fillStyle = C.projE; ctx.fillRect(~~x - 8, ~~y - 8, 16, 16);
  ctx.fillStyle = C.proj;  ctx.fillRect(~~x - 5, ~~y - 5, 10, 10);
  ctx.globalAlpha = 0.5; ctx.fillStyle = '#fff';
  ctx.fillRect(~~x - 4, ~~y - 4, 3, 3);
  ctx.globalAlpha = 1;
}

function renderParticles(ctx, ps) {
  for (const p of ps) {
    if (p.life <= 0) continue;
    ctx.globalAlpha = Math.max(0, p.life);
    ctx.fillStyle = p.color;
    const s = Math.max(1, ~~p.size);
    ctx.fillRect(~~p.x - ~~(s / 2), ~~p.y - ~~(s / 2), s, s);
  }
  ctx.globalAlpha = 1;
}

// Pixel-art heart (Undertale SOUL), built from a fixed bitmap so it stays
// sharp at any scale — no strokes/arcs, matches the blocky art style.
const HEART_BMP = [
  ' ## ## ',
  '#######',
  '#######',
  '#######',
  ' ##### ',
  '  ###  ',
  '   #   ',
];
function drawHeart(ctx, cx, cy, scale, color) {
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

function drawHpHud(ctx, hp, maxHp) {
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

// ── Undertale-style dodge battle box ────────────
function drawDodgeBox(ctx, box, heart, rocks, invuln, hp) {
  ctx.fillStyle = '#000';
  ctx.fillRect(box.x, box.y, box.w, box.h);
  ctx.strokeStyle = C.white; ctx.lineWidth = 3;
  ctx.strokeRect(box.x + 1.5, box.y + 1.5, box.w - 3, box.h - 3);

  for (const r of rocks) {
    if (r.type === 'slam') {
      if (r.telegraph > 0) {
        ctx.globalAlpha = 0.35 + 0.25 * Math.sin(r.telegraph * 0.03);
        ctx.fillStyle = C.red;
        ctx.fillRect(~~(r.x - r.w / 2), box.y + 2, r.w, box.h - 4);
        ctx.globalAlpha = 1;
      } else {
        ctx.fillStyle = C.wallDk;
        ctx.fillRect(~~(r.x - r.w / 2), box.y + 2, r.w, box.h - 4);
        ctx.fillStyle = C.wallLt;
        ctx.fillRect(~~(r.x - r.w / 2), box.y + 2, r.w, 4);
      }
    } else {
      ctx.fillStyle = C.wallDk;
      ctx.fillRect(~~(r.x - ROCK_R), ~~(r.y - ROCK_R), ROCK_R * 2, ROCK_R * 2);
      ctx.fillStyle = C.wallLt;
      ctx.fillRect(~~(r.x - ROCK_R), ~~(r.y - ROCK_R), ROCK_R * 2, 3);
    }
  }

  if (invuln <= 0 || Math.floor(invuln / 90) % 2 === 0) {
    drawHeart(ctx, heart.x, heart.y, 3, hp > 0 ? C.red : '#555');
  }

  ctx.font = 'bold 11px "Courier New",monospace';
  ctx.fillStyle = C.orange;
  ctx.fillText('⚠ DODGE! ⚠', box.x + box.w / 2 - 38, box.y - 10);
  ctx.font = 'bold 9px "Courier New",monospace';
  ctx.fillStyle = '#888';
  ctx.fillText('ARROWS / WASD', box.x + box.w / 2 - 42, box.y + box.h + 16);
}

function drawLabels(ctx, level) {
  ctx.font = 'bold 10px "Courier New",monospace';
  ctx.fillStyle = C.gold;
  ctx.fillText('TREBUCHET',   PIVOT_X - 34,       GH - 7);
  ctx.fillText('CASTLE WALL', level.wallX - 36,   level.wallTop - 18);
  if (!level.boss) {
    ctx.fillText('TARGET', level.targetX - 20, GROUND_Y - 66);
  }
  // HUD: tier/level progress (top-left)
  ctx.font = 'bold 11px "Courier New",monospace';
  ctx.fillText(
    level.boss
      ? `☠ BOSS — ${BOSS_NAME}`
      : `TIER ${level.tier} · LEVEL ${level.lvl}/${LVLS_PER_TIER}`,
    10, 16
  );
}

// ──────────────────────────────────────────────
// PARTICLES
// ──────────────────────────────────────────────
const mkExplosion = (x, y) =>
  Array.from({ length: 24 }, (_, i) => ({
    x, y,
    vx: (Math.random() - 0.5) * 240,
    vy: -60 - Math.random() * 270,
    color: [C.red, C.orange, '#ff8c00'][i % 3],
    life: 1, size: 5 + Math.random() * 10,
  }));

const mkSuccess = (x, y) =>
  Array.from({ length: 28 }, (_, i) => ({
    x, y: y - 25,
    vx: (Math.random() - 0.5) * 210,
    vy: -90 - Math.random() * 240,
    color: i % 2 === 0 ? C.gold : C.proj,
    life: 1, size: 4 + Math.random() * 8,
  }));

const mkDeflect = (x, y) =>
  Array.from({ length: 14 }, (_, i) => ({
    x, y: y - 20,
    vx: (Math.random() - 0.5) * 190,
    vy: -40 - Math.random() * 160,
    color: i % 2 === 0 ? '#9aa0a8' : C.star,
    life: 1, size: 3 + Math.random() * 5,
  }));

const mkHitSpark = (x, y) =>
  Array.from({ length: 10 }, (_, i) => ({
    x, y,
    vx: (Math.random() - 0.5) * 160,
    vy: (Math.random() - 0.5) * 160,
    color: i % 2 === 0 ? C.red : '#fff',
    life: 1, size: 3 + Math.random() * 4,
  }));

// ──────────────────────────────────────────────
// DODGE BOX SIMULATION — advances one frame of the bullet-hell dodge
// segment. Boss fights get slow, wide, telegraphed "fist slam" columns
// (per Dungeon_Progression_Specification's Golem attack pattern); regular
// levels get simple falling rubble. Mutates `rocks` in place; returns
// whether the heart was hit this frame.
// ──────────────────────────────────────────────
function spawnRock(box, isBoss) {
  if (isBoss) {
    const w = 60 + Math.random() * 30;
    const x = box.x + w / 2 + Math.random() * (box.w - w);
    return { type: 'slam', x, w, telegraph: 550 };
  }
  const x = box.x + ROCK_R + Math.random() * (box.w - ROCK_R * 2);
  return { type: 'rock', x, y: box.y - ROCK_R, vy: 130 + Math.random() * 70 };
}

function stepDodge(box, heart, rocks, dt) {
  let hit = false;
  for (let i = rocks.length - 1; i >= 0; i--) {
    const r = rocks[i];
    if (r.type === 'slam') {
      r.telegraph -= dt * 1000;
      if (r.telegraph <= 0) {
        r.activeMs = (r.activeMs ?? 0) + dt * 1000;
        if (Math.abs(heart.x - r.x) <= r.w / 2 + HEART_R) hit = true;
        if (r.activeMs > 220) rocks.splice(i, 1);
      }
    } else {
      r.y += r.vy * dt;
      const dx = heart.x - r.x, dy = heart.y - r.y;
      if (dx * dx + dy * dy <= (ROCK_R + HEART_R) ** 2) hit = true;
      if (r.y - ROCK_R > box.y + box.h) rocks.splice(i, 1);
    }
  }
  return hit;
}

// ──────────────────────────────────────────────
// MATH PROBLEMS — factor sets come from the level config
// ──────────────────────────────────────────────
function newProb(level, hitsLanded = 0) {
  const set = level.boss
    ? level.hitProbs[Math.min(hitsLanded, level.hitProbs.length - 1)]
    : level.probs;
  const mp = set.mps[~~(Math.random() * set.mps.length)];
  const r  = set.rs [~~(Math.random() * set.rs.length)];
  return { mp, r, ans: mp * r };
}

// ──────────────────────────────────────────────
// COMPONENT
// ──────────────────────────────────────────────
export default function MathKingdom() {
  const cvsRef   = useRef(null);
  const rafRef   = useRef(null);
  const tsRef    = useRef(null);
  const toRef    = useRef(null);

  // All mutable game state lives in refs (animation loop reads them sync)
  const phaseRef    = useRef('PROBLEM');
  const probRef     = useRef(null);
  const cwRef       = useRef('');
  const angleRef    = useRef(55);
  const trajRef     = useRef([]);
  const armPRef     = useRef(0);
  const projIRef    = useRef(0);
  const ptclsRef    = useRef([]);
  const outcomeRef  = useRef(null);
  const levelIdxRef = useRef(0);
  const bossHpRef   = useRef(LEVELS[BOSS_IDX].hp);

  // Dodge battle box state (Undertale-style counterattack after every shot)
  const playerHpRef   = useRef(PLAYER_MAX_HP);
  const heartRef       = useRef({ x: BOX.x + BOX.w / 2, y: BOX.y + BOX.h / 2 });
  const rocksRef       = useRef([]);
  const keysRef        = useRef({});
  const dodgeSpawnRef  = useRef(0);
  const dodgeElapsedRef = useRef(0);
  const invulnRef      = useRef(0);
  const pendingResultRef = useRef(null);
  const shakeRef       = useRef({ timer: 0, mag: 0 });

  // React state drives UI re-renders only
  const [phase,    setPhase]    = useState('PROBLEM');
  const [prob,     setProb]     = useState(() => newProb(LEVELS[0]));
  const [cw,       setCw]       = useState('');
  const [angle,    setAngle]    = useState(55);
  const [result,   setResult]   = useState(null);
  const [outcome,  setOutcome]  = useState(null);
  const [levelIdx, setLevelIdx] = useState(0);
  const [bossHp,   setBossHp]   = useState(LEVELS[BOSS_IDX].hp);
  const [playerHp, setPlayerHp] = useState(PLAYER_MAX_HP);

  // Keep refs (read by the animation loop) and state (read by JSX) in sync
  const setOutcomeBoth = useCallback(v => {
    outcomeRef.current = v;
    setOutcome(v);
  }, []);
  const setBossHpBoth = useCallback(v => {
    bossHpRef.current = v;
    setBossHp(v);
  }, []);
  const setPlayerHpBoth = useCallback(v => {
    playerHpRef.current = v;
    setPlayerHp(v);
  }, []);

  // ── Animation loop ──────────────────────────
  useEffect(() => {
    const canvas = cvsRef.current;
    const ctx    = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;

    function loop(ts) {
      const dt = Math.min((ts - (tsRef.current ?? ts)) / 1000, 0.05);
      tsRef.current = ts;
      const ph  = phaseRef.current;
      const lvl = LEVELS[levelIdxRef.current];

      // Update particles
      for (const p of ptclsRef.current) {
        p.x += p.vx * dt; p.y += p.vy * dt;
        p.vy += 290 * dt; p.life -= dt * 1.9;
      }
      ptclsRef.current = ptclsRef.current.filter(p => p.life > 0);

      // Advance trebuchet arm during FIRING
      if (ph === 'FIRING') {
        armPRef.current = Math.min(armPRef.current + dt * 4.2, 1);
        // Advance projectile once arm passes launch point
        if (armPRef.current >= LAUNCH_P && outcomeRef.current !== 'CATASTROPHIC') {
          projIRef.current = Math.min(
            projIRef.current + Math.max(1, ~~(dt * 62)),
            trajRef.current.length
          );
        }
      }

      // Advance dodge battle box: move heart, spawn/step hazards, check hits
      if (ph === 'DODGE') {
        const heart = heartRef.current;
        const k = keysRef.current;
        const vx = (k.right ? 1 : 0) - (k.left ? 1 : 0);
        const vy = (k.down  ? 1 : 0) - (k.up   ? 1 : 0);
        const mag = Math.hypot(vx, vy) || 1;
        heart.x = Math.min(BOX.x + BOX.w - HEART_R, Math.max(BOX.x + HEART_R, heart.x + (vx / mag) * HEART_SPEED * dt));
        heart.y = Math.min(BOX.y + BOX.h - HEART_R, Math.max(BOX.y + HEART_R, heart.y + (vy / mag) * HEART_SPEED * dt));

        invulnRef.current = Math.max(0, invulnRef.current - dt * 1000);
        dodgeSpawnRef.current -= dt * 1000;
        if (dodgeSpawnRef.current <= 0) {
          rocksRef.current.push(spawnRock(BOX, !!lvl.boss));
          dodgeSpawnRef.current = lvl.boss ? 950 : 430;
        }
        const hit = stepDodge(BOX, heart, rocksRef.current, dt);
        if (hit && invulnRef.current <= 0) {
          invulnRef.current = INVULN_MS;
          const nextHp = Math.max(0, playerHpRef.current - 1);
          playerHpRef.current = nextHp;
          setPlayerHp(nextHp);
          ptclsRef.current.push(...mkHitSpark(heart.x, heart.y));
          shakeRef.current = { timer: 200, mag: 5 };
        }
        dodgeElapsedRef.current += dt * 1000;
      }

      // Screen shake decay
      shakeRef.current.timer = Math.max(0, shakeRef.current.timer - dt * 1000);
      const shakeMag = shakeRef.current.timer > 0 ? shakeRef.current.mag : 0;
      const sx = shakeMag ? (Math.random() - 0.5) * shakeMag : 0;
      const sy = shakeMag ? (Math.random() - 0.5) * shakeMag : 0;

      // ── Draw ──────────────────────────────
      ctx.clearRect(0, 0, GW, GH);
      ctx.save();
      ctx.translate(sx, sy);
      drawBg(ctx);
      drawWall(ctx, lvl, ts);
      if (lvl.boss) {
        drawBoss(ctx, lvl, bossHpRef.current);
      } else {
        drawTarget(ctx, lvl, outcomeRef.current === 'HIT');
      }

      const ap = (ph === 'FIRING' || ph === 'RESULT') ? armPRef.current : 0;
      drawTrebuchet(ctx, ap);

      const traj = trajRef.current;

      // Trajectory preview (AIM phase)
      if (ph === 'AIM' && traj.length > 0) {
        drawTrail(ctx, traj, undefined, true);
      }

      // Animated trail + projectile (FIRING / RESULT)
      if ((ph === 'FIRING' || ph === 'RESULT') &&
          traj.length > 0 &&
          outcomeRef.current !== 'CATASTROPHIC') {
        const idx = projIRef.current;
        drawTrail(ctx, traj, idx, false);
        if (idx < traj.length && ph === 'FIRING') {
          const { x, y } = traj[idx];
          if (y < GROUND_Y) drawProjectile(ctx, x, y);
        }
      }

      renderParticles(ctx, ptclsRef.current);
      drawLabels(ctx, lvl);
      drawHpHud(ctx, playerHpRef.current, PLAYER_MAX_HP);

      if (ph === 'DODGE' || ph === 'GAME_OVER') {
        drawDodgeBox(ctx, BOX, heartRef.current, rocksRef.current, invulnRef.current, playerHpRef.current);
      }
      ctx.restore();

      rafRef.current = requestAnimationFrame(loop);
    }

    rafRef.current = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(rafRef.current);
      clearTimeout(toRef.current);
    };
  }, []);

  // Keep probRef (read by stable handlers below) in sync with prob state
  useEffect(() => {
    probRef.current = prob;
  }, [prob]);

  // ── Keyboard input for the dodge battle box (arrows / WASD) ──
  useEffect(() => {
    const KEYMAP = {
      ArrowUp: 'up', w: 'up', W: 'up',
      ArrowDown: 'down', s: 'down', S: 'down',
      ArrowLeft: 'left', a: 'left', A: 'left',
      ArrowRight: 'right', d: 'right', D: 'right',
    };
    const onDown = e => {
      const dir = KEYMAP[e.key];
      if (!dir) return;
      if (e.key.startsWith('Arrow')) e.preventDefault();
      keysRef.current[dir] = true;
    };
    const onUp = e => {
      const dir = KEYMAP[e.key];
      if (dir) keysRef.current[dir] = false;
    };
    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);
    return () => {
      window.removeEventListener('keydown', onDown);
      window.removeEventListener('keyup', onUp);
    };
  }, []);

  // ── Recompute preview trajectory ────────────
  useEffect(() => {
    const v0 = v0From(parseFloat(cwRef.current), prob.ans);
    if (v0 && phase === 'AIM') {
      trajRef.current = calcTraj(v0, angle);
    } else if (phase !== 'FIRING' && phase !== 'RESULT') {
      trajRef.current = [];
    }
  }, [cw, angle, prob, phase]);

  // Open the Undertale-style dodge box: the target/boss counterattacks
  // every turn regardless of the shot's outcome. `pendingResult` is applied
  // once the dodge session ends (RESULT), unless the player's HP hit 0.
  const beginDodge = useCallback((pendingResult) => {
    const lvl = LEVELS[levelIdxRef.current];
    heartRef.current = { x: BOX.x + BOX.w / 2, y: BOX.y + BOX.h / 2 };
    rocksRef.current = [];
    keysRef.current = {};
    dodgeSpawnRef.current = 350;
    dodgeElapsedRef.current = 0;
    invulnRef.current = 0;
    pendingResultRef.current = pendingResult;
    phaseRef.current = 'DODGE';
    setPhase('DODGE');
    const duration = DODGE_BASE_MS + (lvl.boss ? 1400 : 0);
    toRef.current = setTimeout(() => {
      rocksRef.current = [];
      if (playerHpRef.current <= 0) {
        phaseRef.current = 'GAME_OVER';
        setPhase('GAME_OVER');
      } else {
        phaseRef.current = 'RESULT';
        setPhase('RESULT');
        setResult(pendingResultRef.current);
      }
    }, duration);
  }, []);

  // ── Handlers ────────────────────────────────
  const handleSetWeight = useCallback(() => {
    const v = parseFloat(cwRef.current);
    if (!v || v <= 0) return;
    phaseRef.current = 'AIM';
    setPhase('AIM');
  }, []);

  const handleFire = useCallback(() => {
    const lvl      = LEVELS[levelIdxRef.current];
    const cwVal    = parseFloat(cwRef.current);
    const correct  = probRef.current.ans;
    const err      = cwError(cwVal, correct);

    armPRef.current  = 0;
    projIRef.current = 0;
    ptclsRef.current = [];
    setOutcomeBoth(null);

    if (err > 0.20) {
      // ── CATASTROPHIC ──
      setOutcomeBoth('CATASTROPHIC');
      ptclsRef.current   = mkExplosion(PIVOT_X, PIVOT_Y - 20);
      phaseRef.current   = 'FIRING';
      setPhase('FIRING');
      toRef.current = setTimeout(() => {
        phaseRef.current = 'RESULT';
        setPhase('RESULT');
        setResult({
          type: 'CATASTROPHIC',
          msg:  `💥 STRUCTURAL FAILURE! Way off — the trebuchet destroyed itself. The correct answer was ${correct}kg.`,
        });
      }, 2400);
      return;
    }

    // ── Normal fire ──
    const v0   = v0From(cwVal, correct);
    const traj = calcTraj(v0, angleRef.current);
    trajRef.current = traj;

    phaseRef.current = 'FIRING';
    setPhase('FIRING');

    const dur = Math.max((traj.length / 62 + 0.25) * 1000 + 600, 2000);
    toRef.current = setTimeout(() => {
      const { type: geo, lx } = checkTraj(traj, lvl);
      // Success gate: a geometric hit only counts when the answer is exactly
      // right — otherwise the shot glances off (Marginal tier, no progress).
      const type = geo === 'HIT' && cwVal !== correct ? 'DEFLECT' : geo;
      setOutcomeBoth(type);
      let msg;
      if (type === 'HIT') {
        ptclsRef.current = mkSuccess(lvl.targetX, GROUND_Y - 52);
        if (lvl.boss) {
          const nh = bossHpRef.current - 1;
          setBossHpBoth(nh);
          msg = nh > 0
            ? `🎯 DIRECT HIT! ${BOSS_NAME} cracks — ${nh} more hit${nh > 1 ? 's' : ''} to bring it down!`
            : `⚔ ${BOSS_NAME} CRUMBLES! The dungeon is cleared — your math conquered the kingdom!`;
        } else {
          msg = '🎯 DIRECT HIT! Your math was spot on!';
        }
      } else if (type === 'DEFLECT') {
        ptclsRef.current = mkDeflect(lvl.targetX, GROUND_Y - 52);
        msg = `🛡 GLANCED OFF! The shot reached the target, but your counterweight isn't exact — redo the multiplication.`;
      } else if (type === 'WALL') {
        const under = cwVal < correct;
        msg = under
          ? `🧱 Hit the wall! Your counterweight is too light. Redo the multiplication.`
          : `🧱 Hit the wall! Try a steeper angle to arc over it.`;
      } else {
        const d   = lx ? ~~Math.abs(lx - lvl.targetX) : '?';
        const dir = lx < lvl.targetX ? 'short' : 'long';
        msg = `Landed ${d}px ${dir} of the target. Check your counterweight math!`;
      }
      // The target/boss always counterattacks — dodge before the result shows
      beginDodge({ type, msg });
    }, dur);
  }, [setOutcomeBoth, setBossHpBoth, beginDodge]);

  const goAim = useCallback(() => {
    armPRef.current  = 0;
    projIRef.current = 0;
    ptclsRef.current = [];
    rocksRef.current = [];
    setOutcomeBoth(null);
    setResult(null);
    const v0 = v0From(parseFloat(cwRef.current), probRef.current.ans);
    if (v0) trajRef.current = calcTraj(v0, angleRef.current);
    phaseRef.current = 'AIM';
    setPhase('AIM');
  }, [setOutcomeBoth]);

  const goProblem = useCallback(() => {
    armPRef.current  = 0;
    projIRef.current = 0;
    ptclsRef.current = [];
    rocksRef.current = [];
    setOutcomeBoth(null);
    trajRef.current = [];
    setResult(null);
    phaseRef.current = 'PROBLEM';
    setPhase('PROBLEM');
  }, [setOutcomeBoth]);

  // Enter a level fresh (also used to restart the run after victory)
  const startLevel = useCallback((idx) => {
    const lvl = LEVELS[idx];
    levelIdxRef.current = idx;
    setLevelIdx(idx);
    setBossHpBoth(LEVELS[BOSS_IDX].hp);
    cwRef.current    = '';
    angleRef.current = 55;
    armPRef.current  = 0;
    projIRef.current = 0;
    ptclsRef.current = [];
    rocksRef.current = [];
    setOutcomeBoth(null);
    trajRef.current  = [];
    setProb(newProb(lvl)); setCw(''); setAngle(55); setResult(null);
    phaseRef.current = 'PROBLEM';
    setPhase('PROBLEM');
  }, [setOutcomeBoth, setBossHpBoth]);

  const advance = useCallback(() => {
    startLevel(Math.min(levelIdxRef.current + 1, BOSS_IDX));
  }, [startLevel]);

  const resetRun = useCallback(() => {
    setPlayerHpBoth(PLAYER_MAX_HP);
    startLevel(0);
  }, [startLevel, setPlayerHpBoth]);

  // Next boss strike: keep boss HP and the player's dialed-in angle,
  // deal a harder problem (escalates with hits already landed)
  const nextStrike = useCallback(() => {
    const lvl = LEVELS[levelIdxRef.current];
    cwRef.current    = '';
    armPRef.current  = 0;
    projIRef.current = 0;
    ptclsRef.current = [];
    rocksRef.current = [];
    setOutcomeBoth(null);
    trajRef.current  = [];
    setProb(newProb(lvl, lvl.hp - bossHpRef.current));
    setCw(''); setResult(null);
    phaseRef.current = 'PROBLEM';
    setPhase('PROBLEM');
  }, [setOutcomeBoth]);

  // Game over: the target/boss whittled the player's HP to 0 mid-dodge.
  // Restore HP and retry the same level (boss HP and tier progress kept).
  const retryAfterGameOver = useCallback(() => {
    const lvl = LEVELS[levelIdxRef.current];
    setPlayerHpBoth(PLAYER_MAX_HP);
    cwRef.current    = '';
    armPRef.current  = 0;
    projIRef.current = 0;
    ptclsRef.current = [];
    rocksRef.current = [];
    setOutcomeBoth(null);
    trajRef.current  = [];
    setProb(newProb(lvl, lvl.boss ? lvl.hp - bossHpRef.current : 0));
    setCw(''); setResult(null);
    phaseRef.current = 'PROBLEM';
    setPhase('PROBLEM');
  }, [setOutcomeBoth, setPlayerHpBoth]);

  // ── Styles ──────────────────────────────────
  const dlg = {
    background: C.dlgBg,
    border: `4px solid ${C.dlgBdr}`,
    width: GW, maxWidth: '100%',
    padding: '14px 22px', minHeight: 90,
    fontFamily: '"Courier New", monospace',
    color: C.white, boxSizing: 'border-box',
  };
  const btn = (col, filled) => ({
    background: filled ? col : 'transparent',
    border: `2px solid ${col}`, color: filled ? '#000' : col,
    fontFamily: '"Courier New", monospace', fontWeight: 'bold',
    fontSize: 13, padding: '5px 15px', cursor: 'pointer', letterSpacing: 1,
  });

  const curLevel = LEVELS[levelIdx];
  const strikeNo = curLevel.boss ? curLevel.hp - bossHp + 1 : 0;

  return (
    <div style={{
      background: '#060d14', minHeight: '100vh',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      userSelect: 'none', gap: 0,
    }}>
      {/* Title */}
      <div style={{
        color: C.gold, fontFamily: '"Courier New", monospace',
        fontSize: 20, fontWeight: 'bold', letterSpacing: 5,
        marginBottom: 6, textShadow: `0 0 12px ${C.gold}`,
      }}>
        ⚔ MATH KINGDOM ⚔
      </div>

      {/* Game canvas */}
      <canvas
        ref={cvsRef} width={GW} height={GH}
        style={{
          display: 'block',
          border: `3px solid ${C.dlgBdr}`,
          imageRendering: 'pixelated',
          maxWidth: '100%',
        }}
      />

      {/* Dialogue box */}
      <div style={dlg}>

        <div style={{
          fontSize: 11, letterSpacing: 1, marginBottom: 8,
          color: playerHp <= 1 ? '#ff6060' : '#999',
        }}>
          {'❤ '.repeat(playerHp)}{'♡ '.repeat(PLAYER_MAX_HP - playerHp)}HP
        </div>

        {/* ── PROBLEM ── */}
        {phase === 'PROBLEM' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{
              color: curLevel.boss ? C.orange : C.gold,
              fontSize: 12, letterSpacing: 3,
            }}>
              {curLevel.boss
                ? `☠ BOSS FIGHT — ${BOSS_NAME} · STRIKE ${strikeNo}/${curLevel.hp}`
                : `⚡ CALIBRATE TREBUCHET — TIER ${curLevel.tier} · LEVEL ${curLevel.lvl}/${LVLS_PER_TIER}`}
            </div>
            <div style={{ fontSize: 14, lineHeight: 1.7 }}>
              Your boulder weighs{' '}
              <span style={{ color: C.gold, fontWeight: 'bold' }}>{prob.mp}kg</span>.
              To {curLevel.boss ? `wound ${BOSS_NAME}` : 'breach the castle wall'}, you need a force ratio of{' '}
              <span style={{ color: C.gold, fontWeight: 'bold' }}>{prob.r}×</span>.
              <br />
              What must your counterweight be?
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <span style={{ color: C.gold }}>{prob.mp} × {prob.r} =</span>
              <input
                autoFocus
                type="number"
                value={cw}
                onChange={e => { setCw(e.target.value); cwRef.current = e.target.value; }}
                onKeyDown={e => e.key === 'Enter' && cw && handleSetWeight()}
                placeholder="?"
                style={{
                  background: '#111', border: `2px solid ${C.gold}`,
                  color: C.gold, fontFamily: '"Courier New", monospace',
                  fontSize: 20, padding: '3px 10px', width: 95, outline: 'none',
                }}
              />
              <span style={{ color: '#777', fontSize: 13 }}>kg</span>
              <button
                onClick={handleSetWeight}
                style={btn(C.gold, !!cw)}
              >
                SET WEIGHT ▶
              </button>
            </div>
          </div>
        )}

        {/* ── AIM ── */}
        {phase === 'AIM' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}>
            <div style={{ color: C.gold, fontSize: 12, letterSpacing: 3 }}>⚔ AIM</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ color: '#777', fontSize: 12 }}>Counterweight:</span>
              <span style={{ color: C.gold }}>{cw}kg</span>
              <button onClick={goProblem} style={{ ...btn('#666', false), fontSize: 10, padding: '2px 7px' }}>
                change
              </button>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ color: '#777', fontSize: 12 }}>Angle:</span>
              <span style={{ color: C.gold, minWidth: 38 }}>{angle}°</span>
              <input
                type="range" min={15} max={80} value={angle}
                onChange={e => {
                  const v = Number(e.target.value);
                  setAngle(v); angleRef.current = v;
                }}
                style={{ width: 130, accentColor: C.gold }}
              />
              <span style={{ color: '#444', fontSize: 11 }}>15°–80°</span>
            </div>
            <button
              onClick={handleFire}
              style={{
                background: '#b03800', border: `2px solid ${C.orange}`,
                color: '#fff', fontFamily: '"Courier New", monospace',
                fontWeight: 'bold', fontSize: 16, padding: '6px 22px',
                cursor: 'pointer', letterSpacing: 2,
              }}
            >
              🔥 FIRE!
            </button>
          </div>
        )}

        {/* ── FIRING ── */}
        {phase === 'FIRING' && (
          <div style={{
            color: outcome === 'CATASTROPHIC' ? C.orange : C.gold,
            fontSize: 15, letterSpacing: 2,
          }}>
            {outcome === 'CATASTROPHIC'
              ? '💥 STRUCTURAL FAILURE — CATASTROPHIC MISFIRE!'
              : '🚀 LAUNCHING...'}
          </div>
        )}

        {/* ── DODGE ── */}
        {phase === 'DODGE' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ color: C.orange, fontSize: 14, letterSpacing: 2 }}>
              ⚠ {curLevel.boss ? BOSS_NAME : 'THE TARGET'} STRIKES BACK!
            </div>
            <div style={{ fontSize: 12, color: '#999' }}>
              Use ↑↓←→ or WASD to steer your soul clear of the counterattack.
            </div>
          </div>
        )}

        {/* ── GAME OVER ── */}
        {phase === 'GAME_OVER' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ color: '#ff6060', fontSize: 15, letterSpacing: 2 }}>
              💔 YOUR SOUL SHATTERS! The counterattack was too much to dodge.
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button onClick={retryAfterGameOver} style={btn('#ff6060', false)}>
                ↺ RISE AGAIN
              </button>
            </div>
          </div>
        )}

        {/* ── RESULT ── */}
        {phase === 'RESULT' && result && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{
              fontSize: 14, lineHeight: 1.6,
              color: result.type === 'HIT'
                ? C.green
                : result.type === 'DEFLECT'
                  ? C.tG
                  : result.type === 'CATASTROPHIC' ? C.orange : '#ff6060',
            }}>
              {result.msg}
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {result.type === 'HIT' ? (
                curLevel.boss ? (
                  bossHp <= 0 ? (
                    <button onClick={resetRun} style={btn(C.gold, true)}>
                      ⚔ VICTORY — PLAY AGAIN ↺
                    </button>
                  ) : (
                    <button onClick={nextStrike} style={btn(C.orange, false)}>
                      NEXT STRIKE ▶
                    </button>
                  )
                ) : levelIdx === BOSS_IDX - 1 ? (
                  <button onClick={advance} style={btn(C.orange, false)}>
                    ☠ ENTER THE BOSS LAIR ▶
                  </button>
                ) : (
                  <button onClick={advance} style={btn(C.green, false)}>
                    NEXT LEVEL ▶
                  </button>
                )
              ) : (
                <>
                  {result.type !== 'CATASTROPHIC' && (
                    <button onClick={goAim} style={btn(C.gold, false)}>
                      ↺ TRY AGAIN
                    </button>
                  )}
                  <button onClick={goProblem} style={btn('#aaa', false)}>
                    ✎ FIX MATH
                  </button>
                  {result.type === 'CATASTROPHIC' && (
                    <button onClick={goAim} style={btn(C.orange, false)}>
                      ↺ REBUILD & RETRY
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        )}

      </div>

      <style>{`
        input[type=number]::-webkit-outer-spin-button,
        input[type=number]::-webkit-inner-spin-button { -webkit-appearance:none; margin:0; }
        input[type=number] { -moz-appearance: textfield; }
      `}</style>
    </div>
  );
}
