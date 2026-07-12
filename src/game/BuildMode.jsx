import { C, dlgStyle } from "./shared";

// ──────────────────────────────────────────────
// BUILD — castle construction section (stub, implementation pending).
// See Game_Structure_Redesign_Plan.md §Section 2.
// ──────────────────────────────────────────────
export default function BuildMode() {
  return (
    <div style={dlgStyle}>
      <div style={{ color: C.gold, fontSize: 14, letterSpacing: 2 }}>
        🏰 THE BUILDERS ARE ON THEIR WAY...
      </div>
    </div>
  );
}
