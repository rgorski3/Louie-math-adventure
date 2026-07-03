import { useState, useEffect, useRef, useCallback } from 'react';

// ── Layout ──────────────────────────────────────
const CW = 800, CH = 480;
const HP_BAR_Y = 10;
const BOSS_CX = 400, BOSS_CY = 118;
const ARENA_X = 220, ARENA_Y = 215, ARENA_W = 360, ARENA_H = 235;
const SOUL_SPEED = 195;
const SOUL_R = 5;
const DODGE_MS = 5500;

// ── Colors ──────────────────────────────────────
const C = {
  gold: '#e8a020', white: '#ffffff', border: '#f5e6c8',
  heart: '#ff0044', green: '#40d060', red: '#ff2020',
  gray: '#444',
};

const ROYGBIV = ['#ff0000','#ff7700','#ffff00','#00cc00','#0066ff','#4400bb','#9900cc'];
const ROYGBIV_NAMES = ['Red','Orange','Yellow','Green','Blue','Indigo','Violet'];

// ── Math generators ─────────────────────────────
const GEN = {
  mult_easy() {
    const a = 2 + ~~(Math.random() * 4);
    const b = 1 + ~~(Math.random() * 9);
    return { q: `${a} × ${b}`, ans: a * b };
  },
  mult_hard() {
    const a = 6 + ~~(Math.random() * 7);
    const b = 6 + ~~(Math.random() * 7);
    return { q: `${a} × ${b}`, ans: a * b };
  },
  division() {
    const b = 2 + ~~(Math.random() * 9);
    const q = 2 + ~~(Math.random() * 9);
    return { q: `${b * q} ÷ ${b}`, ans: q };
  },
  mixed_ops() {
    const x = 2 + ~~(Math.random() * 7);
    const y = 2 + ~~(Math.random() * 5);
    const z = 1 + ~~(Math.random() * 10);
    if (Math.random() < 0.5)
      return { q: `${x} × ${y} + ${z}`, ans: x * y + z };
    const sub = x * y - z;
    return sub > 0
      ? { q: `${x} × ${y} − ${z}`, ans: sub }
      : { q: `${x} × ${y} + ${z}`, ans: x * y + z };
  },
  ratio() {
    const a = 2 + ~~(Math.random() * 5);
    const b = 3 + ~~(Math.random() * 7);
    const m = 2 + ~~(Math.random() * 4);
    return { q: `If ${a} × ${b} = ${a * b}, what is ${a} × ${b * m}?`, ans: a * b * m };
  },
  mixed() {
    const keys = ['mult_easy', 'mult_hard', 'division', 'mixed_ops'];
    return GEN[keys[~~(Math.random() * keys.length)]]();
  },
};

// ── Boss definitions ────────────────────────────
const BOSSES = [
  {
    id: 'gargoyle', tier: 1, name: 'GARGOYLE KING', dungeon: 'Stone Dungeon',
    color: '#9a9a9a', bgDark: '#100c0c',
    maxHp: 8, mathGen: 'mult_easy',
    trophy: 'Stone Crest', trophyIcon: '🪨',
    keyName: 'Ember Key', keyColor: '#ff6600',
    attacks: ['stone_rain', 'stone_wall', 'stone_slab'],
    flavor: 'A stone colossus that has guarded this crypt for a thousand years.',
  },
  {
    id: 'drake', tier: 2, name: 'INFERNO DRAKE', dungeon: 'Fire Dungeon',
    color: '#ff6600', bgDark: '#120700',
    maxHp: 10, mathGen: 'mult_hard',
    trophy: 'Ember Crown', trophyIcon: '🔥',
    keyName: 'Frost Key', keyColor: '#66ccff',
    attacks: ['fire_stream', 'fire_burst', 'fire_wall'],
    flavor: 'Its scales glow like molten rock. The air shimmers with heat.',
  },
  {
    id: 'specter', tier: 3, name: 'GLACIAL SPECTER', dungeon: 'Ice Dungeon',
    color: '#88ccff', bgDark: '#00060e',
    maxHp: 12, mathGen: 'division',
    trophy: 'Ice Shard', trophyIcon: '❄️',
    keyName: 'Venom Key', keyColor: '#44cc44',
    attacks: ['ice_shards', 'ice_wall', 'ice_spiral'],
    flavor: 'It drifts silently. Where it passes, frost forms on the stone.',
  },
  {
    id: 'hydra', tier: 4, name: 'VENOM HYDRA', dungeon: 'Poison Dungeon',
    color: '#44cc44', bgDark: '#001100',
    maxHp: 14, mathGen: 'mixed_ops',
    trophy: 'Venom Fang', trophyIcon: '☠️',
    keyName: 'Gale Key', keyColor: '#aaddff',
    attacks: ['poison_ring', 'poison_trail', 'poison_burst'],
    flavor: 'Three heads, each thinking separately. Each equally cruel.',
  },
  {
    id: 'sovereign', tier: 5, name: 'STORM SOVEREIGN', dungeon: 'Wind Dungeon',
    color: '#aaddff', bgDark: '#030310',
    maxHp: 16, mathGen: 'ratio',
    trophy: 'Wind Seal', trophyIcon: '🌀',
    keyName: 'Chaos Key', keyColor: '#cc0000',
    attacks: ['wind_spiral', 'wind_cross', 'wind_swarm'],
    flavor: 'The dungeon shakes. Thunder without clouds. Wind without air.',
  },
  {
    id: 'red_eye', tier: 6, name: 'RED EYE OF CHAOS', dungeon: 'The Final Trial',
    color: '#ff0000', bgDark: '#090000',
    maxHp: 12, phase2Hp: 12, mathGen: 'mixed',
    trophy: 'Chaos Fragment', trophyIcon: '👁️',
    keyName: null, keyColor: null,
    attacks: ['chaos_slash', 'chaos_storm', 'chaos_beam', 'chaos_rain'],
    flavor: 'A figure steps from the eye of the storm. One hand holds a katana. One eye burns red.',
    unlockAt: 1000,
  },
];

// ── Attack pattern spawner ──────────────────────
function spawnWave(attackType) {
  const ax = ARENA_X, ay = ARENA_Y, aw = ARENA_W, ah = ARENA_H;
  const b = [];

  const rnd = (lo, hi) => lo + Math.random() * (hi - lo);
  const ring = (n, cx, cy, spd, color, r = 8) => {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      b.push({ x: cx, y: cy, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd, color, r });
    }
  };

  switch (attackType) {
    case 'stone_rain':
      for (let i = 0; i < 6; i++)
        b.push({ x: rnd(ax + 20, ax + aw - 20), y: ay - 12, vx: 0, vy: rnd(80, 110), color: '#888', r: 9 });
      break;
    case 'stone_wall':
      for (let i = 0; i < 7; i++)
        b.push({ x: ax + i * (aw / 7) + 16, y: ay - 8, vx: 0, vy: 65, color: '#6a6a6a', r: 8 });
      break;
    case 'stone_slab':
      b.push({ x: ax + aw / 2, y: ay - 24, vx: 0, vy: 50, color: '#aaa', r: 22 });
      break;

    case 'fire_stream':
      for (let i = 0; i < 3; i++) {
        const y = ay + 25 + i * 70;
        b.push({ x: ax - 12, y, vx: 120, vy: 0, color: '#ff4400', r: 8 });
        b.push({ x: ax + aw + 12, y: y + 35, vx: -120, vy: 0, color: '#ff6600', r: 8 });
      }
      break;
    case 'fire_burst':
      ring(8, ax + aw / 2, ay + 20, 90, '#ff3300', 7);
      break;
    case 'fire_wall':
      for (let i = 0; i < 6; i++)
        b.push({ x: ax - 12, y: ay + i * (ah / 6) + 18, vx: 105, vy: 0, color: '#ff5500', r: 9 });
      break;

    case 'ice_shards':
      [[ax, ay], [ax + aw, ay], [ax, ay + ah], [ax + aw, ay + ah]].forEach(([px, py]) => {
        const dx = ax + aw / 2 - px, dy = ay + ah / 2 - py;
        const L = Math.hypot(dx, dy);
        b.push({ x: px, y: py, vx: (dx / L) * 85, vy: (dy / L) * 85, color: '#88ccff', r: 8 });
      });
      break;
    case 'ice_wall':
      for (let i = 0; i < 5; i++)
        b.push({ x: ax + aw + 12, y: ay + 20 + i * (ah / 5), vx: -75, vy: 0, color: '#aaddff', r: 10 });
      break;
    case 'ice_spiral': {
      const t = Date.now() / 1000;
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + t;
        b.push({ x: ax + aw / 2, y: ay + 20, vx: Math.cos(a) * 80, vy: Math.sin(a) * 80, color: '#66aaff', r: 7 });
      }
      break;
    }

    case 'poison_ring':
      ring(10, ax + aw / 2, ay + 20, 70, '#44cc44', 9);
      break;
    case 'poison_trail':
      [-1, 0, 1].forEach(dx =>
        b.push({ x: ax + aw / 2, y: ay - 12, vx: dx * 55, vy: 75, color: '#22aa22', r: 8 }));
      break;
    case 'poison_burst':
      ring(12, ax + aw / 2, ay + ah / 2, 105, '#00ee00', 6);
      break;

    case 'wind_spiral': {
      const t = Date.now() / 1000;
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2 + t;
        b.push({ x: ax + aw / 2, y: ay + 20, vx: Math.cos(a) * 100, vy: Math.sin(a) * 100, color: '#aaddff', r: 7 });
      }
      break;
    }
    case 'wind_cross':
      for (let i = -1; i <= 1; i++) {
        const y = ay + ah / 2 + i * 55;
        b.push({ x: ax - 12, y, vx: 115, vy: 0, color: '#88ccff', r: 7 });
        b.push({ x: ax + aw + 12, y: y + 25, vx: -115, vy: 0, color: '#88ccff', r: 7 });
      }
      break;
    case 'wind_swarm':
      for (let i = 0; i < 7; i++) {
        const edge = ~~(Math.random() * 4);
        let bx, by, bvx, bvy;
        if (edge === 0) { bx = rnd(ax, ax + aw); by = ay - 12; bvx = rnd(-25, 25); bvy = rnd(85, 115); }
        else if (edge === 1) { bx = ax + aw + 12; by = rnd(ay, ay + ah); bvx = -rnd(85, 115); bvy = rnd(-25, 25); }
        else if (edge === 2) { bx = rnd(ax, ax + aw); by = ay + ah + 12; bvx = rnd(-25, 25); bvy = -rnd(85, 115); }
        else { bx = ax - 12; by = rnd(ay, ay + ah); bvx = rnd(85, 115); bvy = rnd(-25, 25); }
        b.push({ x: bx, y: by, vx: bvx, vy: bvy, color: '#cceeff', r: 6 });
      }
      break;

    case 'chaos_slash':
      for (let i = 0; i < 4; i++) {
        const y = ay + 20 + i * (ah / 4);
        b.push({ x: ax - 12, y, vx: 155, vy: 0, color: '#ff0000', r: 12 });
        b.push({ x: ax + aw + 12, y: y + 22, vx: -155, vy: 0, color: '#cc0000', r: 12 });
      }
      break;
    case 'chaos_storm':
      ring(12, ax + aw / 2, ay + ah / 2, 115, '#ff0000', 8);
      break;
    case 'chaos_beam':
      for (let i = 0; i < 3; i++)
        b.push({ x: ax + 60 + i * 120, y: ay - 12, vx: 0, vy: 135, color: '#ff0000', r: i === 1 ? 18 : 10 });
      break;
    case 'chaos_rain':
      for (let i = 0; i < 10; i++)
        b.push({ x: rnd(ax + 20, ax + aw - 20), y: ay - 12 - Math.random() * 30,
          vx: rnd(-15, 15), vy: rnd(110, 150), color: '#ff2200', r: 7 });
      break;
  }
  return b;
}

// ── Pixel-art boss sprites ──────────────────────
function drawBoss(ctx, boss, t, bossPhase, roygbivIdx, immune) {
  const cx = BOSS_CX, cy = BOSS_CY;
  switch (boss.id) {
    case 'gargoyle':  drawGargoyle(ctx, cx, cy, t); break;
    case 'drake':     drawDrake(ctx, cx, cy, t); break;
    case 'specter':   drawSpecter(ctx, cx, cy, t); break;
    case 'hydra':     drawHydra(ctx, cx, cy, t); break;
    case 'sovereign': drawSovereign(ctx, cx, cy, t); break;
    case 'red_eye':   drawRedEye(ctx, cx, cy, t, bossPhase, roygbivIdx, immune); break;
  }
}

function px(ctx, x, y, w, h, color) {
  ctx.fillStyle = color; ctx.fillRect(~~x, ~~y, w, h);
}

function drawGargoyle(ctx, cx, cy, t) {
  const dy = Math.sin(t * 1.5) * 2;
  const y = cy + dy;
  px(ctx, cx - 50, y - 22, 34, 38, '#555'); // wings L
  px(ctx, cx + 16, y - 22, 34, 38, '#555'); // wings R
  px(ctx, cx - 54, y - 2, 20, 22, '#444');
  px(ctx, cx + 34, y - 2, 20, 22, '#444');
  px(ctx, cx - 20, y - 28, 40, 52, '#777'); // body
  px(ctx, cx - 16, y - 54, 32, 28, '#888'); // head
  px(ctx, cx - 14, y - 68, 6, 16, '#666'); // horn L
  px(ctx, cx + 8, y - 68, 6, 16, '#666');  // horn R
  ctx.fillStyle = '#ff4400';
  ctx.fillRect(~~(cx - 10), ~~(y - 46), 6, 6); // eye L
  ctx.fillRect(~~(cx + 4), ~~(y - 46), 6, 6);  // eye R
  px(ctx, cx - 22, y + 22, 8, 12, '#666'); // claws
  px(ctx, cx + 14, y + 22, 8, 12, '#666');
}

function drawDrake(ctx, cx, cy, t) {
  const dy = Math.sin(t * 2) * 3;
  const y = cy + dy;
  const glow = 0.35 + Math.sin(t * 4) * 0.12;
  ctx.globalAlpha = glow;
  px(ctx, cx - 36, y - 40, 72, 84, '#ff4400');
  ctx.globalAlpha = 1;
  px(ctx, cx - 56, y - 28, 36, 42, '#881100'); // wing L
  px(ctx, cx + 20, y - 28, 36, 42, '#881100'); // wing R
  px(ctx, cx - 22, y - 22, 44, 48, '#aa3300'); // body
  px(ctx, cx - 18, y - 50, 36, 30, '#cc4400'); // head
  px(ctx, cx - 8, y - 58, 30, 14, '#cc4400'); // snout
  px(ctx, cx - 14, y - 66, 5, 18, '#882200'); // horn L
  px(ctx, cx + 4, y - 66, 5, 18, '#882200');
  ctx.fillStyle = '#ffaa00';
  ctx.fillRect(~~(cx - 10), ~~(y - 46), 6, 6);
  ctx.fillRect(~~(cx + 8), ~~(y - 46), 6, 6);
  px(ctx, cx + 22, y + 22, 26, 8, '#881100'); // tail
  px(ctx, cx + 44, y + 26, 12, 5, '#881100');
}

function drawSpecter(ctx, cx, cy, t) {
  const dy = Math.sin(t * 2.5) * 5;
  const y = cy + dy;
  ctx.globalAlpha = 0.72 + Math.sin(t * 2) * 0.12;
  px(ctx, cx - 22, y - 28, 44, 56, '#aaddff'); // robe
  px(ctx, cx - 18, y - 56, 36, 30, '#cceeff'); // head
  ctx.fillStyle = '#001833';
  ctx.fillRect(~~(cx - 10), ~~(y - 48), 8, 10);
  ctx.fillRect(~~(cx + 2), ~~(y - 48), 8, 10);
  // wispy tentacles
  ctx.fillStyle = '#aaddff';
  for (let i = 0; i < 5; i++) {
    const wx = cx - 20 + i * 10;
    const wy = y + 26 + Math.sin(t * 3 + i) * 7;
    ctx.fillRect(~~wx, ~~wy, 4, 14);
  }
  // orbiting ice shards
  ctx.fillStyle = '#66aaff';
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + t;
    ctx.fillRect(~~(cx + Math.cos(a) * 32) - 2, ~~(cy + Math.sin(a) * 22) - 2, 4, 4);
  }
  ctx.globalAlpha = 1;
}

function drawHydra(ctx, cx, cy, t) {
  const y = cy;
  px(ctx, cx - 28, y - 12, 56, 42, '#226622'); // body
  const heads = [{ dx: -30, dy: -42 }, { dx: 0, dy: -58 }, { dx: 30, dy: -42 }];
  heads.forEach(({ dx, dy }, i) => {
    const bob = Math.sin(t * 2 + i * 1.2) * 4;
    px(ctx, cx + dx - 5, y + dy + bob, 10, 32, '#1a5c1a'); // neck
    px(ctx, cx + dx - 12, y + dy - 16 + bob, 24, 20, '#226622'); // head
    px(ctx, cx + dx + 4, y + dy - 10 + bob, 14, 10, '#226622'); // snout
    ctx.fillStyle = '#ff2200';
    ctx.fillRect(~~(cx + dx - 8), ~~(y + dy - 13 + bob), 5, 5);
  });
  ctx.fillStyle = '#00aa00';
  for (let i = 0; i < 3; i++) {
    const px2 = cx - 18 + i * 18;
    const drip = (t * 55 + i * 40) % 48;
    ctx.fillRect(~~px2, ~~(y + 28 + drip), 3, 4);
  }
}

function drawSovereign(ctx, cx, cy, t) {
  const dy = Math.sin(t * 1.8) * 4;
  const y = cy + dy;
  const layers = [{ w: 14, a: 0.9 }, { w: 24, a: 0.7 }, { w: 34, a: 0.5 }, { w: 44, a: 0.3 }];
  layers.forEach(({ w, a }, i) => {
    ctx.globalAlpha = a;
    ctx.fillStyle = '#aaddff';
    ctx.fillRect(~~(cx - w / 2), ~~(y - 58 + i * 20), w, 24);
  });
  ctx.globalAlpha = 1;
  px(ctx, cx - 10, y - 28, 20, 16, '#ffffff');
  px(ctx, cx - 5, y - 25, 10, 10, '#0022aa');
  px(ctx, cx - 2, y - 23, 4, 4, '#ffffff');
  ctx.strokeStyle = '#88ccff'; ctx.lineWidth = 2; ctx.globalAlpha = 0.45;
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + t * 3;
    ctx.beginPath(); ctx.moveTo(cx, y);
    ctx.lineTo(cx + Math.cos(a) * 48, y + Math.sin(a) * 30); ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function drawRedEye(ctx, cx, cy, t, bossPhase, roygbivIdx, immune) {
  const y = cy;
  const eyeGlow = 0.6 + Math.sin(t * 5) * 0.25;

  // Phase 2 immunity aura
  if (bossPhase === 2 && immune) {
    ctx.globalAlpha = 0.2 + Math.sin(t * 6) * 0.08;
    ctx.fillStyle = roygbivIdx < 7 ? ROYGBIV[roygbivIdx] : '#ffffff';
    ctx.fillRect(cx - 55, y - 82, 110, 138);
    ctx.globalAlpha = 1;
  }

  // Storm eye halo
  ctx.globalAlpha = eyeGlow * 0.35;
  ctx.fillStyle = '#ff0000';
  ctx.fillRect(cx - 38, y - 78, 76, 76);
  ctx.globalAlpha = 1;

  // Legs
  px(ctx, cx - 12, y + 28, 8, 34, '#cc0000');
  px(ctx, cx + 4, y + 28, 8, 34, '#cc0000');

  // Body
  px(ctx, cx - 14, y - 8, 28, 38, '#cc0000');

  // Left arm (down)
  px(ctx, cx - 28, y - 6, 14, 8, '#cc0000');
  px(ctx, cx - 28, y, 8, 20, '#cc0000');

  // Right arm (raised, holding katana) — swings
  const swing = Math.sin(t * 3) * 8;
  px(ctx, cx + 14, y - 18 + swing, 14, 8, '#cc0000');
  // Katana guard
  ctx.fillStyle = '#666';
  ctx.fillRect(~~(cx + 25), ~~(y - 10 + swing), 11, 7);
  // Katana blade
  ctx.fillStyle = '#ddeeff';
  ctx.fillRect(~~(cx + 28), ~~(y - 50 + swing), 5, 42);

  // Head
  px(ctx, cx - 14, y - 46, 28, 38, '#dd0000');

  // Left eye (dark)
  ctx.fillStyle = '#330000';
  ctx.fillRect(~~(cx - 10), ~~(y - 37), 8, 8);

  // The red eye
  ctx.globalAlpha = eyeGlow;
  ctx.fillStyle = '#ff0000';
  ctx.fillRect(~~(cx - 2), ~~(y - 37), 14, 14);
  ctx.fillStyle = '#ffaaaa';
  ctx.fillRect(~~(cx + 1), ~~(y - 35), 8, 8);
  ctx.globalAlpha = 1;
}

// ── Main component ──────────────────────────────
export default function DungeonGame({ onBack }) {
  // ── Persistence ────────────────────────────────
  const [saves, setSaves] = useState(() => {
    try { return JSON.parse(localStorage.getItem('dungeon_saves')) || {}; }
    catch { return {}; }
  });
  const savesRef = useRef(saves);
  useEffect(() => { savesRef.current = saves; }, [saves]);

  const unlockedTiers = new Set([1, ...(saves.unlocked || [])]);
  const trophies = new Set(saves.trophies || []);
  const totalCorrect = saves.totalCorrect || 0;

  const persist = useCallback((patch) => {
    setSaves(prev => {
      const next = { ...prev, ...patch };
      localStorage.setItem('dungeon_saves', JSON.stringify(next));
      return next;
    });
  }, []);

  // ── Screen state ───────────────────────────────
  const [screen, setScreen] = useState('SELECT');
  const [bossId, setBossId] = useState(null);
  const [combatPhase, setCombatPhase] = useState('math');
  const [prob, setProb] = useState(null);
  const [answer, setAnswer] = useState('');
  const [lastCorrect, setLastCorrect] = useState(null);
  const [bossHpDisplay, setBossHpDisplay] = useState(0);
  const [bossMaxHpDisplay, setBossMaxHpDisplay] = useState(0);
  const [bossPhaseDisplay, setBossPhaseDisplay] = useState(1);
  const [roygbivDisplay, setRoygbivDisplay] = useState(0);
  const [heartsDisplay, setHeartsDisplay] = useState(3);
  const [dodgeSecsLeft, setDodgeSecsLeft] = useState(6);
  const [turnNote, setTurnNote] = useState('');
  const [immuneDisplay, setImmuneDisplay] = useState(false);

  // ── Mutable refs (read by animation loop) ──────
  const cvsRef = useRef(null);
  const rafRef = useRef(null);
  const tsRef = useRef(null);
  const tRef = useRef(0);

  const screenRef = useRef('SELECT');
  const combatPhaseRef = useRef('math');
  const activeBossRef = useRef(null);
  const bossHpRef = useRef(0);
  const bossMaxRef = useRef(0);
  const bossPhaseRef = useRef(1);
  const roygbivRef = useRef(0);
  const immuneRef = useRef(false);
  const heartsRef = useRef(3);
  const lastCorrectRef = useRef(false);
  const soulRef = useRef({ x: ARENA_X + ARENA_W / 2, y: ARENA_Y + ARENA_H / 2 });
  const bulletsRef = useRef([]);
  const keysRef = useRef({});
  const waveTimerRef = useRef(0);
  const dodgeEndRef = useRef(0);
  const hitGraceRef = useRef(0);

  // Function refs (so loop can call latest version)
  const endDodgeRef = useRef(null);
  const startMathRef = useRef(null);
  const victoryRef = useRef(null);

  // ── Keyboard ───────────────────────────────────
  useEffect(() => {
    const keys = keysRef.current;
    const dn = e => {
      keys[e.key] = true;
      if (['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)) e.preventDefault();
    };
    const up = e => { keys[e.key] = false; };
    window.addEventListener('keydown', dn);
    window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', dn); window.removeEventListener('keyup', up); };
  }, []);

  // ── Victory handler ────────────────────────────
  const triggerVictory = useCallback((boss) => {
    const sv = savesRef.current;
    const newUnlocked = [...(sv.unlocked || [])];
    if (boss.tier < 6 && !newUnlocked.includes(boss.tier + 1))
      newUnlocked.push(boss.tier + 1);
    const newTrophies = [...(sv.trophies || [])];
    if (!newTrophies.includes(boss.id)) newTrophies.push(boss.id);
    persist({ unlocked: newUnlocked, trophies: newTrophies, totalCorrect: sv.totalCorrect || 0 });
    combatPhaseRef.current = 'done';
    setCombatPhase('done');
    setScreen('VICTORY');
    screenRef.current = 'VICTORY';
  }, [persist]);
  victoryRef.current = triggerVictory;

  // ── Start math phase ───────────────────────────
  const startMathPhase = useCallback((boss) => {
    const b = boss ?? activeBossRef.current;
    const p = GEN[b.mathGen]();
    setProb(p);
    setAnswer('');
    setLastCorrect(null);
    setTurnNote('');
    combatPhaseRef.current = 'math';
    setCombatPhase('math');
  }, []);
  startMathRef.current = startMathPhase;

  // ── End dodge phase ────────────────────────────
  const endDodgePhase = useCallback(() => {
    if (combatPhaseRef.current !== 'dodge') return;
    combatPhaseRef.current = 'summary';
    setCombatPhase('summary');
    bulletsRef.current = [];

    const boss = activeBossRef.current;
    const correct = lastCorrectRef.current;
    let dmg = 0;
    let note = '';

    if (boss.id === 'red_eye' && bossPhaseRef.current === 2 && immuneRef.current) {
      // Immune: charge ROYGBIV
      if (correct) {
        const newIdx = roygbivRef.current + 1;
        roygbivRef.current = newIdx;
        setRoygbivDisplay(newIdx);
        const saves2 = savesRef.current;
        persist({ ...saves2, totalCorrect: (saves2.totalCorrect || 0) + 1 });
        if (newIdx >= 7) {
          immuneRef.current = false;
          setImmuneDisplay(false);
          dmg = 1;
          note = `🌈 ROYGBIV complete! Immunity shattered! ${boss.name} takes damage!`;
        } else {
          note = `Soul charged: ${ROYGBIV_NAMES[newIdx - 1]} (${newIdx}/7). Keep going!`;
        }
      } else {
        note = `Wrong answer — soul charge failed. ${roygbivRef.current}/7 charged.`;
      }
    } else {
      if (correct) {
        dmg = 1;
        const saves2 = savesRef.current;
        persist({ ...saves2, totalCorrect: (saves2.totalCorrect || 0) + 1 });
        note = `💥 Hit! ${boss.name} takes 1 damage.`;
      } else {
        note = `Wrong answer — no damage dealt.`;
      }
    }

    if (dmg > 0) {
      const newHp = bossHpRef.current - dmg;
      bossHpRef.current = newHp;
      setBossHpDisplay(Math.max(0, newHp));
      if (newHp <= 0) {
        if (boss.id === 'red_eye' && bossPhaseRef.current === 1) {
          // Phase transition
          note = `💀 Phase 1 defeated! Red Eye TRANSFORMS...`;
          setTurnNote(note);
          setTimeout(() => {
            bossPhaseRef.current = 2;
            bossHpRef.current = boss.phase2Hp;
            bossMaxRef.current = boss.phase2Hp;
            roygbivRef.current = 0;
            immuneRef.current = true;
            setBossPhaseDisplay(2);
            setBossHpDisplay(boss.phase2Hp);
            setBossMaxHpDisplay(boss.phase2Hp);
            setRoygbivDisplay(0);
            setImmuneDisplay(true);
            startMathRef.current(boss);
          }, 2200);
          return;
        }
        note += ' DEFEATED!';
        setTurnNote(note);
        setTimeout(() => victoryRef.current(boss), 1400);
        return;
      }
    }
    setTurnNote(note);
  }, [persist]);
  endDodgeRef.current = endDodgePhase;

  // ── Animation loop ─────────────────────────────
  useEffect(() => {
    const canvas = cvsRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;

    function loop(ts) {
      const dt = Math.min((ts - (tsRef.current ?? ts)) / 1000, 0.05);
      tsRef.current = ts;
      tRef.current += dt;
      const t = tRef.current;
      const phase = combatPhaseRef.current;
      const boss = activeBossRef.current;

      // ── Soul + bullets (dodge phase only) ──────
      if (phase === 'dodge') {
        const k = keysRef.current;
        const s = soulRef.current;
        const sp = SOUL_SPEED * dt;
        if ((k.ArrowLeft  || k.a) && s.x - SOUL_R > ARENA_X)           s.x -= sp;
        if ((k.ArrowRight || k.d) && s.x + SOUL_R < ARENA_X + ARENA_W) s.x += sp;
        if ((k.ArrowUp    || k.w) && s.y - SOUL_R > ARENA_Y)           s.y -= sp;
        if ((k.ArrowDown  || k.s) && s.y + SOUL_R < ARENA_Y + ARENA_H) s.y += sp;

        // Move bullets, cull out-of-bounds
        for (const b of bulletsRef.current) { b.x += b.vx * dt; b.y += b.vy * dt; }
        bulletsRef.current = bulletsRef.current.filter(b =>
          b.x > ARENA_X - 50 && b.x < ARENA_X + ARENA_W + 50 &&
          b.y > ARENA_Y - 50 && b.y < ARENA_Y + ARENA_H + 50
        );

        // Spawn wave
        waveTimerRef.current += dt;
        if (boss && waveTimerRef.current >= 1.8) {
          waveTimerRef.current = 0;
          const atk = boss.attacks[~~(Math.random() * boss.attacks.length)];
          bulletsRef.current.push(...spawnWave(atk));
        }

        // Collision (skip during grace period)
        if (hitGraceRef.current > 0) {
          hitGraceRef.current -= dt;
        } else {
          const s2 = soulRef.current;
          for (const b of bulletsRef.current) {
            if (Math.hypot(b.x - s2.x, b.y - s2.y) < b.r + SOUL_R) {
              const newH = heartsRef.current - 1;
              heartsRef.current = newH;
              setHeartsDisplay(newH);
              hitGraceRef.current = 0.7;
              bulletsRef.current = [];
              if (newH <= 0) {
                combatPhaseRef.current = 'gameover';
                setCombatPhase('gameover');
              }
              break;
            }
          }
        }

        // Countdown
        const msLeft = dodgeEndRef.current - ts;
        setDodgeSecsLeft(Math.max(0, Math.ceil(msLeft / 1000)));
        if (msLeft <= 0) endDodgeRef.current();
      }

      // ── Canvas clear ───────────────────────────
      ctx.fillStyle = boss?.bgDark ?? '#080808';
      ctx.fillRect(0, 0, CW, CH);

      // ── Boss sprite ────────────────────────────
      if (boss) {
        drawBoss(ctx, boss, t, bossPhaseRef.current, roygbivRef.current, immuneRef.current);

        // HP bar
        const hpFrac = Math.max(0, bossHpRef.current / bossMaxRef.current);
        ctx.fillStyle = '#2a2a2a'; ctx.fillRect(40, HP_BAR_Y, CW - 80, 16);
        let barCol = boss.color;
        if (bossPhaseRef.current === 2 && immuneRef.current) {
          barCol = ROYGBIV[Math.min(roygbivRef.current, 6)];
        } else if (bossPhaseRef.current === 2) {
          barCol = '#ff0000';
        }
        ctx.fillStyle = barCol;
        ctx.fillRect(40, HP_BAR_Y, ~~((CW - 80) * hpFrac), 16);
        ctx.strokeStyle = '#f5e6c8'; ctx.lineWidth = 2;
        ctx.strokeRect(40, HP_BAR_Y, CW - 80, 16);
        ctx.fillStyle = '#fff'; ctx.font = 'bold 10px "Courier New",monospace';
        const p2tag = bossPhaseRef.current === 2 ? ' [PHASE 2]' : '';
        const immTag = bossPhaseRef.current === 2 && immuneRef.current ? ' — IMMUNE' : '';
        ctx.fillText(`${boss.name}${p2tag}${immTag}  HP: ${Math.max(0, bossHpRef.current)}/${bossMaxRef.current}`, 44, HP_BAR_Y + 12);
      }

      // ── Dodge arena (dodge + summary phases) ───
      if (phase === 'dodge' || phase === 'summary') {
        // Arena box
        ctx.strokeStyle = '#f5e6c8'; ctx.lineWidth = 3;
        ctx.strokeRect(ARENA_X, ARENA_Y, ARENA_W, ARENA_H);
        ctx.fillStyle = '#050505';
        ctx.fillRect(ARENA_X + 3, ARENA_Y + 3, ARENA_W - 6, ARENA_H - 6);

        // Bullets
        for (const b of bulletsRef.current) {
          ctx.fillStyle = b.color;
          ctx.fillRect(~~b.x - b.r, ~~b.y - b.r, b.r * 2, b.r * 2);
        }

        // Soul
        if (phase === 'dodge') {
          const { x, y } = soulRef.current;
          if (hitGraceRef.current > 0 && ~~(hitGraceRef.current * 10) % 2 === 0) {
            // Flicker on hit
            ctx.globalAlpha = 0.4; ctx.fillStyle = '#fff';
            ctx.fillRect(~~x - SOUL_R - 2, ~~y - SOUL_R - 2, (SOUL_R + 2) * 2, (SOUL_R + 2) * 2);
            ctx.globalAlpha = 1;
          } else {
            const soulCol = bossPhaseRef.current === 2
              ? (roygbivRef.current < 7 ? ROYGBIV[roygbivRef.current] : '#ffffff')
              : '#ff0044';
            ctx.fillStyle = soulCol;
            // Simple heart pixel shape
            ctx.fillRect(~~x - SOUL_R, ~~y - SOUL_R + 2, SOUL_R * 2, SOUL_R * 2 - 2);
            ctx.fillRect(~~x - SOUL_R + 1, ~~y - SOUL_R, SOUL_R - 2, 3);
            ctx.fillRect(~~x + 1, ~~y - SOUL_R, SOUL_R - 2, 3);
          }
        }

        // Hearts (right of arena)
        const hx = ARENA_X + ARENA_W + 16, hy = ARENA_Y + 8;
        ctx.fillStyle = C.gold; ctx.font = 'bold 10px "Courier New",monospace';
        ctx.fillText('HEARTS', hx, hy);
        for (let i = 0; i < 3; i++) {
          ctx.fillStyle = i < heartsRef.current ? '#ff0044' : '#333';
          ctx.fillRect(hx + i * 20, hy + 5, 15, 15);
        }

        // ROYGBIV tracker (left of arena, Red Eye Phase 2 only)
        if (boss?.id === 'red_eye' && bossPhaseRef.current === 2 && immuneRef.current) {
          const rx = ARENA_X - 185, ry = ARENA_Y + 8;
          ctx.fillStyle = '#fff'; ctx.font = 'bold 10px "Courier New",monospace';
          ctx.fillText('SOUL CHARGE', rx, ry);
          for (let i = 0; i < 7; i++) {
            ctx.fillStyle = i < roygbivRef.current ? ROYGBIV[i] : '#222';
            ctx.fillRect(rx + i * 24, ry + 5, 20, 20);
            if (i < roygbivRef.current) {
              ctx.strokeStyle = '#fff'; ctx.lineWidth = 1;
              ctx.strokeRect(rx + i * 24, ry + 5, 20, 20);
            }
          }
        }
      }

      rafRef.current = requestAnimationFrame(loop);
    }

    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, []); // empty — reads everything via refs

  // ── Start a boss ───────────────────────────────
  const startBoss = useCallback((boss) => {
    activeBossRef.current = boss;
    bossHpRef.current = boss.maxHp;
    bossMaxRef.current = boss.maxHp;
    bossPhaseRef.current = 1;
    roygbivRef.current = 0;
    immuneRef.current = false;
    heartsRef.current = 3;
    bulletsRef.current = [];
    waveTimerRef.current = 0;
    hitGraceRef.current = 0;
    soulRef.current = { x: ARENA_X + ARENA_W / 2, y: ARENA_Y + ARENA_H / 2 };

    setBossId(boss.id);
    setBossHpDisplay(boss.maxHp);
    setBossMaxHpDisplay(boss.maxHp);
    setBossPhaseDisplay(1);
    setRoygbivDisplay(0);
    setHeartsDisplay(3);
    setImmuneDisplay(false);
    setScreen('COMBAT');
    screenRef.current = 'COMBAT';
    startMathRef.current(boss);
  }, []);

  // ── Submit math answer ─────────────────────────
  const handleSubmit = useCallback(() => {
    if (!prob || !answer) return;
    const val = parseInt(answer, 10);
    const correct = val === prob.ans;
    lastCorrectRef.current = correct;
    setLastCorrect(correct);

    bulletsRef.current = [];
    waveTimerRef.current = 0;
    hitGraceRef.current = 0;
    soulRef.current = { x: ARENA_X + ARENA_W / 2, y: ARENA_Y + ARENA_H / 2 };
    dodgeEndRef.current = performance.now() + DODGE_MS;
    combatPhaseRef.current = 'dodge';
    setCombatPhase('dodge');
  }, [prob, answer]);

  // ── Styles ─────────────────────────────────────
  const dlg = {
    background: '#000', border: '4px solid #f5e6c8',
    width: CW, maxWidth: '100%', padding: '14px 22px', minHeight: 88,
    fontFamily: '"Courier New",monospace', color: '#fff', boxSizing: 'border-box',
  };
  const btn = (col, filled = false) => ({
    background: filled ? col : 'transparent',
    border: `2px solid ${col}`, color: filled ? '#000' : col,
    fontFamily: '"Courier New",monospace', fontWeight: 'bold',
    fontSize: 13, padding: '5px 14px', cursor: 'pointer', letterSpacing: 1,
  });

  const boss = BOSSES.find(b => b.id === bossId);

  // ── Render ─────────────────────────────────────
  return (
    <div style={{
      background: '#060d14', minHeight: '100vh',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      userSelect: 'none', gap: 0,
    }}>
      <div style={{
        color: C.gold, fontFamily: '"Courier New",monospace',
        fontSize: 20, fontWeight: 'bold', letterSpacing: 5,
        marginBottom: 6, display: 'flex', alignItems: 'center', gap: 16,
        textShadow: `0 0 12px ${C.gold}`,
      }}>
        ⚔ DUNGEON MODE ⚔
        <button onClick={onBack} style={{ ...btn('#666'), fontSize: 10, padding: '2px 8px', letterSpacing: 0 }}>
          ← BACK
        </button>
      </div>

      <canvas
        ref={cvsRef} width={CW} height={CH}
        style={{ display: 'block', border: '3px solid #f5e6c8', imageRendering: 'pixelated', maxWidth: '100%' }}
      />

      <div style={dlg}>

        {/* SELECT */}
        {screen === 'SELECT' && (
          <div>
            <div style={{ color: C.gold, fontSize: 12, letterSpacing: 3, marginBottom: 10 }}>▶ CHOOSE A DUNGEON</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {BOSSES.map(b => {
                const unlocked = unlockedTiers.has(b.tier) ||
                  (b.tier === 6 && totalCorrect >= (b.unlockAt ?? 1000));
                const cleared = trophies.has(b.id);
                return (
                  <button key={b.id} disabled={!unlocked} onClick={() => startBoss(b)} style={{
                    ...btn(unlocked ? b.color : '#444', cleared),
                    opacity: unlocked ? 1 : 0.45, fontSize: 11, padding: '6px 10px', lineHeight: 1.55,
                  }}>
                    {cleared ? '✓ ' : ''}{b.trophyIcon} {b.dungeon}
                    <br /><span style={{ fontSize: 9, opacity: 0.7 }}>{b.name}</span>
                    {!unlocked && <><br /><span style={{ fontSize: 9, color: '#555' }}>
                      {b.tier === 6 ? `Need ${b.unlockAt} correct answers (${totalCorrect} so far)` : 'Locked'}
                    </span></>}
                    {cleared && <><br /><span style={{ fontSize: 9, color: b.color }}>{b.trophy}</span></>}
                  </button>
                );
              })}
            </div>
            {totalCorrect > 0 && (
              <div style={{ color: '#555', fontSize: 10, marginTop: 8 }}>
                Lifetime correct answers: {totalCorrect}
              </div>
            )}
          </div>
        )}

        {/* COMBAT — MATH PHASE */}
        {screen === 'COMBAT' && combatPhase === 'math' && prob && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ color: boss?.color ?? C.gold, fontSize: 12, letterSpacing: 3 }}>
              ⚡ {bossPhaseDisplay === 2 && immuneDisplay ? 'CHARGE YOUR SOUL' : 'ATTACK'} — Solve the problem!
              {bossPhaseDisplay === 2 && immuneDisplay && (
                <span style={{ color: '#aaa', marginLeft: 10, fontSize: 10 }}>
                  ({roygbivDisplay}/7 soul colors charged — wrong answers don't advance)
                </span>
              )}
            </div>
            <div style={{ fontSize: 14, lineHeight: 1.7 }}>{prob.q} = ?</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <input
                autoFocus
                type="number"
                value={answer}
                onChange={e => setAnswer(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                placeholder="?"
                style={{
                  background: '#111', border: `2px solid ${C.gold}`,
                  color: C.gold, fontFamily: '"Courier New",monospace',
                  fontSize: 20, padding: '3px 10px', width: 110, outline: 'none',
                }}
              />
              <button onClick={handleSubmit} disabled={!answer} style={btn(C.gold, !!answer)}>
                {bossPhaseDisplay === 2 && immuneDisplay ? 'CHARGE ▶' : 'ATTACK ▶'}
              </button>
              <span style={{ color: '#555', fontSize: 11 }}>
                Wrong answer = no damage, but you still dodge
              </span>
            </div>
          </div>
        )}

        {/* COMBAT — DODGE PHASE */}
        {screen === 'COMBAT' && combatPhase === 'dodge' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
            <div style={{ color: lastCorrect ? C.green : '#ff6060', fontSize: 12, letterSpacing: 2 }}>
              {lastCorrect ? '✓ CORRECT — Survive to deal damage!' : '✗ WRONG — Dodge to survive!'}
            </div>
            <div style={{ color: C.gold, fontSize: 22, fontWeight: 'bold', minWidth: 36 }}>
              {dodgeSecsLeft}s
            </div>
            <div style={{ color: '#777', fontSize: 11 }}>Arrow keys to move your soul</div>
          </div>
        )}

        {/* COMBAT — TURN SUMMARY */}
        {screen === 'COMBAT' && combatPhase === 'summary' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{
              fontSize: 13, lineHeight: 1.6,
              color: turnNote.includes('DEFEATED') || turnNote.includes('shattered') || turnNote.includes('💥')
                ? C.green : '#ff9060',
            }}>
              {turnNote || (lastCorrect ? 'Hit! Well done.' : 'No damage this turn.')}
            </div>
            <button onClick={() => startMathRef.current(boss)} style={btn(C.gold, true)}>
              NEXT TURN ▶
            </button>
          </div>
        )}

        {/* COMBAT — GAME OVER */}
        {screen === 'COMBAT' && combatPhase === 'gameover' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ color: '#ff2020', fontSize: 14 }}>
              💀 Out of hearts. {boss?.name ?? 'The boss'} defeated you.
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => boss && startBoss(boss)} style={btn(C.gold)}>↺ RETRY BOSS</button>
              <button onClick={() => { setScreen('SELECT'); screenRef.current = 'SELECT'; }} style={btn('#777')}>
                ← DUNGEON SELECT
              </button>
            </div>
          </div>
        )}

        {/* VICTORY */}
        {screen === 'VICTORY' && boss && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ color: C.green, fontSize: 14 }}>
              🏆 {boss.name} defeated!{' '}
              <span style={{ color: boss.color }}>{boss.trophyIcon} {boss.trophy}</span> earned.
              {boss.keyName && (
                <span style={{ color: boss.keyColor ?? '#aaa' }}> + 🗝 {boss.keyName} obtained!</span>
              )}
            </div>
            <div style={{ fontSize: 11, color: '#777', fontStyle: 'italic' }}>
              "{boss.flavor}"
            </div>
            <button
              onClick={() => { setScreen('SELECT'); screenRef.current = 'SELECT'; setBossId(null); }}
              style={btn(C.green, true)}
            >
              ← DUNGEON SELECT
            </button>
          </div>
        )}

      </div>

      <style>{`
        input[type=number]::-webkit-outer-spin-button,
        input[type=number]::-webkit-inner-spin-button { -webkit-appearance: none; }
        input[type=number] { -moz-appearance: textfield; }
      `}</style>
    </div>
  );
}
