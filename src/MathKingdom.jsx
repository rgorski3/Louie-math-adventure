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
const FIRED_DEG  = 110; // long arm: upper-left (counterweight fallen lower-right)
const TOTAL_ROT  = 140; // CCW degrees traversed
// Arm at 90° (straight up) = launch point. Occurs at progress = 120/140
const LAUNCH_P   = 120 / 140;
const LAUNCH_X   = PIVOT_X;           // arm at 90°: tip directly above pivot
const LAUNCH_Y   = PIVOT_Y - LONG_ARM; // = 205

// Level geometry
const WALL_X     = 380, WALL_TOP = 175, WALL_W = 28;
const TARGET_X   = 680, TARGET_R  = 30;

// Physics (hand-rolled kinematics, pixel-space)
const V0_OPT     = 450;  // px/s — correct counterweight gives this
const GRAV       = 360;  // px/s²

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
function checkTraj(pts) {
  for (let i = 1; i < pts.length; i++) {
    const { x, y } = pts[i], pp = pts[i - 1];
    if (x >= WALL_X - WALL_W / 2 - 3 && x <= WALL_X + WALL_W / 2 + 3 && y >= WALL_TOP)
      return { type: 'WALL' };
    if (y >= GROUND_Y && pp.y < GROUND_Y) {
      const f  = (GROUND_Y - pp.y) / (y - pp.y);
      const lx = pp.x + f * (x - pp.x);
      return { type: Math.abs(lx - TARGET_X) <= TARGET_R ? 'HIT' : 'MISS', lx };
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
  ctx.fillStyle = C.ground;  ctx.fillRect(0, GROUND_Y, GW, GH - GROUND_Y);
  ctx.fillStyle = C.groundTx; ctx.fillRect(0, GROUND_Y, GW, 4);
  ctx.fillStyle = C.groundTx;
  for (let x = 0; x < GW; x += 44) {
    ctx.fillRect(x, GROUND_Y + 10, 26, 2);
    ctx.fillRect(x + 22, GROUND_Y + 22, 18, 2);
  }
}

function drawWall(ctx) {
  const wx = ~~(WALL_X - WALL_W / 2);
  const wh = GROUND_Y - WALL_TOP;
  ctx.fillStyle = C.wall; ctx.fillRect(wx, ~~WALL_TOP, WALL_W, wh);
  for (let row = 0; row * 16 < wh; row++) {
    const ry  = ~~(WALL_TOP + row * 16);
    const off = (row % 2) * 10;
    ctx.fillStyle = C.wallDk;
    ctx.fillRect(wx, ry, WALL_W, 2);
    ctx.fillRect(wx + off + 5, ry + 2, 2, 14);
  }
  ctx.fillStyle = C.wallLt; ctx.fillRect(wx, ~~WALL_TOP, 3, wh);
  for (let i = 0; i < 2; i++) {
    ctx.fillStyle = C.wall;   ctx.fillRect(wx + i * 13, ~~WALL_TOP - 14, 10, 14);
    ctx.fillStyle = C.wallDk; ctx.fillRect(wx + i * 13, ~~WALL_TOP - 14, 10, 2);
  }
}

function drawTarget(ctx, hit) {
  ctx.fillStyle = C.woodDk;
  ctx.fillRect(TARGET_X - 2, GROUND_Y - 54, 4, 54);
  const rings = [
    { r: 24, c: C.tR }, { r: 16, c: C.tG },
    { r: 9,  c: C.tR }, { r: 4,  c: hit ? '#fff' : C.tG },
  ];
  for (const { r, c } of rings) {
    ctx.fillStyle = c;
    ctx.fillRect(TARGET_X - r, GROUND_Y - 52 - r, r * 2, r * 2);
  }
  if (hit) {
    ctx.globalAlpha = 0.22;
    ctx.fillStyle = C.gold;
    ctx.fillRect(TARGET_X - 42, GROUND_Y - 100, 84, 78);
    ctx.globalAlpha = 1;
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

function drawLabels(ctx) {
  ctx.font = 'bold 10px "Courier New",monospace';
  ctx.fillStyle = C.gold;
  ctx.fillText('TREBUCHET',   PIVOT_X - 34,  GH - 7);
  ctx.fillText('CASTLE WALL', WALL_X - 36,   WALL_TOP - 18);
  ctx.fillText('TARGET',      TARGET_X - 20, GROUND_Y - 66);
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

// ──────────────────────────────────────────────
// MATH PROBLEMS
// ──────────────────────────────────────────────
function newProb() {
  const mps = [6, 8, 9, 10, 12, 15];
  const rs   = [7, 8, 9, 10, 11, 12];
  const mp   = mps[~~(Math.random() * mps.length)];
  const r    = rs [~~(Math.random() * rs.length)];
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
  const phaseRef   = useRef('PROBLEM');
  const probRef    = useRef(newProb());
  const cwRef      = useRef('');
  const angleRef   = useRef(55);
  const trajRef    = useRef([]);
  const armPRef    = useRef(0);
  const projIRef   = useRef(0);
  const ptclsRef   = useRef([]);
  const outcomeRef = useRef(null);

  // React state drives UI re-renders only
  const [phase,  setPhase]  = useState('PROBLEM');
  const [prob,   setProb]   = useState(probRef.current);
  const [cw,     setCw]     = useState('');
  const [angle,  setAngle]  = useState(55);
  const [result, setResult] = useState(null);

  // ── Animation loop ──────────────────────────
  useEffect(() => {
    const canvas = cvsRef.current;
    const ctx    = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;

    function loop(ts) {
      const dt = Math.min((ts - (tsRef.current ?? ts)) / 1000, 0.05);
      tsRef.current = ts;
      const ph = phaseRef.current;

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

      // ── Draw ──────────────────────────────
      ctx.clearRect(0, 0, GW, GH);
      drawBg(ctx);
      drawWall(ctx);
      drawTarget(ctx, outcomeRef.current === 'HIT');

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
      drawLabels(ctx);

      rafRef.current = requestAnimationFrame(loop);
    }

    rafRef.current = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(rafRef.current);
      clearTimeout(toRef.current);
    };
  }, []);

  // ── Recompute preview trajectory ────────────
  useEffect(() => {
    const v0 = v0From(parseFloat(cwRef.current), probRef.current.ans);
    if (v0 && phase === 'AIM') {
      trajRef.current = calcTraj(v0, angle);
    } else if (phase !== 'FIRING' && phase !== 'RESULT') {
      trajRef.current = [];
    }
  }, [cw, angle, prob, phase]);

  // ── Handlers ────────────────────────────────
  const handleSetWeight = useCallback(() => {
    const v = parseFloat(cwRef.current);
    if (!v || v <= 0) return;
    phaseRef.current = 'AIM';
    setPhase('AIM');
  }, []);

  const handleFire = useCallback(() => {
    const cwVal    = parseFloat(cwRef.current);
    const correct  = probRef.current.ans;
    const err      = cwError(cwVal, correct);

    armPRef.current  = 0;
    projIRef.current = 0;
    ptclsRef.current = [];
    outcomeRef.current = null;

    if (err > 0.20) {
      // ── CATASTROPHIC ──
      outcomeRef.current = 'CATASTROPHIC';
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
      const { type, lx } = checkTraj(traj);
      outcomeRef.current = type;
      let msg = '';
      if (type === 'HIT') {
        ptclsRef.current = mkSuccess(TARGET_X, GROUND_Y - 52);
        msg = '🎯 DIRECT HIT! Your math was spot on!';
      } else if (type === 'WALL') {
        const under = cwVal < correct;
        msg = under
          ? `🧱 Hit the wall! Your counterweight is too light. Redo the multiplication.`
          : `🧱 Hit the wall! Try a steeper angle to arc over it.`;
      } else {
        const d   = lx ? ~~Math.abs(lx - TARGET_X) : '?';
        const dir = lx < TARGET_X ? 'short' : 'long';
        msg = `Landed ${d}px ${dir} of the target. Check your counterweight math!`;
      }
      phaseRef.current = 'RESULT';
      setPhase('RESULT');
      setResult({ type, msg });
    }, dur);
  }, []);

  const goAim = useCallback(() => {
    armPRef.current  = 0;
    projIRef.current = 0;
    ptclsRef.current = [];
    outcomeRef.current = null;
    setResult(null);
    const v0 = v0From(parseFloat(cwRef.current), probRef.current.ans);
    if (v0) trajRef.current = calcTraj(v0, angleRef.current);
    phaseRef.current = 'AIM';
    setPhase('AIM');
  }, []);

  const goProblem = useCallback(() => {
    armPRef.current  = 0;
    projIRef.current = 0;
    ptclsRef.current = [];
    outcomeRef.current = null;
    trajRef.current = [];
    setResult(null);
    phaseRef.current = 'PROBLEM';
    setPhase('PROBLEM');
  }, []);

  const goNext = useCallback(() => {
    const p = newProb();
    probRef.current  = p;
    cwRef.current    = '';
    angleRef.current = 55;
    armPRef.current  = 0;
    projIRef.current = 0;
    ptclsRef.current = [];
    outcomeRef.current = null;
    trajRef.current  = [];
    setProb(p); setCw(''); setAngle(55); setResult(null);
    phaseRef.current = 'PROBLEM';
    setPhase('PROBLEM');
  }, []);

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

        {/* ── PROBLEM ── */}
        {phase === 'PROBLEM' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ color: C.gold, fontSize: 12, letterSpacing: 3 }}>
              ⚡ CALIBRATE TREBUCHET
            </div>
            <div style={{ fontSize: 14, lineHeight: 1.7 }}>
              Your boulder weighs{' '}
              <span style={{ color: C.gold, fontWeight: 'bold' }}>{prob.mp}kg</span>.
              To breach the castle wall, you need a force ratio of{' '}
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
            color: outcomeRef.current === 'CATASTROPHIC' ? C.orange : C.gold,
            fontSize: 15, letterSpacing: 2,
          }}>
            {outcomeRef.current === 'CATASTROPHIC'
              ? '💥 STRUCTURAL FAILURE — CATASTROPHIC MISFIRE!'
              : '🚀 LAUNCHING...'}
          </div>
        )}

        {/* ── RESULT ── */}
        {phase === 'RESULT' && result && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{
              fontSize: 14, lineHeight: 1.6,
              color: result.type === 'HIT'
                ? C.green
                : result.type === 'CATASTROPHIC' ? C.orange : '#ff6060',
            }}>
              {result.msg}
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {result.type === 'HIT' ? (
                <button onClick={goNext} style={btn(C.green, false)}>
                  NEXT LEVEL ▶
                </button>
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
