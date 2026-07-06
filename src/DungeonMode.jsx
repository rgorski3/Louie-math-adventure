import { useState, useEffect, useRef, useCallback } from 'react';
import { C } from './theme';

// ──────────────────────────────────────────────
// DUNGEON MODE — the original math battle concept.
// Per Dungeon_Progression_Specification.md: solve a math problem → attack;
// the enemy ALWAYS attacks and the player dodges a soul avatar in an
// Undertale-style arena box. Correct answer = deal a hit after the dodge;
// wrong answer = no attack that turn (math is non-bypassable: damage only
// ever comes from a correct answer). Session-only progress (no backend).
// ──────────────────────────────────────────────
const GW = 800, GH = 400;

// Dodge arena box
const AX = 280, AY = 150, AW = 240, AH = 180;
const SOUL_SPEED = 165, SOUL_SZ = 10;

// Tunable defaults (recorded in .claude/goals/dungeon-combat-mode.md)
const PLAYER_MAX_HP = 10;
const PROJ_DMG      = 2;
const INVULN_T      = 1.0;   // s of invulnerability after a hit
const GRACE_T       = 0.6;   // s of grace at dodge start
const KEY_THRESHOLD = 100;   // charge per full key
const CHARGE_STD    = 25;    // key charge per standard enemy
const CHARGE_BOSS   = 50;    // key charge per boss
const RESOLVE_MS    = 2100;  // ms the turn-result message stays up
const STD_DODGE_T   = 5.5;   // s dodge phase, standard enemies

// ──────────────────────────────────────────────
// TIER 1 — STONE DUNGEON (skill ladder: tier 1 = multiplication).
// Future tiers per resolved spec: 2 Fire=division, 3 Ice=fractions,
// 4 Poison=decimals/percents, 5 Wind=mixed, secret=Red Eye of Chaos.
// factors: [aLo, aHi, bLo, bHi] for a × b problems.
// ──────────────────────────────────────────────
const TIER1 = {
  tier: 1, name: 'STONE DUNGEON',
  sections: [
    {
      name: 'THE OUTER HALLS',
      factors: [3, 6, 3, 6],
      enemies: [
        { name: 'PEBBLE SPRITE', hp: 2, w: 34, h: 30, eye: C.red, atk: { rockRate: 1.15, rockSpeed: 95 } },
        { name: 'RUBBLE RAT',    hp: 2, w: 42, h: 26, eye: C.tG,  atk: { rockRate: 1.05, rockSpeed: 105 } },
        { name: 'STONE BAT',     hp: 2, w: 46, h: 24, eye: C.red, atk: { rockRate: 1.1,  rockSpeed: 100, pebbleRate: 2.4, pebbleSpeed: 85 } },
        { name: 'CRAG CRAB',     hp: 2, w: 48, h: 28, eye: C.tG,  atk: { rockRate: 0.95, rockSpeed: 110, pebbleRate: 2.2, pebbleSpeed: 95 } },
      ],
      boss: { name: 'STONE SENTINEL', hp: 4, w: 56, h: 62, eye: C.red, factors: [4, 7, 4, 7], dodgeT: 6.5,
              atk: { rockRate: 0.75, rockSpeed: 120, pebbleRate: 1.8, pebbleSpeed: 105 } },
    },
    {
      name: 'THE CRACKED DEPTHS',
      factors: [4, 9, 4, 9],
      enemies: [
        { name: 'SHALE SHADE',   hp: 2, w: 36, h: 34, eye: C.red, atk: { rockRate: 1.0,  rockSpeed: 115 } },
        { name: 'GRIT GHOUL',    hp: 3, w: 40, h: 32, eye: C.tG,  atk: { rockRate: 0.95, rockSpeed: 120 } },
        { name: 'MARBLE MIMIC',  hp: 3, w: 44, h: 28, eye: C.red, atk: { rockRate: 1.0,  rockSpeed: 115, pebbleRate: 2.0, pebbleSpeed: 100 } },
        { name: 'QUARRY QUEEN',  hp: 3, w: 50, h: 30, eye: C.tG,  atk: { rockRate: 0.85, rockSpeed: 125, pebbleRate: 1.9, pebbleSpeed: 110 } },
      ],
      boss: { name: 'ROCK COLOSSUS', hp: 4, w: 60, h: 64, eye: C.red, factors: [5, 9, 5, 9], dodgeT: 6.5,
              atk: { rockRate: 0.65, rockSpeed: 130, pebbleRate: 1.5, pebbleSpeed: 115 } },
    },
    {
      name: "THE GOLEM'S THRONE",
      factors: [6, 12, 6, 12],
      enemies: [
        { name: 'OBSIDIAN OWL',  hp: 3, w: 40, h: 32, eye: C.red, atk: { rockRate: 0.9,  rockSpeed: 125 } },
        { name: 'BASALT BRUTE',  hp: 3, w: 46, h: 36, eye: C.tG,  atk: { rockRate: 0.85, rockSpeed: 130, pebbleRate: 1.9, pebbleSpeed: 110 } },
        { name: 'GRANITE GNAT',  hp: 3, w: 34, h: 26, eye: C.red, atk: { rockRate: 0.8,  rockSpeed: 135, pebbleRate: 1.8, pebbleSpeed: 115 } },
        { name: 'FLINT FIEND',   hp: 3, w: 48, h: 34, eye: C.tG,  atk: { rockRate: 0.8,  rockSpeed: 130, pebbleRate: 1.7, pebbleSpeed: 120 } },
      ],
      // Tier boss — fist slams down through the arena (slow, wide, vertical)
      boss: { name: 'GOLEM', hp: 6, w: 68, h: 72, eye: C.red, factors: [7, 12, 7, 12], dodgeT: 7,
              atk: { fistEvery: 2.4, fistTele: 0.85, fistSpeed: 300, rockRate: 1.6, rockSpeed: 110 } },
    },
  ],
};

function genProb([aLo, aHi, bLo, bHi]) {
  const a = aLo + ~~(Math.random() * (aHi - aLo + 1));
  const b = bLo + ~~(Math.random() * (bHi - bLo + 1));
  return { a, b, ans: a * b };
}

const mkBurst = (x, y, colors, n = 16) =>
  Array.from({ length: n }, (_, i) => ({
    x, y,
    vx: (Math.random() - 0.5) * 220,
    vy: -50 - Math.random() * 220,
    color: colors[i % colors.length],
    life: 1, size: 3 + Math.random() * 7,
  }));

// ──────────────────────────────────────────────
// DRAWING
// ──────────────────────────────────────────────
function drawDungeonBg(ctx) {
  const g = ctx.createLinearGradient(0, 0, 0, GH);
  g.addColorStop(0, '#0a1220'); g.addColorStop(1, C.skyTop);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, GW, GH);
  // sparse brick texture on the walls
  ctx.fillStyle = C.wallDk;
  for (let row = 0; row < 6; row++) {
    for (let col = 0; col < 9; col++) {
      const bx = col * 92 + (row % 2) * 46 - 20;
      const by = row * 66 + 8;
      ctx.globalAlpha = 0.35;
      ctx.fillRect(~~bx, ~~by, 60, 3);
      ctx.fillRect(~~bx + 28, ~~by + 3, 3, 26);
      ctx.globalAlpha = 1;
    }
  }
  // side pillars
  for (const px of [26, GW - 44]) {
    ctx.fillStyle = C.wallDk; ctx.fillRect(px, 40, 18, GH - 80);
    ctx.fillStyle = C.wall;   ctx.fillRect(px, 40, 4, GH - 80);
    ctx.fillStyle = C.gold;   ctx.fillRect(px + 5, 70, 8, 8); // torch ember
  }
}

function drawEnemy(ctx, def, cx, cy, flash) {
  const w = def.w, h = def.h;
  const x = ~~(cx - w / 2), y = ~~(cy - h);
  // body
  ctx.fillStyle = C.wall;   ctx.fillRect(x, y, w, h);
  ctx.fillStyle = C.wallDk; ctx.fillRect(x, y, w, 3);
  ctx.fillStyle = C.wallLt; ctx.fillRect(x, y, 3, h);
  // stubby legs
  ctx.fillStyle = C.wallDk;
  ctx.fillRect(x + 3, ~~cy, 8, 5);
  ctx.fillRect(x + w - 11, ~~cy, 8, 5);
  // eyes + mouth
  const ew = Math.max(5, ~~(w / 6));
  ctx.fillStyle = def.eye;
  ctx.fillRect(~~(cx - w / 4 - ew / 2), y + ~~(h * 0.28), ew, ew);
  ctx.fillRect(~~(cx + w / 4 - ew / 2), y + ~~(h * 0.28), ew, ew);
  ctx.fillStyle = '#000';
  ctx.fillRect(~~(cx - w / 5), y + ~~(h * 0.62), ~~(w / 2.5), 4);
  if (flash > 0) {
    ctx.globalAlpha = Math.min(0.7, flash * 2);
    ctx.fillStyle = '#fff';
    ctx.fillRect(x, y, w, h + 5);
    ctx.globalAlpha = 1;
  }
}

function drawEnemyHud(ctx, name, hp, maxHp, cx, topY) {
  ctx.font = 'bold 11px "Courier New",monospace';
  ctx.fillStyle = C.gold;
  ctx.fillText(name, ~~(cx - name.length * 3.3), topY);
  const bw = 120, bh = 8;
  const bx = ~~(cx - bw / 2), by = topY + 5;
  ctx.fillStyle = C.dlgBdr; ctx.fillRect(bx - 2, by - 2, bw + 4, bh + 4);
  ctx.fillStyle = '#181818'; ctx.fillRect(bx, by, bw, bh);
  ctx.fillStyle = C.red;
  ctx.fillRect(bx, by, ~~(bw * Math.max(0, hp) / maxHp), bh);
}

function drawArena(ctx, tFrac) {
  // timer bar
  ctx.fillStyle = '#181818'; ctx.fillRect(AX, AY - 14, AW, 6);
  ctx.fillStyle = C.gold;    ctx.fillRect(AX, AY - 14, ~~(AW * tFrac), 6);
  // box
  ctx.fillStyle = C.dlgBdr;
  ctx.fillRect(AX - 3, AY - 3, AW + 6, 3);
  ctx.fillRect(AX - 3, AY + AH, AW + 6, 3);
  ctx.fillRect(AX - 3, AY, 3, AH);
  ctx.fillRect(AX + AW, AY, 3, AH);
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(AX, AY, AW, AH);
}

function drawSoul(ctx, x, y, invuln, blink) {
  if (invuln > 0 && blink) return; // flicker while invulnerable
  ctx.fillStyle = '#fff';
  ctx.fillRect(~~x - SOUL_SZ / 2 - 1, ~~y - SOUL_SZ / 2 - 1, SOUL_SZ + 2, SOUL_SZ + 2);
  ctx.fillStyle = C.red;
  ctx.fillRect(~~x - SOUL_SZ / 2, ~~y - SOUL_SZ / 2, SOUL_SZ, SOUL_SZ);
}

function drawProj(ctx, p, t) {
  if (p.type === 'tele') {
    // telegraphed fist column — flashing warning
    ctx.globalAlpha = 0.22 + 0.16 * Math.sin(t * 18);
    ctx.fillStyle = C.red;
    ctx.fillRect(~~p.x, AY, ~~p.w, AH);
    ctx.globalAlpha = 1;
  } else if (p.type === 'fist') {
    const x = ~~p.x, y = ~~p.y;
    ctx.fillStyle = C.wall;   ctx.fillRect(x, y, ~~p.w, ~~p.h);
    ctx.fillStyle = C.wallDk;
    for (let k = 1; k < 4; k++) ctx.fillRect(x + ~~(p.w * k / 4) - 1, y + 4, 2, 14);
    ctx.fillRect(x, y + ~~p.h - 4, ~~p.w, 4);
    ctx.fillStyle = C.wallLt; ctx.fillRect(x, y, ~~p.w, 3);
  } else if (p.type === 'peb') {
    ctx.fillStyle = C.star;
    ctx.fillRect(~~p.x, ~~p.y, ~~p.w, ~~p.h);
  } else { // rock
    ctx.fillStyle = C.wallLt; ctx.fillRect(~~p.x, ~~p.y, ~~p.w, ~~p.h);
    ctx.fillStyle = C.wallDk; ctx.fillRect(~~p.x + 2, ~~p.y + 2, ~~p.w - 4, ~~p.h - 4);
  }
}

function drawPlayerHud(ctx, hp) {
  ctx.font = 'bold 11px "Courier New",monospace';
  ctx.fillStyle = C.gold;
  ctx.fillText('HP', 12, GH - 12);
  const bw = 110, bh = 10, bx = 34, by = GH - 21;
  ctx.fillStyle = C.dlgBdr; ctx.fillRect(bx - 2, by - 2, bw + 4, bh + 4);
  ctx.fillStyle = '#181818'; ctx.fillRect(bx, by, bw, bh);
  ctx.fillStyle = hp <= 4 ? C.orange : C.green;
  ctx.fillRect(bx, by, ~~(bw * Math.max(0, hp) / PLAYER_MAX_HP), bh);
  ctx.fillStyle = C.white;
  ctx.fillText(`${Math.max(0, hp)}/${PLAYER_MAX_HP}`, bx + bw + 8, GH - 12);
}

function drawKeyHud(ctx, keys, charge) {
  ctx.font = 'bold 11px "Courier New",monospace';
  ctx.fillStyle = C.gold;
  ctx.fillText(`KEYS ${keys}`, GW - 170, 20);
  const bw = 80, bh = 8, bx = GW - 105, by = 12;
  ctx.fillStyle = C.dlgBdr; ctx.fillRect(bx - 2, by - 2, bw + 4, bh + 4);
  ctx.fillStyle = '#181818'; ctx.fillRect(bx, by, bw, bh);
  ctx.fillStyle = C.tG;
  ctx.fillRect(bx, by, ~~(bw * Math.min(charge, KEY_THRESHOLD) / KEY_THRESHOLD), bh);
}

function drawMap(ctx, section, sectionIdx, defeated, doorOpen, badges) {
  ctx.font = 'bold 16px "Courier New",monospace';
  ctx.fillStyle = C.gold;
  ctx.fillText(`${TIER1.name} — TIER ${TIER1.tier}`, 250, 60);
  ctx.font = 'bold 13px "Courier New",monospace';
  ctx.fillStyle = C.white;
  ctx.fillText(`SECTION ${sectionIdx + 1}/3 · ${section.name}`, 250, 84);

  // corridor
  ctx.fillStyle = C.wallDk; ctx.fillRect(90, 200, 620, 8);
  // enemy pips
  section.enemies.forEach((e, i) => {
    const px = 130 + i * 100;
    if (i < defeated) {
      ctx.fillStyle = '#181818'; ctx.fillRect(px, 176, 26, 26);
      ctx.fillStyle = C.wallDk;  ctx.fillRect(px + 4, 186, 18, 4);
    } else {
      drawEnemy(ctx, { ...e, w: 26, h: 26 }, px + 13, 202, 0);
    }
    ctx.font = 'bold 9px "Courier New",monospace';
    ctx.fillStyle = i < defeated ? '#555' : C.gold;
    ctx.fillText(i < defeated ? 'DOWN' : 'FOE', px + 1, 222);
  });
  // boss door
  const dx = 560;
  ctx.fillStyle = C.wall;   ctx.fillRect(dx, 130, 90, 78);
  ctx.fillStyle = C.wallDk; ctx.fillRect(dx + 8, 142, 74, 66);
  if (doorOpen) {
    ctx.fillStyle = '#05080d'; ctx.fillRect(dx + 14, 148, 62, 60);
  } else {
    ctx.fillStyle = C.gold;
    ctx.fillRect(dx + 36, 164, 18, 14);
    ctx.fillRect(dx + 41, 156, 8, 10);
  }
  ctx.font = 'bold 10px "Courier New",monospace';
  ctx.fillStyle = doorOpen ? C.green : C.gold;
  ctx.fillText(doorOpen ? 'BOSS DOOR OPEN' : 'BOSS DOOR — NEEDS 1 KEY', dx - 20, 122);
  // badges
  ctx.font = 'bold 10px "Courier New",monospace';
  ctx.fillStyle = C.gold;
  ctx.fillText(`BADGES: ${badges.length}`, 12, GH - 40);
  badges.forEach((_, i) => {
    const bx = 12 + i * 22;
    ctx.fillStyle = C.gold;   ctx.fillRect(bx, GH - 32, 16, 16);
    ctx.fillStyle = C.wallDk; ctx.fillRect(bx + 4, GH - 28, 8, 8);
  });
}

function drawSplash(ctx, title, sub) {
  ctx.font = 'bold 22px "Courier New",monospace';
  ctx.fillStyle = C.gold;
  ctx.fillText(title, ~~(GW / 2 - title.length * 6.6), 170);
  ctx.font = 'bold 13px "Courier New",monospace';
  ctx.fillStyle = C.white;
  ctx.fillText(sub, ~~(GW / 2 - sub.length * 3.9), 200);
  // badge shield
  ctx.fillStyle = C.gold;   ctx.fillRect(~~(GW / 2 - 20), 226, 40, 40);
  ctx.fillStyle = C.wallDk; ctx.fillRect(~~(GW / 2 - 10), 236, 20, 20);
}

// ──────────────────────────────────────────────
// COMPONENT
// ──────────────────────────────────────────────
export default function DungeonMode() {
  const cvsRef  = useRef(null);
  const rafRef  = useRef(null);
  const tsRef   = useRef(null);
  const toRef   = useRef(null);

  // Mutable per-frame data (read by the rAF loop) lives in refs
  const screenRef   = useRef('MAP');       // MAP | COMBAT | SECTION_CLEAR | TIER_CLEAR | DEFEAT
  const phaseRef    = useRef('PROBLEM');   // combat sub-phase: PROBLEM | DODGE | RESOLVE
  const sectionRef  = useRef(0);
  const defeatedRef = useRef(0);
  const doorRef     = useRef(false);
  const fightRef    = useRef(null);        // { def, isBoss, maxHp, dodgeT, factors }
  const probRef     = useRef(null);
  const ansRef      = useRef('');
  const correctRef  = useRef(false);
  const playerHpRef = useRef(PLAYER_MAX_HP);
  const enemyHpRef  = useRef(0);
  const keysNumRef  = useRef(0);
  const chargeRef   = useRef(0);
  const soulRef     = useRef({ x: AX + AW / 2, y: AY + AH * 0.7 });
  const projsRef    = useRef([]);
  const turnRef     = useRef(null);        // { tLeft, total, t, accRock, accPeb, accFist }
  const invulnRef   = useRef(0);
  const flashRef    = useRef(0);
  const ptclsRef    = useRef([]);
  const keysDownRef = useRef(new Set());
  const badgesRef   = useRef([]);

  // React state mirrors for the UI
  const [screen,   setScreen]   = useState('MAP');
  const [phase,    setPhase]    = useState('PROBLEM');
  const [sectionIdx, setSectionIdx] = useState(0);
  const [defeated, setDefeated] = useState(0);
  const [doorOpen, setDoorOpen] = useState(false);
  const [fight,    setFight]    = useState(null); // { name, maxHp, isBoss }
  const [prob,     setProb]     = useState(null);
  const [ans,      setAns]      = useState('');
  const [playerHp, setPlayerHp] = useState(PLAYER_MAX_HP);
  const [enemyHp,  setEnemyHp]  = useState(0);
  const [keysNum,  setKeysNum]  = useState(0);
  const [charge,   setCharge]   = useState(0);
  const [badges,   setBadges]   = useState([]);
  const [msg,      setMsg]      = useState('');

  const setScreenBoth = useCallback(v => { screenRef.current = v; setScreen(v); }, []);
  const setPhaseBoth  = useCallback(v => { phaseRef.current = v; setPhase(v); }, []);

  // ── Turn / fight orchestration (handlers + loop callbacks) ──
  const newTurn = useCallback(() => {
    const f = fightRef.current;
    const p = genProb(f.factors);
    probRef.current = p; setProb(p);
    ansRef.current = ''; setAns('');
    correctRef.current = false;
    setPhaseBoth('PROBLEM');
  }, [setPhaseBoth]);

  const startFight = useCallback((def, isBoss) => {
    fightRef.current = {
      def, isBoss,
      maxHp: def.hp,
      dodgeT: def.dodgeT ?? STD_DODGE_T,
      factors: def.factors ?? TIER1.sections[sectionRef.current].factors,
    };
    setFight({ name: def.name, maxHp: def.hp, isBoss });
    playerHpRef.current = PLAYER_MAX_HP; setPlayerHp(PLAYER_MAX_HP);
    enemyHpRef.current  = def.hp;        setEnemyHp(def.hp);
    projsRef.current = [];
    ptclsRef.current = [];
    setMsg('');
    setScreenBoth('COMBAT');
    newTurn();
  }, [newTurn, setScreenBoth]);

  const handleAttack = useCallback(() => {
    const given = parseInt(ansRef.current, 10);
    correctRef.current = !Number.isNaN(given) && given === probRef.current.ans;
    soulRef.current = { x: AX + AW / 2, y: AY + AH * 0.7 };
    projsRef.current = [];
    invulnRef.current = GRACE_T;
    turnRef.current = {
      tLeft: fightRef.current.dodgeT, total: fightRef.current.dodgeT,
      t: 0, accRock: 0, accPeb: 0, accFist: 0,
    };
    setPhaseBoth('DODGE');
  }, [setPhaseBoth]);

  const fightNext = useCallback(() => {
    const sec = TIER1.sections[sectionRef.current];
    startFight(sec.enemies[defeatedRef.current], false);
  }, [startFight]);

  const openBossDoor = useCallback(() => {
    if (doorRef.current) {
      startFight(TIER1.sections[sectionRef.current].boss, true);
      return;
    }
    if (keysNumRef.current < 1) return;
    keysNumRef.current -= 1; setKeysNum(keysNumRef.current);
    doorRef.current = true; setDoorOpen(true);
    startFight(TIER1.sections[sectionRef.current].boss, true);
  }, [startFight]);

  const retryFight = useCallback(() => {
    const f = fightRef.current;
    startFight(f.def, f.isBoss);
  }, [startFight]);

  const fleeToMap = useCallback(() => {
    setScreenBoth('MAP');
  }, [setScreenBoth]);

  const nextSection = useCallback(() => {
    sectionRef.current += 1; setSectionIdx(sectionRef.current);
    defeatedRef.current = 0; setDefeated(0);
    doorRef.current = false; setDoorOpen(false);
    setScreenBoth('MAP');
  }, [setScreenBoth]);

  const replayTier = useCallback(() => {
    sectionRef.current = 0; setSectionIdx(0);
    defeatedRef.current = 0; setDefeated(0);
    doorRef.current = false; setDoorOpen(false);
    setScreenBoth('MAP');
  }, [setScreenBoth]);

  // ── Keyboard (dodge movement) ──
  useEffect(() => {
    const KEYS = ['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'w', 'a', 's', 'd'];
    const down = e => {
      const k = e.key.toLowerCase();
      if (KEYS.includes(k)) {
        if (phaseRef.current === 'DODGE') e.preventDefault();
        keysDownRef.current.add(k);
      }
    };
    const up = e => keysDownRef.current.delete(e.key.toLowerCase());
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, []);

  // ── Animation + game loop ──
  useEffect(() => {
    const canvas = cvsRef.current;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;

    // resolve the turn once the dodge timer runs out
    function resolveTurn() {
      const f = fightRef.current;
      projsRef.current = [];
      if (!correctRef.current) {
        const given = ansRef.current === '' ? 'No answer' : ansRef.current;
        setMsg(`❌ ${given} — the answer was ${probRef.current.ans}. Your attack fizzles! Dodge and try again.`);
        setPhaseBoth('RESOLVE');
        toRef.current = setTimeout(newTurn, RESOLVE_MS);
        return;
      }
      // correct → deal a hit
      enemyHpRef.current -= 1; setEnemyHp(enemyHpRef.current);
      flashRef.current = 0.5;
      ptclsRef.current = ptclsRef.current.concat(mkBurst(GW / 2, 110, [C.gold, C.proj]));
      if (enemyHpRef.current > 0) {
        setMsg(`💥 ${probRef.current.a} × ${probRef.current.b} = ${probRef.current.ans} — correct! You strike ${f.def.name}!`);
        setPhaseBoth('RESOLVE');
        toRef.current = setTimeout(newTurn, RESOLVE_MS);
        return;
      }
      // enemy defeated
      const drop = f.isBoss ? CHARGE_BOSS : CHARGE_STD;
      chargeRef.current += drop;
      let forged = '';
      while (chargeRef.current >= KEY_THRESHOLD) {
        chargeRef.current -= KEY_THRESHOLD;
        keysNumRef.current += 1;
        forged = ' 🗝 A KEY IS FORGED!';
      }
      setCharge(chargeRef.current);
      setKeysNum(keysNumRef.current);
      ptclsRef.current = ptclsRef.current.concat(mkBurst(GW / 2, 110, [C.gold, C.tG], 26));
      setPhaseBoth('RESOLVE');
      if (f.isBoss) {
        const last = sectionRef.current >= TIER1.sections.length - 1;
        setMsg(`⚔ ${f.def.name} DEFEATED! +${drop} key charge.${forged}`);
        toRef.current = setTimeout(() => {
          setScreenBoth(last ? 'TIER_CLEAR' : 'SECTION_CLEAR');
          badgesRef.current = [...badgesRef.current, TIER1.sections[sectionRef.current].name];
          setBadges(badgesRef.current);
        }, RESOLVE_MS);
      } else {
        defeatedRef.current += 1; setDefeated(defeatedRef.current);
        setMsg(`⚔ ${f.def.name} DEFEATED! +${drop} key charge.${forged}`);
        toRef.current = setTimeout(() => setScreenBoth('MAP'), RESOLVE_MS);
      }
    }

    function updateDodge(dt) {
      const turn = turnRef.current;
      const atk  = fightRef.current.def.atk;
      turn.t += dt;

      // soul movement
      const kd = keysDownRef.current;
      const dx = (kd.has('arrowright') || kd.has('d') ? 1 : 0) - (kd.has('arrowleft') || kd.has('a') ? 1 : 0);
      const dy = (kd.has('arrowdown') || kd.has('s') ? 1 : 0) - (kd.has('arrowup') || kd.has('w') ? 1 : 0);
      const s = soulRef.current;
      const norm = dx && dy ? 0.7071 : 1;
      s.x = Math.max(AX + SOUL_SZ / 2, Math.min(AX + AW - SOUL_SZ / 2, s.x + dx * SOUL_SPEED * norm * dt));
      s.y = Math.max(AY + SOUL_SZ / 2, Math.min(AY + AH - SOUL_SZ / 2, s.y + dy * SOUL_SPEED * norm * dt));

      // spawn attacks
      const projs = projsRef.current;
      if (atk.rockRate) {
        turn.accRock += dt;
        while (turn.accRock >= atk.rockRate) {
          turn.accRock -= atk.rockRate;
          const sz = 10 + ~~(Math.random() * 6);
          projs.push({ type: 'rock', x: AX + Math.random() * (AW - sz), y: AY - sz - 2, w: sz, h: sz,
                       vy: atk.rockSpeed * (0.85 + Math.random() * 0.3), vx: 0 });
        }
      }
      if (atk.pebbleRate) {
        turn.accPeb += dt;
        while (turn.accPeb >= atk.pebbleRate) {
          turn.accPeb -= atk.pebbleRate;
          const fromLeft = Math.random() < 0.5;
          projs.push({ type: 'peb', x: fromLeft ? AX - 10 : AX + AW + 2, y: AY + 10 + Math.random() * (AH - 20),
                       w: 9, h: 9, vx: (fromLeft ? 1 : -1) * atk.pebbleSpeed, vy: 0 });
        }
      }
      if (atk.fistEvery) {
        turn.accFist += dt;
        if (turn.accFist >= atk.fistEvery) {
          turn.accFist -= atk.fistEvery;
          const w = 84;
          projs.push({ type: 'tele', x: AX + Math.random() * (AW - w), w, tele: atk.fistTele });
        }
      }

      // move / evolve projectiles
      for (const p of projs) {
        if (p.type === 'tele') {
          p.tele -= dt;
          if (p.tele <= 0) {
            p.type = 'fist';
            p.y = AY - 60; p.h = 56; p.vy = atk.fistSpeed; p.vx = 0;
          }
        } else {
          p.x += (p.vx ?? 0) * dt;
          p.y += (p.vy ?? 0) * dt;
        }
      }
      projsRef.current = projs.filter(p =>
        p.type === 'tele' ||
        (p.y ?? 0) < AY + AH + 30 && p.x > AX - 30 && p.x < AX + AW + 30
      );

      // collisions
      invulnRef.current = Math.max(0, invulnRef.current - dt);
      if (invulnRef.current <= 0 && playerHpRef.current > 0) {
        for (const p of projsRef.current) {
          if (p.type === 'tele') continue;
          if (s.x + SOUL_SZ / 2 > p.x && s.x - SOUL_SZ / 2 < p.x + p.w &&
              s.y + SOUL_SZ / 2 > p.y && s.y - SOUL_SZ / 2 < p.y + p.h) {
            playerHpRef.current -= PROJ_DMG;
            setPlayerHp(playerHpRef.current);
            invulnRef.current = INVULN_T;
            ptclsRef.current = ptclsRef.current.concat(mkBurst(s.x, s.y, [C.red, C.orange], 10));
            if (playerHpRef.current <= 0) {
              projsRef.current = [];
              setMsg(`💀 ${fightRef.current.def.name} overwhelmed you...`);
              setScreenBoth('DEFEAT');
              return;
            }
            break;
          }
        }
      }

      // timer
      turn.tLeft -= dt;
      if (turn.tLeft <= 0) resolveTurn();
    }

    function loop(ts) {
      const dt = Math.min((ts - (tsRef.current ?? ts)) / 1000, 0.05);
      tsRef.current = ts;
      const scr = screenRef.current;

      // particles
      for (const p of ptclsRef.current) {
        p.x += p.vx * dt; p.y += p.vy * dt;
        p.vy += 290 * dt; p.life -= dt * 1.9;
      }
      ptclsRef.current = ptclsRef.current.filter(p => p.life > 0);
      flashRef.current = Math.max(0, flashRef.current - dt);

      if (scr === 'COMBAT' && phaseRef.current === 'DODGE') updateDodge(dt);

      // expose live dodge state for the dev-only test driver
      if (import.meta.env.DEV) {
        window.__dd = {
          screen: scr, phase: phaseRef.current,
          soul: { ...soulRef.current },
          projs: projsRef.current.map(p => ({ ...p })),
        };
      }

      // ── draw ──
      ctx.clearRect(0, 0, GW, GH);
      drawDungeonBg(ctx);

      if (scr === 'MAP') {
        drawMap(ctx, TIER1.sections[sectionRef.current], sectionRef.current,
                defeatedRef.current, doorRef.current, badgesRef.current);
        drawKeyHud(ctx, keysNumRef.current, chargeRef.current);
      } else if (scr === 'COMBAT' || scr === 'DEFEAT') {
        const f = fightRef.current;
        drawEnemy(ctx, f.def, GW / 2, 118, flashRef.current);
        drawEnemyHud(ctx, f.def.name, enemyHpRef.current, f.maxHp, GW / 2, 32);
        drawKeyHud(ctx, keysNumRef.current, chargeRef.current);
        drawPlayerHud(ctx, playerHpRef.current);
        if (phaseRef.current === 'DODGE' && scr === 'COMBAT') {
          const turn = turnRef.current;
          drawArena(ctx, Math.max(0, turn.tLeft) / turn.total);
          for (const p of projsRef.current) drawProj(ctx, p, turn.t);
          drawSoul(ctx, soulRef.current.x, soulRef.current.y,
                   invulnRef.current, ~~(turn.t * 14) % 2 === 0);
        }
        if (scr === 'DEFEAT') {
          ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(0, 0, GW, GH);
          ctx.font = 'bold 24px "Courier New",monospace';
          ctx.fillStyle = C.red;
          ctx.fillText('YOU FELL...', ~~(GW / 2 - 66), ~~(GH / 2));
        }
      } else if (scr === 'SECTION_CLEAR') {
        drawSplash(ctx, 'SECTION CLEAR!', `Badge earned: ${TIER1.sections[sectionRef.current].name}`);
        drawKeyHud(ctx, keysNumRef.current, chargeRef.current);
      } else if (scr === 'TIER_CLEAR') {
        drawSplash(ctx, 'STONE DUNGEON CLEARED!', 'The GOLEM has fallen. Tier 2 — the FIRE DUNGEON — awaits...');
        drawKeyHud(ctx, keysNumRef.current, chargeRef.current);
      }

      // particles on top
      for (const p of ptclsRef.current) {
        if (p.life <= 0) continue;
        ctx.globalAlpha = Math.max(0, p.life);
        ctx.fillStyle = p.color;
        const sz = Math.max(1, ~~p.size);
        ctx.fillRect(~~p.x - ~~(sz / 2), ~~p.y - ~~(sz / 2), sz, sz);
      }
      ctx.globalAlpha = 1;

      rafRef.current = requestAnimationFrame(loop);
    }

    rafRef.current = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(rafRef.current);
      clearTimeout(toRef.current);
    };
  }, [newTurn, setPhaseBoth, setScreenBoth]);

  // ── Styles (match MathKingdom) ──
  const dlg = {
    background: C.dlgBg,
    border: `4px solid ${C.dlgBdr}`,
    width: GW, maxWidth: '100%',
    padding: '14px 22px', minHeight: 96,
    fontFamily: '"Courier New", monospace',
    color: C.white, boxSizing: 'border-box',
  };
  const btn = (col, filled) => ({
    background: filled ? col : 'transparent',
    border: `2px solid ${col}`, color: filled ? '#000' : col,
    fontFamily: '"Courier New", monospace', fontWeight: 'bold',
    fontSize: 13, padding: '5px 15px', cursor: 'pointer', letterSpacing: 1,
  });

  const section = TIER1.sections[sectionIdx];
  const hudLine = fight
    ? `YOUR HP ${Math.max(0, playerHp)}/${PLAYER_MAX_HP} · ${fight.name} HP ${Math.max(0, enemyHp)}/${fight.maxHp} · KEYS ${keysNum} · CHARGE ${charge}%`
    : `KEYS ${keysNum} · CHARGE ${charge}%`;

  return (
    <div style={{
      background: '#060d14', minHeight: '100vh',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      userSelect: 'none', gap: 0,
    }}>
      <div style={{
        color: C.gold, fontFamily: '"Courier New", monospace',
        fontSize: 20, fontWeight: 'bold', letterSpacing: 5,
        marginBottom: 6, textShadow: `0 0 12px ${C.gold}`,
      }}>
        🏰 MATH KINGDOM — DUNGEON 🏰
      </div>

      <canvas
        ref={cvsRef} width={GW} height={GH}
        style={{
          display: 'block',
          border: `3px solid ${C.dlgBdr}`,
          imageRendering: 'pixelated',
          maxWidth: '100%',
        }}
      />

      <div style={dlg}>
        {/* ── MAP ── */}
        {screen === 'MAP' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ color: C.gold, fontSize: 12, letterSpacing: 3 }}>
              🏰 {TIER1.name} — SECTION {sectionIdx + 1}/3: {section.name}
            </div>
            <div style={{ fontSize: 13, color: '#bbb' }}>
              {defeated < section.enemies.length
                ? `Defeat all ${section.enemies.length} foes to charge your key (${defeated} down). ${hudLine}`
                : doorOpen
                  ? `The boss door stands open. ${hudLine}`
                  : `All foes are down! Use a key to open the boss door. ${hudLine}`}
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {defeated < section.enemies.length && (
                <button onClick={fightNext} style={btn(C.gold, true)}>
                  ⚔ FIGHT {section.enemies[defeated].name} ▶
                </button>
              )}
              {defeated >= section.enemies.length && (
                <button
                  onClick={openBossDoor}
                  disabled={!doorOpen && keysNum < 1}
                  style={{ ...btn(C.orange, doorOpen || keysNum >= 1),
                           opacity: !doorOpen && keysNum < 1 ? 0.4 : 1 }}
                >
                  {doorOpen ? `☠ FIGHT ${section.boss.name} ▶` : `🗝 UNLOCK BOSS DOOR (1 KEY)`}
                </button>
              )}
            </div>
          </div>
        )}

        {/* ── COMBAT: PROBLEM ── */}
        {screen === 'COMBAT' && phase === 'PROBLEM' && prob && fight && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ color: fight.isBoss ? C.orange : C.gold, fontSize: 12, letterSpacing: 3 }}>
              {fight.isBoss ? '☠ BOSS' : '⚔ BATTLE'} — {fight.name} · {hudLine}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 14 }}>Solve to power your strike:</span>
              <span style={{ color: C.gold, fontSize: 18 }}>{prob.a} × {prob.b} =</span>
              <input
                autoFocus
                type="number"
                value={ans}
                onChange={e => { setAns(e.target.value); ansRef.current = e.target.value; }}
                onKeyDown={e => e.key === 'Enter' && handleAttack()}
                placeholder="?"
                style={{
                  background: '#111', border: `2px solid ${C.gold}`,
                  color: C.gold, fontFamily: '"Courier New", monospace',
                  fontSize: 20, padding: '3px 10px', width: 95, outline: 'none',
                }}
              />
              <button onClick={handleAttack} style={btn(C.orange, true)}>
                ⚔ ATTACK!
              </button>
            </div>
            <div style={{ fontSize: 11, color: '#777' }}>
              The enemy attacks either way — get ready to dodge with ARROW KEYS / WASD!
            </div>
          </div>
        )}

        {/* ── COMBAT: DODGE ── */}
        {screen === 'COMBAT' && phase === 'DODGE' && (
          <div style={{ color: C.orange, fontSize: 15, letterSpacing: 2 }}>
            ⚠ DODGE! — move your soul with ARROW KEYS / WASD
          </div>
        )}

        {/* ── COMBAT: RESOLVE ── */}
        {screen === 'COMBAT' && phase === 'RESOLVE' && (
          <div style={{
            fontSize: 14, lineHeight: 1.6,
            color: msg.startsWith('❌') ? '#ff6060' : C.green,
          }}>
            {msg} <span style={{ color: '#777' }}>· {hudLine}</span>
          </div>
        )}

        {/* ── DEFEAT ── */}
        {screen === 'DEFEAT' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ color: C.red, fontSize: 14 }}>{msg} But heroes get back up!</div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={retryFight} style={btn(C.gold, false)}>↺ TRY AGAIN</button>
              <button onClick={fleeToMap} style={btn('#aaa', false)}>🏃 BACK TO MAP</button>
            </div>
          </div>
        )}

        {/* ── SECTION CLEAR ── */}
        {screen === 'SECTION_CLEAR' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ color: C.green, fontSize: 14 }}>
              🛡 SECTION CLEAR! Badge earned: {section.name}. {hudLine}
            </div>
            <button onClick={nextSection} style={btn(C.green, false)}>
              NEXT SECTION ▶
            </button>
          </div>
        )}

        {/* ── TIER CLEAR ── */}
        {screen === 'TIER_CLEAR' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ color: C.gold, fontSize: 14 }}>
              ⚔ STONE DUNGEON CLEARED! You earned {badges.length} badge{badges.length === 1 ? '' : 's'}.
              The FIRE DUNGEON (division!) is coming soon...
            </div>
            <button onClick={replayTier} style={btn(C.gold, true)}>
              ↺ REPLAY STONE DUNGEON
            </button>
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
