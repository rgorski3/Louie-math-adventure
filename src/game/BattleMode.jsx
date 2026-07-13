import { useState, useEffect, useRef, useCallback } from "react";
import {
  GW, GH, GROUND_Y, C,
  drawHeart, drawHpHud,
  stepParticles, renderParticles, mkParticles,
  mulProblem, dlgStyle, btnStyle, inputStyle,
} from "./shared";

// ──────────────────────────────────────────────
// BATTLE — dungeon math combat section.
// Stone Dungeon, Tier 1, Section 1: a fixed 4-encounter gauntlet ending in
// the GOLEM boss. Turn loop per Game_Structure_Redesign_Plan.md §Section 1:
//   PROBLEM -> (correct: PLAYER_ATTACK, damage) | (wrong: fizzle, no damage)
//   -> DODGE (enemy always counterattacks; ported Undertale dodge box)
//   -> PROBLEM again, or GAME_OVER / VICTORY / CLEAR
// The dodge box (BOX/HEART_R/HEART_SPEED/PLAYER_MAX_HP/INVULN_MS/ROCK_R,
// spawnRock/stepDodge/drawDodgeBox) is ported verbatim from the pre-redesign
// git history (see git show cd8a6d5:src/MathKingdom.jsx) — numbers kept as-is.
// ──────────────────────────────────────────────

const BOX = { x: 220, y: 82, w: 360, h: 210 };
const HEART_R       = 7;    // collision + draw half-size
const HEART_SPEED   = 210;  // px/s
const PLAYER_MAX_HP = 3;
const INVULN_MS     = 700;
const DODGE_BASE_MS = 3400;
const DODGE_BOSS_MS = 4800;
const ROCK_R        = 8;
const ATTACK_MS     = 900; // brief PLAYER_ATTACK / fizzle phase length

// Clamp a heart position into the dodge box — shared by keyboard movement
// and pointer/touch dragging so both inputs are bounded identically.
const clampHeartX = x => Math.min(BOX.x + BOX.w - HEART_R, Math.max(BOX.x + HEART_R, x));
const clampHeartY = y => Math.min(BOX.y + BOX.h - HEART_R, Math.max(BOX.y + HEART_R, y));

const ENEMY_X = 560;

// ── Undertale-style timed strike (TIMING phase) ──
const TIMING_MS     = 4000; // window to strike before auto-swing
const STRIKE_FREEZE_MS = 350; // brief pause showing the frozen marker before resolving
const METER_W = 300, METER_H = 28;
const METER_AMPLITUDE = 130;                 // px either side of center
const METER_PERIOD_S  = 0.9;                 // ~1 full sweep per 900ms
const METER_SPEED = (2 * Math.PI) / METER_PERIOD_S;
const METER_Y = 150;
const ZONE_W_NORMAL = 40, ZONE_W_BOSS = 28;  // gold center-zone width

// ──────────────────────────────────────────────
// ENCOUNTER TABLE — the extension point for future dungeon tiers.
// ──────────────────────────────────────────────
const ENEMIES = [
  {
    key: 'sprite', name: 'PEBBLE SPRITE', hp: 3, a: [3, 6], b: [2, 5],
    rockVy: [120, 170], spawnMs: 520,
    reward: { stone: 8, gold: 2 },
    flavor: 'A PEBBLE SPRITE skitters out of the rubble, clattering its stony limbs!',
  },
  {
    key: 'bat', name: 'BRICK BAT', hp: 4, a: [4, 7], b: [3, 6],
    rockVy: [160, 220], spawnMs: 400,
    reward: { stone: 10, gold: 3 },
    flavor: 'A BRICK BAT swoops down from the rafters, brick wings clacking overhead!',
  },
  {
    key: 'knight', name: 'RUBBLE KNIGHT', hp: 5, a: [6, 9], b: [4, 8],
    rockVy: [150, 230], spawnMs: 300,
    reward: { stone: 14, gold: 5 },
    flavor: 'A RUBBLE KNIGHT grinds forward, its cracked shield raised high!',
  },
  {
    key: 'golem', name: 'GOLEM', hp: 7, a: [7, 12], b: [6, 9],
    boss: true, spawnMs: 950,
    reward: { stone: 30, gold: 15, wood: 10 },
    flavor: 'The dungeon floor QUAKES — the GOLEM rises, eyes blazing red!',
  },
];

function genProb(enemy) {
  return mulProblem(enemy.a[0], enemy.a[1], enemy.b[0], enemy.b[1]);
}

function rewardText(r) {
  const parts = [];
  if (r.stone) parts.push(`+${r.stone}\u{1FAA8}`); // 🪨
  if (r.wood)  parts.push(`+${r.wood}\u{1FAB5}`);  // 🪵
  if (r.gold)  parts.push(`+${r.gold}\u{1FA99}`);  // 🪙
  return parts.join('  ');
}

// ──────────────────────────────────────────────
// DUNGEON SCENE — dark stone interior, flickering torches, floor line.
// ──────────────────────────────────────────────
function drawTorch(ctx, x, y, ts) {
  ctx.fillStyle = C.woodDk; ctx.fillRect(x, y, 4, 16);
  ctx.fillStyle = C.metal;  ctx.fillRect(x - 2, y - 3, 8, 4);
  const flick = 0.7 + 0.3 * Math.abs(Math.sin((ts + x * 13) / 130));
  ctx.globalAlpha = flick;
  ctx.fillStyle = C.orange; ctx.fillRect(x - 3, y - 12, 10, 10);
  ctx.fillStyle = C.gold;   ctx.fillRect(x - 1, y - 9, 6, 6);
  ctx.globalAlpha = 1;
}

function drawDungeonBg(ctx, ts) {
  const g = ctx.createLinearGradient(0, 0, 0, GROUND_Y);
  g.addColorStop(0, C.skyTop); g.addColorStop(1, C.skyBot);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, GW, GROUND_Y);

  // Stone brick courses on the back wall
  const brickW = 42, brickH = 20;
  for (let row = 0, y = 0; y < GROUND_Y; row++, y += brickH) {
    const offset = (row % 2) * (brickW / 2);
    for (let x = -brickW; x < GW; x += brickW) {
      const bx = ~~(x + offset);
      ctx.fillStyle = C.wallDk;
      ctx.fillRect(bx, y, brickW - 3, brickH - 3);
      ctx.fillStyle = C.wall;
      ctx.fillRect(bx + 2, y + 2, brickW - 7, brickH - 7);
    }
  }
  ctx.globalAlpha = 0.35;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, GW, GROUND_Y);
  ctx.globalAlpha = 1;

  // Floor
  ctx.fillStyle = C.ground;  ctx.fillRect(0, GROUND_Y, GW, GH - GROUND_Y);
  ctx.fillStyle = C.groundTx; ctx.fillRect(0, GROUND_Y, GW, 4);
  for (let x = 0; x < GW; x += 44) {
    ctx.fillRect(x, GROUND_Y + 10, 26, 2);
    ctx.fillRect(x + 22, GROUND_Y + 22, 18, 2);
  }

  drawTorch(ctx, 90, 150, ts);
  drawTorch(ctx, 400, 110, ts);
  drawTorch(ctx, 700, 150, ts);
}

// ──────────────────────────────────────────────
// ENEMY PIXEL ART — one distinct chunky look per encounter.
// ──────────────────────────────────────────────
function drawEnemyPips(ctx, bx, topY, name, hp, maxHp) {
  const pipW = 14, gap = 6;
  const w = maxHp * pipW + (maxHp - 1) * gap;
  const x0 = ~~(bx - w / 2), y0 = topY;
  ctx.font = 'bold 12px "Courier New",monospace';
  ctx.fillStyle = C.gold;
  ctx.fillText(name, x0, y0 - 8);
  for (let i = 0; i < maxHp; i++) {
    const px = x0 + i * (pipW + gap);
    ctx.fillStyle = C.dlgBdr;
    ctx.fillRect(px - 2, y0 - 2, pipW + 4, pipW + 4);
    ctx.fillStyle = i < hp ? C.red : '#181818';
    ctx.fillRect(px, y0, pipW, pipW);
  }
}

function drawSprite(ctx, bx, by, dmg) {
  ctx.fillStyle = C.wallDk;
  ctx.fillRect(bx - 10, by - 28, 20, 6);
  ctx.fillStyle = C.wall;
  ctx.fillRect(bx - 16, by - 22, 32, 20);
  ctx.fillStyle = C.wallLt;
  ctx.fillRect(bx - 16, by - 22, 32, 3);
  ctx.fillStyle = C.red;
  ctx.fillRect(bx - 9, by - 14, 5, 5);
  ctx.fillRect(bx + 4, by - 14, 5, 5);
  ctx.fillStyle = C.wallDk;
  ctx.fillRect(bx - 14, by - 2, 8, 4);
  ctx.fillRect(bx + 6, by - 2, 8, 4);
  if (dmg >= 1) ctx.fillRect(bx - 4, by - 20, 2, 10);
}

function drawBat(ctx, bx, by, dmg, ts) {
  const flap = Math.sin(ts / 150) * 6;
  ctx.fillStyle = C.woodDk;
  ctx.fillRect(bx - 34, by - 30 + flap, 16, 6);
  ctx.fillRect(bx - 30, by - 24 + flap, 12, 6);
  ctx.fillRect(bx + 18, by - 30 - flap, 16, 6);
  ctx.fillRect(bx + 18, by - 24 - flap, 12, 6);
  ctx.fillStyle = C.wall;
  ctx.fillRect(bx - 12, by - 28, 24, 22);
  ctx.fillStyle = C.wallDk;
  ctx.fillRect(bx - 12, by - 28, 24, 3);
  ctx.fillStyle = C.red;
  ctx.fillRect(bx - 8, by - 20, 5, 5);
  ctx.fillRect(bx + 3, by - 20, 5, 5);
  if (dmg >= 1) { ctx.fillStyle = C.wallDk; ctx.fillRect(bx - 2, by - 24, 2, 14); }
}

function drawKnight(ctx, bx, by, dmg) {
  ctx.fillStyle = C.wallDk;
  ctx.fillRect(bx - 10, by - 16, 8, 16);
  ctx.fillRect(bx + 2, by - 16, 8, 16);
  ctx.fillStyle = C.wall;
  ctx.fillRect(bx - 14, by - 42, 28, 28);
  ctx.fillStyle = C.wallLt;
  ctx.fillRect(bx - 14, by - 42, 28, 4);
  ctx.fillStyle = C.wallDk;
  ctx.fillRect(bx - 20, by - 40, 8, 14);
  ctx.fillRect(bx + 12, by - 40, 8, 14);
  ctx.fillStyle = C.metal;
  ctx.fillRect(bx - 9, by - 54, 18, 14);
  ctx.fillStyle = C.red;
  ctx.fillRect(bx - 6, by - 49, 5, 5);
  ctx.fillRect(bx + 2, by - 49, 5, 5);
  ctx.fillStyle = C.wallDk;
  if (dmg >= 1) ctx.fillRect(bx - 6, by - 38, 3, 16);
  if (dmg >= 2) ctx.fillRect(bx + 6, by - 30, 3, 12);
}

function drawGolem(ctx, bx, by, dmg) {
  ctx.fillStyle = C.wall;   ctx.fillRect(bx - 24, by - 56, 48, 56);
  ctx.fillStyle = C.wallDk; ctx.fillRect(bx - 24, by - 56, 48, 4);
  ctx.fillStyle = C.wallLt; ctx.fillRect(bx - 24, by - 56, 4, 56);
  ctx.fillStyle = C.wallDk;
  ctx.fillRect(bx - 34, by - 48, 10, 30);
  ctx.fillRect(bx + 24, by - 48, 10, 30);
  ctx.fillStyle = C.red;
  ctx.fillRect(bx - 14, by - 44, 8, 8);
  ctx.fillRect(bx + 6,  by - 44, 8, 8);
  ctx.fillStyle = '#000';
  ctx.fillRect(bx - 10, by - 26, 20, 5);
  ctx.fillStyle = C.wallDk;
  if (dmg >= 1) { ctx.fillRect(bx - 20, by - 52, 3, 14); ctx.fillRect(bx - 18, by - 40, 3, 8); }
  if (dmg >= 2) { ctx.fillRect(bx + 12, by - 30, 3, 16); ctx.fillRect(bx + 8,  by - 16, 3, 8); }
  if (dmg >= 3) { ctx.fillRect(bx - 2, by - 50, 3, 20); }
}

// Topmost unscaled y-offset (above `by`/GROUND_Y) each sprite reaches — used
// to keep the name + HP pips clear of the now-2x-taller art.
const ENEMY_TOP_UNSCALED = { sprite: 28, bat: 36, knight: 54, golem: 56 };

function drawEnemy(ctx, enemy, hp, ts) {
  const bx = ENEMY_X, by = GROUND_Y;
  const dmg = enemy.hp - hp;
  // Draw every enemy at 2x scale, anchored so feet stay at GROUND_Y: translate
  // to the local origin, scale, then draw the existing art at (0, 0).
  ctx.save();
  ctx.translate(bx, by);
  ctx.scale(2, 2);
  if (enemy.key === 'sprite')      drawSprite(ctx, 0, 0, dmg);
  else if (enemy.key === 'bat')    drawBat(ctx, 0, 0, dmg, ts);
  else if (enemy.key === 'knight') drawKnight(ctx, 0, 0, dmg);
  else                             drawGolem(ctx, 0, 0, dmg);
  ctx.restore();
  const topY = by - ENEMY_TOP_UNSCALED[enemy.key] * 2 - 34;
  drawEnemyPips(ctx, bx, topY, enemy.name, hp, enemy.hp);
}

function drawHud(ctx, enemy, idx) {
  ctx.font = 'bold 11px "Courier New",monospace';
  ctx.fillStyle = C.gold;
  ctx.fillText(
    enemy.boss ? '☠ BOSS — GOLEM' : `STONE DUNGEON · FOE ${idx + 1}/${ENEMIES.length}`,
    10, 16
  );
}

function drawSlash(ctx, bx, by, t) {
  const a = Math.max(0, 1 - t * 1.3);
  if (a <= 0) return;
  ctx.globalAlpha = a;
  ctx.fillStyle = '#fff';
  ctx.fillRect(bx - 44, by - 62 + t * 14, 92, 6);
  ctx.fillRect(bx - 34, by - 42 + t * 20, 74, 6);
  ctx.fillRect(bx - 20, by - 20 + t * 24, 56, 6);
  ctx.globalAlpha = 1;
}

// ── TIMING phase: sweeping strike meter (Undertale-style timed attack) ──
function drawTimingMeter(ctx, markerX, zoneW, markerColor) {
  const x0 = ~~(GW / 2 - METER_W / 2), y0 = METER_Y;

  ctx.font = '11px "Courier New",monospace';
  ctx.fillStyle = C.gold;
  ctx.fillText('TAP ⚔ WHEN THE MARKER HITS GOLD!', x0, y0 - 12);

  ctx.fillStyle = '#000';
  ctx.fillRect(x0, y0, METER_W, METER_H);

  ctx.fillStyle = C.gold;
  ctx.fillRect(~~(GW / 2 - zoneW / 2), y0, zoneW, METER_H);

  ctx.strokeStyle = C.white; ctx.lineWidth = 3;
  ctx.strokeRect(x0 + 1.5, y0 + 1.5, METER_W - 3, METER_H - 3);

  ctx.fillStyle = markerColor;
  ctx.fillRect(~~(markerX - 3), y0 - 4, 6, METER_H + 8);
}

// ── Undertale-style dodge battle box (ported verbatim, numbers unchanged) ──
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

function spawnRock(box, enemy) {
  if (enemy.boss) {
    const w = 60 + Math.random() * 30;
    const x = box.x + w / 2 + Math.random() * (box.w - w);
    return { type: 'slam', x, w, telegraph: 550 };
  }
  const [vyMin, vyMax] = enemy.rockVy;
  const x = box.x + ROCK_R + Math.random() * (box.w - ROCK_R * 2);
  return { type: 'rock', x, y: box.y - ROCK_R, vy: vyMin + Math.random() * (vyMax - vyMin) };
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

// Radial hit-spark particles (ported from the old dodge box's mkHitSpark)
function mkHitSpark(x, y) {
  return Array.from({ length: 10 }, (_, i) => ({
    x, y,
    vx: (Math.random() - 0.5) * 160,
    vy: (Math.random() - 0.5) * 160,
    color: i % 2 === 0 ? C.red : '#fff',
    life: 1, size: 3 + Math.random() * 4,
  }));
}

// ──────────────────────────────────────────────
// COMPONENT
// ──────────────────────────────────────────────
export default function BattleMode({ onReward, onExit }) {
  void onExit; // unused for now — hub owns navigation

  const cvsRef = useRef(null);
  const rafRef = useRef(null);
  const tsRef  = useRef(null);
  const toRef  = useRef(null);

  // ── Mutable per-frame game data lives in refs ──
  const phaseRef     = useRef('PROBLEM');
  const enemyIdxRef  = useRef(0);
  const enemyHpRef   = useRef(ENEMIES[0].hp);
  const playerHpRef  = useRef(PLAYER_MAX_HP);
  const probRef      = useRef(null);
  const ansRef       = useRef('');
  const atkTimerRef  = useRef(0);
  const atkResultRef = useRef(null);
  const ptclsRef     = useRef([]);
  const heartRef     = useRef({ x: BOX.x + BOX.w / 2, y: BOX.y + BOX.h / 2 });
  const rocksRef     = useRef([]);
  const keysRef      = useRef({});
  const dodgeSpawnRef = useRef(0);
  const invulnRef    = useRef(0);
  const shakeRef     = useRef({ timer: 0, mag: 0 });
  const onRewardRef  = useRef(onReward);

  // Pointer/touch drag steering for the dodge box (relative-drag scheme)
  const dragActiveRef = useRef(false);
  const dragLastRef    = useRef({ x: 0, y: 0 });

  // TIMING phase — sweeping strike meter
  const timingStartRef    = useRef(0);
  const markerXRef        = useRef(GW / 2);
  const timingFrozenRef   = useRef(false);
  const timingToRef       = useRef(null); // 4s auto-swing timeout
  const freezeToRef       = useRef(null); // brief freeze-then-resolve timeout
  const strikeCriticalRef = useRef(null); // null while sweeping; bool once struck

  // ── React state drives UI re-renders only ──
  const [phase, setPhase]       = useState('PROBLEM');
  const [enemyIdx, setEnemyIdx] = useState(0);
  const [enemyHp, setEnemyHp]   = useState(ENEMIES[0].hp);
  const [playerHp, setPlayerHp] = useState(PLAYER_MAX_HP);
  const [prob, setProb]         = useState(() => genProb(ENEMIES[0]));
  const [ans, setAns]           = useState('');
  const [atkResult, setAtkResult] = useState(null);

  useEffect(() => { onRewardRef.current = onReward; }, [onReward]);
  useEffect(() => { probRef.current = prob; }, [prob]);

  // Keep refs (read by the animation loop) and state (read by JSX) in sync
  const setEnemyHpBoth = useCallback(v => { enemyHpRef.current = v; setEnemyHp(v); }, []);
  const setPlayerHpBoth = useCallback(v => { playerHpRef.current = v; setPlayerHp(v); }, []);
  const setAtkResultBoth = useCallback(v => { atkResultRef.current = v; setAtkResult(v); }, []);

  // ── Animation loop ──────────────────────────
  useEffect(() => {
    const canvas = cvsRef.current;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;

    function loop(ts) {
      const dt = Math.min((ts - (tsRef.current ?? ts)) / 1000, 0.05);
      tsRef.current = ts;
      const ph = phaseRef.current;
      const enemy = ENEMIES[enemyIdxRef.current];

      ptclsRef.current = stepParticles(ptclsRef.current, dt);

      if (ph === 'PLAYER_ATTACK') {
        atkTimerRef.current = Math.max(0, atkTimerRef.current - dt * 1000);
      }

      if (ph === 'TIMING' && !timingFrozenRef.current) {
        const t = (ts - timingStartRef.current) / 1000;
        markerXRef.current = GW / 2 + METER_AMPLITUDE * Math.sin(t * METER_SPEED);
      }

      if (ph === 'DODGE') {
        const heart = heartRef.current;
        const k = keysRef.current;
        const vx = (k.right ? 1 : 0) - (k.left ? 1 : 0);
        const vy = (k.down ? 1 : 0) - (k.up ? 1 : 0);
        const mag = Math.hypot(vx, vy) || 1;
        heart.x = clampHeartX(heart.x + (vx / mag) * HEART_SPEED * dt);
        heart.y = clampHeartY(heart.y + (vy / mag) * HEART_SPEED * dt);

        invulnRef.current = Math.max(0, invulnRef.current - dt * 1000);
        dodgeSpawnRef.current -= dt * 1000;
        if (dodgeSpawnRef.current <= 0) {
          rocksRef.current.push(spawnRock(BOX, enemy));
          dodgeSpawnRef.current = enemy.spawnMs;
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
      drawDungeonBg(ctx, ts);
      drawEnemy(ctx, enemy, enemyHpRef.current, ts);

      if (ph === 'PLAYER_ATTACK' && atkResultRef.current?.correct) {
        drawSlash(ctx, ENEMY_X, GROUND_Y, 1 - atkTimerRef.current / ATTACK_MS);
      }

      renderParticles(ctx, ptclsRef.current);
      drawHud(ctx, enemy, enemyIdxRef.current);
      drawHpHud(ctx, playerHpRef.current, PLAYER_MAX_HP);

      if (ph === 'DODGE' || ph === 'GAME_OVER') {
        drawDodgeBox(ctx, BOX, heartRef.current, rocksRef.current, invulnRef.current, playerHpRef.current);
      }

      if (ph === 'TIMING') {
        const zoneW = enemy.boss ? ZONE_W_BOSS : ZONE_W_NORMAL;
        const markerColor = strikeCriticalRef.current === true ? C.green
          : strikeCriticalRef.current === false ? C.red
          : C.white;
        drawTimingMeter(ctx, markerXRef.current, zoneW, markerColor);
      }
      ctx.restore();

      rafRef.current = requestAnimationFrame(loop);
    }

    rafRef.current = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(rafRef.current);
      clearTimeout(toRef.current);
      clearTimeout(timingToRef.current);
      clearTimeout(freezeToRef.current);
    };
  }, []);

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

  // ── Touch/pointer drag steering for the dodge box (mobile) ──
  // Relative-drag: the finger doesn't need to be on the heart, any drag
  // anywhere on the canvas nudges the heart by the same delta. All state
  // lives in refs — no re-renders per pointer-move event.
  const onDodgePointerDown = useCallback((e) => {
    dragActiveRef.current = true;
    dragLastRef.current = { x: e.clientX, y: e.clientY };
  }, []);

  const onDodgePointerMove = useCallback((e) => {
    if (!dragActiveRef.current) return;
    const last = dragLastRef.current;
    dragLastRef.current = { x: e.clientX, y: e.clientY };
    if (phaseRef.current !== 'DODGE') return;
    const canvas = cvsRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const dx = (e.clientX - last.x) * scaleX;
    const dy = (e.clientY - last.y) * scaleY;
    const heart = heartRef.current;
    heart.x = clampHeartX(heart.x + dx);
    heart.y = clampHeartY(heart.y + dy);
  }, []);

  const onDodgePointerUp = useCallback(() => {
    dragActiveRef.current = false;
  }, []);

  // Open the dodge box: the enemy always counterattacks, win or lose the turn.
  const beginDodge = useCallback(() => {
    const enemy = ENEMIES[enemyIdxRef.current];
    heartRef.current = { x: BOX.x + BOX.w / 2, y: BOX.y + BOX.h / 2 };
    rocksRef.current = [];
    keysRef.current = {};
    dodgeSpawnRef.current = 350;
    invulnRef.current = 0;
    phaseRef.current = 'DODGE';
    setPhase('DODGE');
    const duration = enemy.boss ? DODGE_BOSS_MS : DODGE_BASE_MS;
    toRef.current = setTimeout(() => {
      rocksRef.current = [];
      if (playerHpRef.current <= 0) {
        phaseRef.current = 'GAME_OVER';
        setPhase('GAME_OVER');
      } else {
        const p = genProb(ENEMIES[enemyIdxRef.current]);
        probRef.current = p; setProb(p);
        ansRef.current = ''; setAns('');
        setAtkResultBoth(null);
        phaseRef.current = 'PROBLEM';
        setPhase('PROBLEM');
      }
    }, duration);
  }, [setAtkResultBoth]);

  const goVictory = useCallback(() => {
    const enemy = ENEMIES[enemyIdxRef.current];
    ptclsRef.current = mkParticles(ENEMY_X, GROUND_Y - 40, {
      n: 28, colors: [C.gold, C.proj], vx: 220, vyMin: 90, vyMax: 260, size: 9,
    });
    onRewardRef.current?.(enemy.reward);
    phaseRef.current = 'VICTORY';
    setPhase('VICTORY');
  }, []);

  // Runs the familiar PLAYER_ATTACK slash/shake/particles for a resolved
  // TIMING strike (critical, normal, or a late auto-swing), then continues
  // into the normal flow (VICTORY check -> DODGE).
  const resolveStrike = useCallback((damage, msg, critical) => {
    atkTimerRef.current = ATTACK_MS;
    shakeRef.current = { timer: 260, mag: critical ? 6 : 4 };
    ptclsRef.current = mkParticles(ENEMY_X, GROUND_Y - 40, {
      n: critical ? 24 : 16, colors: [C.white, C.gold], vx: 200, vyMin: 80, vyMax: 240,
      size: critical ? 9 : 7,
    });
    setAtkResultBoth({ correct: true, msg });
    phaseRef.current = 'PLAYER_ATTACK';
    setPhase('PLAYER_ATTACK');
    toRef.current = setTimeout(() => {
      const nh = Math.max(0, enemyHpRef.current - damage);
      setEnemyHpBoth(nh);
      if (nh <= 0) {
        goVictory();
      } else {
        beginDodge();
      }
    }, ATTACK_MS);
  }, [setAtkResultBoth, setEnemyHpBoth, goVictory, beginDodge]);

  // Player taps/presses STRIKE during TIMING: freeze the marker, decide
  // CRITICAL (inside the gold zone) vs a normal hit, then resolve.
  const strike = useCallback(() => {
    if (phaseRef.current !== 'TIMING' || timingFrozenRef.current) return;
    clearTimeout(timingToRef.current);
    timingFrozenRef.current = true;
    const markerPos = markerXRef.current;
    const enemy = ENEMIES[enemyIdxRef.current];
    const zoneW = enemy.boss ? ZONE_W_BOSS : ZONE_W_NORMAL;
    const critical = Math.abs(markerPos - GW / 2) <= zoneW / 2;
    strikeCriticalRef.current = critical;
    const damage = critical ? 2 : 1;
    const msg = critical ? '⚡ CRITICAL! A perfect strike!' : 'Your math strikes true!';
    freezeToRef.current = setTimeout(() => resolveStrike(damage, msg, critical), STRIKE_FREEZE_MS);
  }, [resolveStrike]);

  // Player didn't strike within the window: auto-swing for a glancing 1-damage blow.
  const autoSwing = useCallback(() => {
    if (phaseRef.current !== 'TIMING' || timingFrozenRef.current) return;
    timingFrozenRef.current = true;
    strikeCriticalRef.current = false;
    resolveStrike(1, 'You swing late — a glancing blow!', false);
  }, [resolveStrike]);

  // Correct answer: open the TIMING phase (math already proved correct —
  // timing can only affect damage AMOUNT, never gate whether damage happens).
  const beginTiming = useCallback(() => {
    timingStartRef.current = tsRef.current ?? performance.now();
    timingFrozenRef.current = false;
    strikeCriticalRef.current = null;
    markerXRef.current = GW / 2;
    ptclsRef.current = [];
    setAtkResultBoth(null);
    phaseRef.current = 'TIMING';
    setPhase('TIMING');
    clearTimeout(timingToRef.current);
    timingToRef.current = setTimeout(() => autoSwing(), TIMING_MS);
  }, [setAtkResultBoth, autoSwing]);

  const submitAnswer = useCallback(() => {
    const entered = Number(ansRef.current);
    const correct = probRef.current.ans;
    ptclsRef.current = [];

    if (entered === correct) {
      beginTiming();
    } else {
      setAtkResultBoth({
        correct: false,
        msg: `✗ The attack fizzles! (${probRef.current.a} × ${probRef.current.b} = ${correct})`,
      });
      phaseRef.current = 'PLAYER_ATTACK';
      setPhase('PLAYER_ATTACK');
      toRef.current = setTimeout(() => {
        beginDodge();
      }, ATTACK_MS);
    }
  }, [setAtkResultBoth, beginDodge, beginTiming]);

  // ── Space/Enter also strikes, active only during TIMING ──
  useEffect(() => {
    const onKeyDown = e => {
      if (phaseRef.current !== 'TIMING') return;
      // The Enter that submits the answer flips the phase to TIMING
      // synchronously and then bubbles here — its target is the number
      // input. A genuine strike press never originates from an input.
      if (e.target instanceof HTMLInputElement) return;
      if (e.key === ' ' || e.key === 'Enter' || e.code === 'Space') {
        e.preventDefault();
        strike();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [strike]);

  // Enter an encounter fresh (also used when advancing to the next foe)
  const startEnemy = useCallback((idx) => {
    const enemy = ENEMIES[idx];
    enemyIdxRef.current = idx; setEnemyIdx(idx);
    setEnemyHpBoth(enemy.hp);
    ansRef.current = ''; setAns('');
    ptclsRef.current = []; rocksRef.current = [];
    const p = genProb(enemy);
    probRef.current = p; setProb(p);
    setAtkResultBoth(null);
    phaseRef.current = 'PROBLEM';
    setPhase('PROBLEM');
  }, [setEnemyHpBoth, setAtkResultBoth]);

  const nextFoe = useCallback(() => {
    startEnemy(Math.min(enemyIdxRef.current + 1, ENEMIES.length - 1));
  }, [startEnemy]);

  const sectionClear = useCallback(() => {
    phaseRef.current = 'CLEAR';
    setPhase('CLEAR');
  }, []);

  // Game over: HP hit 0 mid-dodge. Restore HP, retry the SAME enemy at its
  // current HP (dungeon position kept).
  const riseAgain = useCallback(() => {
    setPlayerHpBoth(PLAYER_MAX_HP);
    const enemy = ENEMIES[enemyIdxRef.current];
    ansRef.current = ''; setAns('');
    ptclsRef.current = []; rocksRef.current = [];
    const p = genProb(enemy);
    probRef.current = p; setProb(p);
    setAtkResultBoth(null);
    phaseRef.current = 'PROBLEM';
    setPhase('PROBLEM');
  }, [setPlayerHpBoth, setAtkResultBoth]);

  const challengeAgain = useCallback(() => {
    setPlayerHpBoth(PLAYER_MAX_HP);
    startEnemy(0);
  }, [setPlayerHpBoth, startEnemy]);

  const enemy = ENEMIES[enemyIdx];
  const isLastEnemy = enemyIdx === ENEMIES.length - 1;

  return (
    <>
      {/* Game canvas */}
      <canvas
        ref={cvsRef} width={GW} height={GH}
        onPointerDown={onDodgePointerDown}
        onPointerMove={onDodgePointerMove}
        onPointerUp={onDodgePointerUp}
        onPointerCancel={onDodgePointerUp}
        style={{
          display: 'block',
          border: `3px solid ${C.dlgBdr}`,
          imageRendering: 'pixelated',
          maxWidth: '100%',
          touchAction: 'none',
        }}
      />

      {/* Dialogue box */}
      <div style={dlgStyle}>

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
              color: enemy.boss ? C.orange : C.gold,
              fontSize: 12, letterSpacing: 3,
            }}>
              {enemy.boss
                ? `☠ BOSS FIGHT — ${enemy.name}`
                : `⚔ ENCOUNTER — ${enemy.name} (${enemyIdx + 1}/${ENEMIES.length})`}
              {'  '}[HP {enemyHp}/{enemy.hp}]
            </div>
            <div style={{ fontSize: 14, lineHeight: 1.7 }}>{enemy.flavor}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <span style={{ color: C.gold }}>{prob.a} × {prob.b} =</span>
              <input
                autoFocus
                type="number"
                value={ans}
                onChange={e => { setAns(e.target.value); ansRef.current = e.target.value; }}
                onKeyDown={e => e.key === 'Enter' && ans && submitAnswer()}
                placeholder="?"
                style={inputStyle}
              />
              <button onClick={submitAnswer} style={btnStyle(C.gold, !!ans)}>
                ⚔ ATTACK
              </button>
            </div>
          </div>
        )}

        {/* ── TIMING (timed strike after a correct answer) ── */}
        {phase === 'TIMING' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ color: C.gold, fontSize: 14, letterSpacing: 2 }}>
              ⚔ TIME YOUR STRIKE!
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={strike}
                style={{ ...btnStyle(C.orange, true), fontSize: 18, padding: '10px 28px' }}
              >
                ⚔ STRIKE!
              </button>
            </div>
          </div>
        )}

        {/* ── PLAYER_ATTACK (correct hit or wrong-answer fizzle) ── */}
        {phase === 'PLAYER_ATTACK' && atkResult && (
          <div style={{
            color: atkResult.correct ? C.green : '#ff6060',
            fontSize: 15, letterSpacing: 2,
          }}>
            {atkResult.correct ? `⚔ ${atkResult.msg}` : atkResult.msg}
          </div>
        )}

        {/* ── DODGE ── */}
        {phase === 'DODGE' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ color: C.orange, fontSize: 14, letterSpacing: 2 }}>
              ⚠ {enemy.name} STRIKES BACK!
            </div>
            <div style={{ fontSize: 12, color: '#999' }}>
              Use ↑↓←→ / WASD — or drag anywhere on the screen.
            </div>
          </div>
        )}

        {/* ── VICTORY ── */}
        {phase === 'VICTORY' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ color: C.green, fontSize: 15, letterSpacing: 2 }}>
              ⚔ {enemy.name} is defeated!
            </div>
            <div style={{ fontSize: 13, color: C.gold }}>
              +25 KEY CHARGE · {rewardText(enemy.reward)}
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {isLastEnemy ? (
                <button onClick={sectionClear} style={btnStyle(C.gold, true)}>
                  ⚑ SECTION CLEAR
                </button>
              ) : (
                <button onClick={nextFoe} style={btnStyle(C.green, false)}>
                  NEXT FOE ▶
                </button>
              )}
            </div>
          </div>
        )}

        {/* ── GAME OVER ── */}
        {phase === 'GAME_OVER' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ color: '#ff6060', fontSize: 15, letterSpacing: 2 }}>
              💔 YOUR SOUL SHATTERS!
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button onClick={riseAgain} style={btnStyle('#ff6060', false)}>
                ↺ RISE AGAIN
              </button>
            </div>
          </div>
        )}

        {/* ── CLEAR ── */}
        {phase === 'CLEAR' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ color: C.gold, fontSize: 15, letterSpacing: 2 }}>
              ⚔ THE STONE DUNGEON IS CLEARED! Your math has conquered every foe.
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button onClick={challengeAgain} style={btnStyle(C.gold, true)}>
                ↺ CHALLENGE THE DUNGEON AGAIN
              </button>
            </div>
          </div>
        )}

      </div>
    </>
  );
}
