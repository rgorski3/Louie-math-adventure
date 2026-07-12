import { useState, useRef, useCallback } from "react";
import { C, GW } from "./game/shared";
import TrebuchetMode from "./game/TrebuchetMode";
import BattleMode from "./game/BattleMode";
import BuildMode from "./game/BuildMode";

// ──────────────────────────────────────────────
// KINGDOM HUB — mode select + session material economy.
// Three separate game sections (see Game_Structure_Redesign_Plan.md):
//   ⚔ BATTLE — dungeon math combat (Undertale-style dodge lives here)
//   🏰 BUILD  — earn materials with math, construct castle & defenses
//   🎯 SIEGE  — trebuchet physics puzzle
// Materials are session-only (alpha scope: no persistence).
// ──────────────────────────────────────────────
const SECTIONS = [
  { id: 'BATTLE', icon: '⚔', name: 'BATTLE', color: C.red,
    desc: 'Fight through the Stone Dungeon. Correct answers strike the enemy — then dodge the counterattack!' },
  { id: 'BUILD', icon: '🏰', name: 'BUILD', color: C.gold,
    desc: 'Quarry stone, cut lumber, mine gold — then do the math to raise your castle and its defenses.' },
  { id: 'SIEGE', icon: '🎯', name: 'SIEGE', color: C.orange,
    desc: 'Calibrate the trebuchet with multiplication, find the arc, and breach the enemy wall.' },
];

const MODE_TITLES = {
  HUB:    '⚔ MATH KINGDOM ⚔',
  BATTLE: '⚔ BATTLE — THE STONE DUNGEON',
  BUILD:  '🏰 BUILD — YOUR CASTLE',
  SIEGE:  '🎯 SIEGE — THE TREBUCHET',
};

export default function MathKingdom() {
  const [mode, setMode] = useState('HUB');
  const [materials, setMaterials] = useState({ stone: 0, wood: 0, gold: 0 });
  // Mirror for synchronous spend checks from stable mode callbacks
  const materialsRef = useRef({ stone: 0, wood: 0, gold: 0 });

  const grantMaterials = useCallback((gain) => {
    setMaterials(prev => {
      const next = {
        stone: prev.stone + (gain.stone ?? 0),
        wood:  prev.wood  + (gain.wood  ?? 0),
        gold:  prev.gold  + (gain.gold  ?? 0),
      };
      materialsRef.current = next;
      return next;
    });
  }, []);

  // Attempts to deduct `cost`; returns false (and deducts nothing) if any
  // material is short. Checked against the ref so callers get the answer
  // synchronously.
  const spendMaterials = useCallback((cost) => {
    const cur = materialsRef.current;
    if (cur.stone < (cost.stone ?? 0) ||
        cur.wood  < (cost.wood  ?? 0) ||
        cur.gold  < (cost.gold  ?? 0)) return false;
    const next = {
      stone: cur.stone - (cost.stone ?? 0),
      wood:  cur.wood  - (cost.wood  ?? 0),
      gold:  cur.gold  - (cost.gold  ?? 0),
    };
    materialsRef.current = next;
    setMaterials(next);
    return true;
  }, []);

  const goHub = useCallback(() => setMode('HUB'), []);

  return (
    <div style={{
      background: '#060d14', minHeight: '100vh',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      userSelect: 'none', gap: 0,
      fontFamily: '"Courier New", monospace',
    }}>
      {/* Header: title + materials bar (+ back button inside a section) */}
      <div style={{
        width: GW, maxWidth: '100%', boxSizing: 'border-box',
        display: 'flex', alignItems: 'center', gap: 14, marginBottom: 6,
      }}>
        {mode !== 'HUB' && (
          <button
            onClick={goHub}
            style={{
              background: 'transparent', border: `2px solid ${C.dlgBdr}`,
              color: C.dlgBdr, fontFamily: '"Courier New", monospace',
              fontWeight: 'bold', fontSize: 12, padding: '4px 10px',
              cursor: 'pointer', letterSpacing: 1, flexShrink: 0,
            }}
          >
            ◀ KINGDOM
          </button>
        )}
        <div style={{
          color: C.gold, fontSize: mode === 'HUB' ? 20 : 15, fontWeight: 'bold',
          letterSpacing: mode === 'HUB' ? 5 : 2,
          textShadow: `0 0 12px ${C.gold}`,
          flex: 1, textAlign: mode === 'HUB' ? 'center' : 'left',
        }}>
          {MODE_TITLES[mode]}
        </div>
        <div style={{ color: '#bbb', fontSize: 12, letterSpacing: 1, flexShrink: 0 }}>
          <span style={{ color: '#9aa0a8' }}>🪨 {materials.stone}</span>
          {'  '}
          <span style={{ color: C.wood }}>🪵 {materials.wood}</span>
          {'  '}
          <span style={{ color: C.gold }}>🪙 {materials.gold}</span>
        </div>
      </div>

      {/* ── HUB: section select ── */}
      {mode === 'HUB' && (
        <div style={{
          width: GW, maxWidth: '100%', boxSizing: 'border-box',
          background: C.dlgBg, border: `4px solid ${C.dlgBdr}`,
          padding: '22px 26px',
          display: 'flex', flexDirection: 'column', gap: 16,
        }}>
          <div style={{ color: '#999', fontSize: 12, letterSpacing: 1, lineHeight: 1.6 }}>
            * The kingdom needs your math. Choose where to lend it.
          </div>
          {SECTIONS.map(s => (
            <button
              key={s.id}
              onClick={() => setMode(s.id)}
              style={{
                background: 'transparent', border: `3px solid ${s.color}`,
                color: C.white, fontFamily: '"Courier New", monospace',
                textAlign: 'left', padding: '14px 18px', cursor: 'pointer',
                display: 'flex', flexDirection: 'column', gap: 6,
              }}
            >
              <span style={{
                color: s.color, fontWeight: 'bold',
                fontSize: 16, letterSpacing: 3,
              }}>
                {s.icon} {s.name}
              </span>
              <span style={{ color: '#bbb', fontSize: 12, lineHeight: 1.5 }}>
                {s.desc}
              </span>
            </button>
          ))}
          <div style={{ color: '#555', fontSize: 10, letterSpacing: 1 }}>
            Battle and Siege victories earn materials — spend them in Build.
          </div>
        </div>
      )}

      {/* ── Sections ── */}
      {mode === 'BATTLE' && (
        <BattleMode onReward={grantMaterials} onExit={goHub} />
      )}
      {mode === 'BUILD' && (
        <BuildMode
          materials={materials}
          onEarn={grantMaterials}
          onSpend={spendMaterials}
          onExit={goHub}
        />
      )}
      {mode === 'SIEGE' && (
        <TrebuchetMode onReward={grantMaterials} />
      )}

      <style>{`
        input[type=number]::-webkit-outer-spin-button,
        input[type=number]::-webkit-inner-spin-button { -webkit-appearance:none; margin:0; }
        input[type=number] { -moz-appearance: textfield; }
      `}</style>
    </div>
  );
}
