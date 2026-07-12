import { useState, useEffect, useRef, useCallback } from "react";
import {
  GW, GH, GROUND_Y, C,
  drawStars, stepParticles, renderParticles, mkParticles,
  mulProblem, randInt,
  dlgStyle, btnStyle, inputStyle,
} from "./shared";

// ──────────────────────────────────────────────
// BUILD — castle construction section. Relaxed "strategy" phase: no
// timer, no HP, but math stays non-bypassable. See
// Game_Structure_Redesign_Plan.md §Section 2.
// ──────────────────────────────────────────────

const MAT_ICON  = { stone: '🪨', wood: '🪵', gold: '🪙' };
const MAT_COLOR = { stone: '#9aa0a8', wood: C.wood, gold: C.gold };
const MAT_SITE  = { stone: 'Quarry', wood: 'Lumber Camp', gold: 'Mine' };

// ── Work sites — earning materials ──────────
const SITES = [
  {
    id: 'quarry', name: 'QUARRY', icon: '🪨', mat: 'stone', x: 60,
    probFn: () => mulProblem(4, 9, 4, 9),
    verb: n => `The masons haul ${n} stone!`,
    wrongPerson: 'The foreman',
  },
  {
    id: 'lumber', name: 'LUMBER CAMP', icon: '🪵', mat: 'wood', x: 105,
    probFn: () => mulProblem(3, 8, 4, 8),
    verb: n => `The lumberjacks stack ${n} wood!`,
    wrongPerson: 'The lumber foreman',
  },
  {
    id: 'mine', name: 'MINE', icon: '🪙', mat: 'gold', x: 150,
    probFn: () => mulProblem(3, 7, 3, 6),
    verb: n => `The miners haul up ${n} gold!`,
    wrongPerson: 'The old prospector',
  },
];

// ── Blueprints — spending materials ─────────
// Fixed-cost multiplication problems (not randomized) drive each build plot.
const BLUEPRINTS = [
  {
    id: 'ballista', name: 'Ballista', short: 'BALLISTA', x: 220, w: 56, h: 46,
    parts: [
      { mat: 'wood', a: 4, b: 9, prompt: '4 × 9 wood for the frame' },
      { mat: 'gold', a: 2, b: 6, prompt: '2 × 6 gold for the mechanism' },
    ],
  },
  {
    id: 'towerL', name: 'West Tower', short: 'W.TOWER', x: 300, w: 50, h: 140,
    parts: [{ mat: 'stone', a: 6, b: 7, prompt: '6 rows of 7 stone blocks' }],
  },
  {
    id: 'wallL', name: 'West Wall', short: 'W.WALL', x: 390, w: 74, h: 90,
    parts: [{ mat: 'stone', a: 4, b: 8, prompt: '4 rows of 8 stone blocks' }],
  },
  {
    id: 'gate', name: 'Great Gate', short: 'GATE', x: 480, w: 64, h: 100,
    parts: [{ mat: 'wood', a: 5, b: 6, prompt: '5 planks across 6 beams' }],
  },
  {
    id: 'wallR', name: 'East Wall', short: 'E.WALL', x: 570, w: 74, h: 90,
    parts: [{ mat: 'stone', a: 4, b: 8, prompt: '4 rows of 8 stone blocks' }],
  },
  {
    id: 'banner', name: 'Royal Banner', short: 'BANNER', x: 615, w: 18, h: 130,
    parts: [{ mat: 'gold', a: 3, b: 4, prompt: '3 × 4 gold thread' }],
  },
  {
    id: 'towerR', name: 'East Tower', short: 'E.TOWER', x: 660, w: 50, h: 140,
    parts: [{ mat: 'stone', a: 6, b: 7, prompt: '6 rows of 7 stone blocks' }],
  },
];

function costOf(bp) {
  const cost = {};
  for (const p of bp.parts) cost[p.mat] = (cost[p.mat] ?? 0) + p.a * p.b;
  return cost;
}
function costLabel(cost) {
  return Object.entries(cost).map(([mat, amt]) => `${amt}${MAT_ICON[mat]}`).join(' ');
}
function canAfford(materials, cost) {
  return Object.entries(cost).every(([mat, amt]) => (materials[mat] ?? 0) >= amt);
}

// ──────────────────────────────────────────────
// DRAWING
// ──────────────────────────────────────────────
function drawBg(ctx) {
  const g = ctx.createLinearGradient(0, 0, 0, GROUND_Y);
  g.addColorStop(0, C.skyTop); g.addColorStop(1, C.skyBot);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, GW, GROUND_Y);
  drawStars(ctx);
  ctx.fillStyle = C.ground;   ctx.fillRect(0, GROUND_Y, GW, GH - GROUND_Y);
  ctx.fillStyle = C.groundTx; ctx.fillRect(0, GROUND_Y, GW, 4);
  ctx.fillStyle = C.groundTx;
  for (let x = 0; x < GW; x += 44) {
    ctx.fillRect(x, GROUND_Y + 10, 26, 2);
    ctx.fillRect(x + 22, GROUND_Y + 22, 18, 2);
  }
}

function drawWorkSites(ctx) {
  // Quarry — rock pile
  const qx = 60;
  ctx.fillStyle = C.wallDk; ctx.fillRect(qx - 22, GROUND_Y - 18, 44, 18);
  ctx.fillStyle = C.wall;   ctx.fillRect(qx - 16, GROUND_Y - 30, 20, 20);
  ctx.fillStyle = C.wallLt; ctx.fillRect(qx - 16, GROUND_Y - 30, 20, 4);
  ctx.fillStyle = C.wall;   ctx.fillRect(qx + 2, GROUND_Y - 24, 16, 16);
  ctx.fillStyle = C.wallDk; ctx.fillRect(qx + 2, GROUND_Y - 24, 16, 2);

  // Lumber camp — stump + logs
  const lx = 105;
  ctx.fillStyle = C.woodDk; ctx.fillRect(lx - 10, GROUND_Y - 16, 20, 16);
  ctx.fillStyle = C.wood;   ctx.fillRect(lx - 9, GROUND_Y - 16, 18, 4);
  ctx.fillStyle = C.wood;   ctx.fillRect(lx - 26, GROUND_Y - 8, 20, 6);
  ctx.fillStyle = C.woodDk; ctx.fillRect(lx - 26, GROUND_Y - 8, 20, 2);
  ctx.fillStyle = C.wood;   ctx.fillRect(lx + 8, GROUND_Y - 6, 20, 6);
  ctx.fillStyle = C.woodDk; ctx.fillRect(lx + 8, GROUND_Y - 6, 20, 2);

  // Mine — cave mouth
  const mx = 150;
  ctx.fillStyle = C.ground; ctx.fillRect(mx - 26, GROUND_Y - 34, 52, 34);
  ctx.fillStyle = C.wallDk; ctx.fillRect(mx - 14, GROUND_Y - 26, 28, 4);
  ctx.fillStyle = '#000';   ctx.fillRect(mx - 12, GROUND_Y - 24, 24, 24);

  ctx.font = '10px "Courier New",monospace';
  ctx.fillStyle = C.gold;
  ctx.fillText('QUARRY', qx - 22, GROUND_Y + 14);
  ctx.fillText('LUMBER', lx - 22, GROUND_Y + 14);
  ctx.fillText('MINE',   mx - 14, GROUND_Y + 14);
}

function dashedRect(ctx, x, y, w, h, color) {
  ctx.fillStyle = color;
  const dash = 6, gap = 4;
  for (let i = 0; i < w; i += dash + gap) {
    const seg = Math.min(dash, w - i);
    ctx.fillRect(~~(x + i), ~~y, seg, 2);
    ctx.fillRect(~~(x + i), ~~(y + h - 2), seg, 2);
  }
  for (let i = 0; i < h; i += dash + gap) {
    const seg = Math.min(dash, h - i);
    ctx.fillRect(~~x, ~~(y + i), 2, seg);
    ctx.fillRect(~~(x + w - 2), ~~(y + i), 2, seg);
  }
}

function drawPlot(ctx, bp) {
  const x = ~~(bp.x - bp.w / 2), y = ~~(GROUND_Y - bp.h);
  dashedRect(ctx, x, y, bp.w, bp.h, '#3a3f4a');
  ctx.font = '9px "Courier New",monospace';
  ctx.globalAlpha = 0.85;
  ctx.fillStyle = C.gold;
  ctx.fillText(bp.short, x - 2, y - 4);
  ctx.globalAlpha = 1;
}

function drawTorch(ctx, tox, toy, ts) {
  ctx.fillStyle = C.woodDk; ctx.fillRect(tox, toy, 3, 12);
  ctx.fillStyle = C.metal;  ctx.fillRect(tox - 2, toy - 2, 7, 3);
  const flick = 0.7 + 0.3 * Math.abs(Math.sin(ts / 130));
  ctx.globalAlpha = flick;
  ctx.fillStyle = C.orange; ctx.fillRect(tox - 3, toy - 10, 9, 8);
  ctx.fillStyle = C.gold;   ctx.fillRect(tox - 1, toy - 8, 5, 5);
  ctx.globalAlpha = 1;
}

function drawStoneWall(ctx, bp) {
  const { x: cx, w, h } = bp;
  const x = ~~(cx - w / 2), yTop = ~~(GROUND_Y - h);
  ctx.fillStyle = C.wall; ctx.fillRect(x, yTop, w, h);
  for (let row = 0; row * 14 < h; row++) {
    const ry = ~~(yTop + row * 14);
    const off = (row % 2) * 8;
    ctx.fillStyle = C.wallDk;
    ctx.fillRect(x, ry, w, 2);
    for (let bx = x + off; bx < x + w - 4; bx += 16) ctx.fillRect(bx + 6, ry + 2, 2, 10);
  }
  ctx.fillStyle = C.wallLt; ctx.fillRect(x, yTop, 3, h);
  for (let i = 0; i * 16 < w; i++) {
    ctx.fillStyle = C.wall;   ctx.fillRect(x + i * 16, yTop - 10, 10, 10);
    ctx.fillStyle = C.wallDk; ctx.fillRect(x + i * 16, yTop - 10, 10, 2);
  }
}

function drawTower(ctx, bp, ts) {
  const { x: cx, w, h } = bp;
  const x = ~~(cx - w / 2), yTop = ~~(GROUND_Y - h);
  ctx.fillStyle = C.wall; ctx.fillRect(x, yTop, w, h);
  for (let row = 0; row * 16 < h; row++) {
    const ry = ~~(yTop + row * 16);
    const off = (row % 2) * 8;
    ctx.fillStyle = C.wallDk;
    ctx.fillRect(x, ry, w, 2);
    ctx.fillRect(x + off + 6, ry + 2, 2, 12);
  }
  ctx.fillStyle = C.wallLt; ctx.fillRect(x, yTop, 3, h);
  const seg = w / 3;
  for (let i = 0; i < 3; i++) {
    ctx.fillStyle = C.wall;   ctx.fillRect(~~(x + i * seg), yTop - 12, ~~(seg - 4), 12);
    ctx.fillStyle = C.wallDk; ctx.fillRect(~~(x + i * seg), yTop - 12, ~~(seg - 4), 2);
  }
  ctx.fillStyle = '#000'; ctx.fillRect(~~(cx - 4), yTop + 34, 8, 14);
  drawTorch(ctx, x - 6, yTop + 24, ts);
}

function drawGate(ctx, bp, ts) {
  const { x: cx, w, h } = bp;
  const x = ~~(cx - w / 2), yTop = ~~(GROUND_Y - h);
  const pw = 14;
  ctx.fillStyle = C.wall; ctx.fillRect(x, yTop, pw, h); ctx.fillRect(x + w - pw, yTop, pw, h);
  ctx.fillStyle = C.wallDk; ctx.fillRect(x, yTop, pw, 3); ctx.fillRect(x + w - pw, yTop, pw, 3);
  ctx.fillStyle = C.wall; ctx.fillRect(x, yTop - 10, w, 10);
  ctx.fillStyle = C.wallDk; ctx.fillRect(x, yTop - 10, w, 2);
  ctx.fillStyle = C.wood; ctx.fillRect(x + pw, yTop + 6, w - 2 * pw, h - 6);
  ctx.fillStyle = C.woodDk; ctx.fillRect(x + pw, yTop + 6, ~~((w - 2 * pw) / 2) - 1, h - 6);
  for (let sy = yTop + 16; sy < yTop + h - 8; sy += 18) {
    ctx.fillStyle = C.metal;
    ctx.fillRect(x + pw + 4, sy, 4, 4);
    ctx.fillRect(x + w - pw - 8, sy, 4, 4);
  }
  drawTorch(ctx, x - 6, yTop + 18, ts);
  drawTorch(ctx, x + w + 3, yTop + 18, ts + 400);
}

function drawBallista(ctx, bp) {
  const { x: cx, w, h } = bp;
  const x = ~~(cx - w / 2), yTop = ~~(GROUND_Y - h);
  ctx.fillStyle = C.woodDk; ctx.fillRect(x, GROUND_Y - 8, w, 8);
  ctx.fillStyle = '#2e1a0a'; ctx.fillRect(x + 2, GROUND_Y - 10, 10, 10); ctx.fillRect(x + w - 12, GROUND_Y - 10, 10, 10);
  ctx.fillStyle = C.metal; ctx.fillRect(x + 4, GROUND_Y - 7, 6, 3); ctx.fillRect(x + w - 10, GROUND_Y - 7, 6, 3);
  ctx.fillStyle = C.wood; ctx.fillRect(~~(cx - 4), yTop, 8, h - 8);
  ctx.strokeStyle = C.metal; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(x, yTop + 6); ctx.lineTo(x + w, yTop + 6); ctx.stroke();
  ctx.strokeStyle = '#ccc'; ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x, yTop + 6); ctx.lineTo(cx, yTop + h - 10); ctx.lineTo(x + w, yTop + 6);
  ctx.stroke();
}

function drawBanner(ctx, bp) {
  const { x: cx, w, h } = bp;
  const yTop = ~~(GROUND_Y - h);
  ctx.fillStyle = C.woodDk; ctx.fillRect(~~(cx - 2), yTop, 4, h);
  ctx.fillStyle = C.gold; ctx.fillRect(~~(cx - 2), yTop + 4, w, 22);
  ctx.fillStyle = C.red;  ctx.fillRect(~~(cx - 2), yTop + 12, w, 6);
}

const DRAW_FN = {
  ballista: (ctx, bp) => drawBallista(ctx, bp),
  towerL:   (ctx, bp, ts) => drawTower(ctx, bp, ts),
  wallL:    (ctx, bp) => drawStoneWall(ctx, bp),
  gate:     (ctx, bp, ts) => drawGate(ctx, bp, ts),
  wallR:    (ctx, bp) => drawStoneWall(ctx, bp),
  banner:   (ctx, bp) => drawBanner(ctx, bp),
  towerR:   (ctx, bp, ts) => drawTower(ctx, bp, ts),
};

function drawHud(ctx, count) {
  ctx.font = 'bold 11px "Courier New",monospace';
  ctx.fillStyle = C.gold;
  ctx.fillText(`YOUR KINGDOM · ${count}/7 STRUCTURES`, 10, 16);
}

// ──────────────────────────────────────────────
// COMPONENT
// ──────────────────────────────────────────────
export default function BuildMode({ materials, onEarn, onSpend, onExit }) {
  const cvsRef = useRef(null);
  const rafRef = useRef(null);
  const tsRef  = useRef(null);

  // Mutable per-frame data — read by the raf loop, never by render.
  const ptclsRef = useRef([]);
  const builtRef = useRef(new Set());

  // React state — drives UI re-renders (and, for builtSet, also mirrored
  // into builtRef so the raf loop can draw already-built structures).
  const [builtSet, setBuiltSet] = useState(new Set());

  // 'MENU' | 'EARN_PROBLEM' | 'EARN_RESULT' | 'BUILD_PROBLEM' | 'BUILD_RESULT' | 'COMPLETE'
  const [phase, setPhase] = useState('MENU');

  const [activeSite, setActiveSite]     = useState(null);
  const [earnProblem, setEarnProblem]   = useState(null);
  const [earnAnswer, setEarnAnswer]     = useState('');
  const [earnResult, setEarnResult]     = useState(null);

  const [activeBp, setActiveBp]         = useState(null);
  const [buildPartIdx, setBuildPartIdx] = useState(0);
  const [buildAnswer, setBuildAnswer]   = useState('');
  const [buildResult, setBuildResult]   = useState(null);

  const setBuiltBoth = useCallback((next) => {
    builtRef.current = next;
    setBuiltSet(next);
  }, []);

  // ── Animation loop ──────────────────────────
  useEffect(() => {
    const canvas = cvsRef.current;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;

    function loop(ts) {
      const dt = Math.min((ts - (tsRef.current ?? ts)) / 1000, 0.05);
      tsRef.current = ts;

      ptclsRef.current = stepParticles(ptclsRef.current, dt);

      ctx.clearRect(0, 0, GW, GH);
      drawBg(ctx);
      drawWorkSites(ctx);
      for (const bp of BLUEPRINTS) {
        if (builtRef.current.has(bp.id)) DRAW_FN[bp.id](ctx, bp, ts);
        else drawPlot(ctx, bp);
      }
      renderParticles(ctx, ptclsRef.current);
      drawHud(ctx, builtRef.current.size);

      rafRef.current = requestAnimationFrame(loop);
    }

    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  // ── Work-site handlers ──────────────────────
  const handleSelectSite = useCallback((site) => {
    setActiveSite(site);
    setEarnProblem(site.probFn());
    setEarnAnswer('');
    setEarnResult(null);
    setPhase('EARN_PROBLEM');
  }, []);

  const handleSubmitEarn = useCallback(() => {
    const val = Number(earnAnswer);
    const correct = val === earnProblem.ans;
    if (correct) {
      onEarn({ [activeSite.mat]: earnProblem.ans });
      const jitter = randInt(-8, 8);
      ptclsRef.current = ptclsRef.current.concat(mkParticles(
        activeSite.x + jitter, GROUND_Y - 20,
        { n: 22, colors: [MAT_COLOR[activeSite.mat], C.gold], vyMin: 70, vyMax: 230 }
      ));
      setEarnResult({ ok: true, msg: activeSite.verb(earnProblem.ans) });
    } else {
      setEarnResult({
        ok: false,
        msg: `✗ ${activeSite.wrongPerson} shakes his head. ${earnProblem.a} × ${earnProblem.b} = ${earnProblem.ans}. Try another shift.`,
      });
    }
    setPhase('EARN_RESULT');
  }, [earnAnswer, earnProblem, activeSite, onEarn]);

  const backToMenu = useCallback(() => {
    setPhase('MENU');
    setActiveSite(null);
    setEarnProblem(null);
    setEarnResult(null);
    setActiveBp(null);
    setBuildResult(null);
    setBuildPartIdx(0);
    setBuildAnswer('');
  }, []);

  // ── Blueprint handlers ──────────────────────
  const handleSelectBlueprint = useCallback((bp) => {
    if (builtRef.current.has(bp.id)) return;
    setActiveBp(bp);
    setBuildPartIdx(0);
    setBuildAnswer('');
    setBuildResult(null);
    setPhase('BUILD_PROBLEM');
  }, []);

  const handleSubmitBuild = useCallback(() => {
    const bp = activeBp;
    const part = bp.parts[buildPartIdx];
    const val = Number(buildAnswer);

    if (val !== part.a * part.b) {
      setBuildResult({
        ok: false,
        msg: `The builders refuse to start without the right count. ${part.a} × ${part.b} = ${part.a * part.b}. Try again.`,
      });
      setPhase('BUILD_RESULT');
      return;
    }

    if (buildPartIdx < bp.parts.length - 1) {
      setBuildPartIdx(i => i + 1);
      setBuildAnswer('');
      return;
    }

    // Final part correct — attempt to spend the full cost.
    const cost = costOf(bp);
    const ok = onSpend(cost);
    if (!ok) {
      const short = Object.entries(cost).find(([mat, amt]) => (materials[mat] ?? 0) < amt);
      const mat = short ? short[0] : Object.keys(cost)[0];
      setBuildResult({
        ok: false,
        msg: `Not enough ${mat} in the stores — earn more at the ${MAT_SITE[mat]}.`,
      });
      setPhase('BUILD_RESULT');
      return;
    }

    const next = new Set(builtRef.current);
    next.add(bp.id);
    setBuiltBoth(next);

    const jitter = randInt(-10, 10);
    ptclsRef.current = ptclsRef.current.concat(mkParticles(
      bp.x + jitter, GROUND_Y - bp.h / 2,
      { n: 28, colors: [C.gold, C.dot], vyMin: 90, vyMax: 260 }
    ));

    if (next.size === BLUEPRINTS.length) {
      // Castle complete — extra celebration bursts across the grounds.
      for (const b of BLUEPRINTS) {
        ptclsRef.current = ptclsRef.current.concat(mkParticles(
          b.x, GROUND_Y - b.h / 2,
          { n: 18, colors: [C.gold, C.green, C.dot], vyMin: 60, vyMax: 220 }
        ));
      }
      setPhase('COMPLETE');
      return;
    }

    setBuildResult({ ok: true, msg: `✓ The ${bp.name} is complete!` });
    setPhase('BUILD_RESULT');
  }, [activeBp, buildPartIdx, buildAnswer, onSpend, materials, setBuiltBoth]);

  const builtCount = builtSet.size;
  const allBuilt = builtCount === BLUEPRINTS.length;

  return (
    <>
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
      <div style={dlgStyle}>

        {/* ── MENU ── */}
        {phase === 'MENU' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ color: C.gold, fontSize: 13, letterSpacing: 2 }}>
              🏰 YOUR KINGDOM · {builtCount}/7 STRUCTURES{allBuilt ? ' — COMPLETE!' : ''}
            </div>

            <div>
              <div style={{ color: '#999', fontSize: 11, letterSpacing: 1, marginBottom: 6 }}>
                WORK SITES — earn materials
              </div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {SITES.map(s => (
                  <button key={s.id} onClick={() => handleSelectSite(s)} style={btnStyle(MAT_COLOR[s.mat], false)}>
                    {s.icon} {s.name}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div style={{ color: '#999', fontSize: 11, letterSpacing: 1, marginBottom: 6 }}>
                BLUEPRINTS — spend materials
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {BLUEPRINTS.map(bp => {
                  const built = builtSet.has(bp.id);
                  const cost = costOf(bp);
                  const afford = !built && canAfford(materials, cost);
                  return (
                    <button
                      key={bp.id}
                      disabled={built}
                      onClick={() => handleSelectBlueprint(bp)}
                      style={{
                        ...btnStyle(built ? '#555' : (afford ? C.green : C.gold), false),
                        opacity: built ? 0.55 : 1,
                        cursor: built ? 'default' : 'pointer',
                      }}
                    >
                      {built ? '✓ ' : ''}{bp.name} — {costLabel(cost)}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ── EARN_PROBLEM ── */}
        {phase === 'EARN_PROBLEM' && earnProblem && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ color: MAT_COLOR[activeSite.mat], fontSize: 12, letterSpacing: 3 }}>
              {activeSite.icon} {activeSite.name}
            </div>
            <div style={{ fontSize: 14, lineHeight: 1.6 }}>
              Work a shift to earn {activeSite.mat}. Solve the problem — the answer <em>is</em> the reward.
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <span style={{ color: C.gold, fontSize: 18 }}>{earnProblem.a} × {earnProblem.b} =</span>
              <input
                autoFocus
                type="number"
                value={earnAnswer}
                onChange={e => setEarnAnswer(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && earnAnswer && handleSubmitEarn()}
                placeholder="?"
                style={inputStyle}
              />
              <button onClick={handleSubmitEarn} style={btnStyle(MAT_COLOR[activeSite.mat], !!earnAnswer)}>
                WORK ▶
              </button>
              <button onClick={backToMenu} style={{ ...btnStyle('#666', false), fontSize: 10, padding: '2px 7px' }}>
                back
              </button>
            </div>
          </div>
        )}

        {/* ── EARN_RESULT ── */}
        {phase === 'EARN_RESULT' && earnResult && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ fontSize: 14, lineHeight: 1.6, color: earnResult.ok ? C.green : '#ff6060' }}>
              {earnResult.msg}
            </div>
            <button onClick={backToMenu} style={btnStyle(C.gold, false)}>
              ◀ BACK TO THE GROUNDS
            </button>
          </div>
        )}

        {/* ── BUILD_PROBLEM ── */}
        {phase === 'BUILD_PROBLEM' && activeBp && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ color: C.gold, fontSize: 12, letterSpacing: 3 }}>
              🏗 {activeBp.name}{activeBp.parts.length > 1 ? ` — PART ${buildPartIdx + 1}/${activeBp.parts.length}` : ''}
            </div>
            <div style={{ fontSize: 14, lineHeight: 1.6 }}>
              The {activeBp.name} needs {activeBp.parts[buildPartIdx].prompt}. How much {activeBp.parts[buildPartIdx].mat}?
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <span style={{ color: C.gold, fontSize: 18 }}>
                {activeBp.parts[buildPartIdx].a} × {activeBp.parts[buildPartIdx].b} =
              </span>
              <input
                autoFocus
                type="number"
                value={buildAnswer}
                onChange={e => setBuildAnswer(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && buildAnswer && handleSubmitBuild()}
                placeholder="?"
                style={inputStyle}
              />
              <button onClick={handleSubmitBuild} style={btnStyle(C.gold, !!buildAnswer)}>
                BUILD ▶
              </button>
              <button onClick={backToMenu} style={{ ...btnStyle('#666', false), fontSize: 10, padding: '2px 7px' }}>
                back
              </button>
            </div>
          </div>
        )}

        {/* ── BUILD_RESULT ── */}
        {phase === 'BUILD_RESULT' && buildResult && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ fontSize: 14, lineHeight: 1.6, color: buildResult.ok ? C.green : '#ff6060' }}>
              {buildResult.msg}
            </div>
            <button onClick={backToMenu} style={btnStyle(C.gold, false)}>
              ◀ BACK TO THE GROUNDS
            </button>
          </div>
        )}

        {/* ── COMPLETE ── */}
        {phase === 'COMPLETE' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ color: C.gold, fontSize: 18, letterSpacing: 2, textShadow: `0 0 10px ${C.gold}` }}>
              👑 THE CASTLE STANDS!
            </div>
            <div style={{ fontSize: 13, lineHeight: 1.6, color: '#ccc' }}>
              Every wall, tower, and banner was raised by your own math. The kingdom is safe.
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button onClick={backToMenu} style={btnStyle(C.gold, true)}>
                ADMIRE YOUR KINGDOM
              </button>
              {onExit && (
                <button onClick={onExit} style={btnStyle(C.dlgBdr, false)}>
                  ◀ RETURN TO KINGDOM HUB
                </button>
              )}
            </div>
          </div>
        )}

      </div>
    </>
  );
}
