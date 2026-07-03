import { useState } from 'react';
import MathKingdom from './MathKingdom';
import DungeonGame from './DungeonGame';

const C = { gold: '#e8a020', border: '#f5e6c8', bg: '#060d14' };

const btn = (color, filled = false) => ({
  background: filled ? color : 'transparent',
  border: `2px solid ${color}`, color: filled ? '#000' : color,
  fontFamily: '"Courier New",monospace', fontWeight: 'bold',
  fontSize: 15, padding: '10px 28px', cursor: 'pointer', letterSpacing: 2,
  display: 'block', width: 260, textAlign: 'center',
});

function Menu({ onSelect }) {
  return (
    <div style={{
      background: C.bg, minHeight: '100vh',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      fontFamily: '"Courier New",monospace', gap: 0,
    }}>
      <div style={{
        color: C.gold, fontSize: 26, fontWeight: 'bold',
        letterSpacing: 6, marginBottom: 6,
        textShadow: `0 0 16px ${C.gold}`,
      }}>
        ⚔ MATH KINGDOM ⚔
      </div>
      <div style={{ color: '#666', fontSize: 11, letterSpacing: 3, marginBottom: 36 }}>
        LOUIE'S MATH ADVENTURE
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <button style={btn(C.gold, true)} onClick={() => onSelect('trebuchet')}>
          🏰 TREBUCHET MODE
        </button>
        <button style={btn('#cc4400')} onClick={() => onSelect('dungeon')}>
          ⚔ DUNGEON MODE
        </button>
      </div>

      <div style={{ color: '#333', fontSize: 10, marginTop: 40, textAlign: 'center', lineHeight: 1.8 }}>
        Trebuchet: fire a boulder by solving multiplication<br />
        Dungeon: fight bosses — math = offense, dodging = defense
      </div>
    </div>
  );
}

export default function App() {
  const [mode, setMode] = useState('menu');
  if (mode === 'trebuchet') return <MathKingdom onBack={() => setMode('menu')} />;
  if (mode === 'dungeon')   return <DungeonGame onBack={() => setMode('menu')} />;
  return <Menu onSelect={setMode} />;
}
