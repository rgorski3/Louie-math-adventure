import { useState } from 'react';
import MathKingdom from './MathKingdom';
import DungeonMode from './DungeonMode';
import { C } from './theme';

const mono = '"Courier New", monospace';

function ModeCard({ icon, title, blurb, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: C.dlgBg, border: `4px solid ${C.dlgBdr}`,
        color: C.white, fontFamily: mono, cursor: 'pointer',
        width: 300, padding: '22px 18px', textAlign: 'center',
        display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center',
      }}
    >
      <span style={{ fontSize: 34 }}>{icon}</span>
      <span style={{ color: C.gold, fontWeight: 'bold', fontSize: 16, letterSpacing: 2 }}>
        {title}
      </span>
      <span style={{ fontSize: 12, color: '#bbb', lineHeight: 1.6 }}>{blurb}</span>
    </button>
  );
}

export default function App() {
  const [mode, setMode] = useState(null);

  if (mode) {
    return (
      <div style={{ position: 'relative' }}>
        <button
          onClick={() => setMode(null)}
          style={{
            position: 'absolute', top: 10, left: 10, zIndex: 10,
            background: C.dlgBg, border: `2px solid ${C.dlgBdr}`,
            color: C.dlgBdr, fontFamily: mono, fontWeight: 'bold',
            fontSize: 11, padding: '4px 10px', cursor: 'pointer', letterSpacing: 1,
          }}
        >
          ⬅ MENU
        </button>
        {mode === 'dungeon' ? <DungeonMode /> : <MathKingdom />}
      </div>
    );
  }

  return (
    <div style={{
      background: '#060d14', minHeight: '100vh',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      userSelect: 'none', gap: 26,
    }}>
      <div style={{
        color: C.gold, fontFamily: mono,
        fontSize: 30, fontWeight: 'bold', letterSpacing: 6,
        textShadow: `0 0 14px ${C.gold}`,
      }}>
        ⚔ MATH KINGDOM ⚔
      </div>
      <div style={{ color: '#999', fontFamily: mono, fontSize: 13, letterSpacing: 2 }}>
        CHOOSE YOUR QUEST
      </div>
      <div style={{ display: 'flex', gap: 26, flexWrap: 'wrap', justifyContent: 'center' }}>
        <ModeCard
          icon="🏰"
          title="DUNGEON MODE"
          blurb="Math battles! Solve problems to strike monsters, dodge their attacks, forge keys, and topple the Golem."
          onClick={() => setMode('dungeon')}
        />
        <ModeCard
          icon="🎯"
          title="TREBUCHET MODE"
          blurb="Physics siege! Calculate the counterweight, find the perfect arc, and smash targets over the castle wall."
          onClick={() => setMode('trebuchet')}
        />
      </div>
    </div>
  );
}
