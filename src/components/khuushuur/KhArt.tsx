import { useId } from "react";

/* Зураггүй цэсний бараанд кодоор зурсан SVG: хагас сарны хэлбэртэй,
   ирмэг нь хавчсан, шарсан цэврүүтэй хуушуур + аяга, шөл, салат.
   `art` нь src/lib/khuushuur.ts → KH_ARTS. */

function Piece({ x, y, s, r, g }: { x: number; y: number; s: number; r: number; g: string }) {
  const crimp = Array.from({ length: 15 }, (_, i) => {
    const a = Math.PI + (i * Math.PI) / 14;
    return <circle key={i} cx={(Math.cos(a) * 50).toFixed(1)} cy={(Math.sin(a) * 50).toFixed(1)} r="5.2" fill={`url(#${g}d)`} />;
  });
  const bl = [[-22, -18], [8, -30], [24, -12], [-8, -8], [-30, -6], [12, -6]];
  return (
    <g transform={`translate(${x} ${y}) rotate(${r}) scale(${s})`}>
      <ellipse cx="0" cy="6" rx="54" ry="7" fill="#000" opacity=".12" />
      {crimp}
      <path d="M-50 0 A50 50 0 0 1 50 0 Z" fill={`url(#${g}b)`} />
      <path d="M-50 0 H50" stroke="#b9761f" strokeWidth="3" strokeLinecap="round" />
      {bl.map(([a, b], i) => <ellipse key={i} cx={a} cy={b} rx={3 + (i % 3)} ry={2 + (i % 2)} fill="#f7cf7c" opacity=".7" />)}
    </g>
  );
}
const Plate = () => <ellipse cx="140" cy="150" rx="125" ry="28" fill="#fff" stroke="#e1dbd2" strokeWidth="2" />;
function Bowl({ x, y, c, children }: { x: number; y: number; c: string; children?: React.ReactNode }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <ellipse cx="0" cy="34" rx="40" ry="6" fill="#000" opacity=".12" />
      <path d="M-42 0 Q-38 36 0 36 Q38 36 42 0Z" fill="#fff" stroke="#e1dbd2" strokeWidth="2" />
      <path d="M-42 0 Q0 10 42 0" stroke="#1f4fa0" strokeWidth="3" fill="none" />
      <ellipse cx="0" cy="0" rx="42" ry="9" fill={c} />
      {children}
    </g>
  );
}
function Cup({ x, y, c, lbl }: { x: number; y: number; c: string; lbl: string }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <ellipse cx="0" cy="58" rx="26" ry="5" fill="#000" opacity=".12" />
      <path d="M-24 0 L-19 56 H19 L24 0Z" fill="#fff" stroke="#e1dbd2" strokeWidth="2" />
      <rect x="-22" y="16" width="44" height="18" fill={lbl} />
      <ellipse cx="0" cy="0" rx="24" ry="6" fill={c} />
    </g>
  );
}

export default function KhArt({ art, className }: { art: string; className?: string }) {
  const g = "k" + useId().replace(/[^a-zA-Z0-9]/g, "");
  const P = (x: number, y: number, s: number, r: number) => <Piece key={`${x}-${y}`} x={x} y={y} s={s} r={r} g={g} />;
  let body: React.ReactNode;
  switch (art) {
    case "two": body = <><Plate />{P(110, 132, 1.05, -8)}{P(170, 118, 1.05, 6)}</>; break;
    case "stack": body = <><Plate />{P(90, 136, .9, -10)}{P(190, 136, .9, 8)}{P(140, 112, .95, 0)}{P(115, 92, .85, -6)}{P(168, 90, .85, 6)}</>; break;
    case "combo": body = <><Plate />{P(95, 130, .95, -6)}{P(150, 116, .95, 4)}<Bowl x={222} y={112} c="#c78a3a"><circle cx="-12" cy="0" r="4" fill="#3a8a3a" /><circle cx="10" cy="-2" r="3" fill="#e57b2a" /></Bowl></>; break;
    case "combotea": body = <><Plate />{P(100, 132, 1, -6)}{P(160, 118, 1, 4)}<Cup x={230} y={84} c="#e8d3b0" lbl="#c8261b" /></>; break;
    case "soup": body = <Bowl x={140} y={104} c="#c78a3a"><rect x="-20" y="-3" width="14" height="4" fill="#f2e6cf" /><rect x="2" y="-1" width="16" height="4" fill="#f2e6cf" /><circle cx="-4" cy="2" r="4" fill="#e57b2a" /></Bowl>; break;
    case "salad": body = <Bowl x={140} y={104} c="#f3eedd"><circle cx="-18" cy="-1" r="5" fill="#e57b2a" /><circle cx="-4" cy="2" r="5" fill="#f7d36b" /><circle cx="12" cy="-2" r="5" fill="#4f9a3b" /><circle cx="24" cy="1" r="4" fill="#d9483b" /></Bowl>; break;
    case "pickle": body = <Bowl x={140} y={104} c="#5e8c2f"><ellipse cx="-14" cy="0" rx="10" ry="4" fill="#89b54a" /><ellipse cx="10" cy="-1" rx="10" ry="4" fill="#89b54a" /></Bowl>; break;
    case "tea": body = <Cup x={140} y={66} c="#e8d3b0" lbl="#1f4fa0" />; break;
    case "airag": body = <Cup x={140} y={66} c="#f5f2ea" lbl="#7a5a2a" />; break;
    case "cola": body = <Cup x={140} y={66} c="#3b1f12" lbl="#c8261b" />; break;
    case "water": body = <Cup x={140} y={66} c="#cfe6f2" lbl="#2a7ab8" />; break;
    default: body = <><Plate />{P(140, 128, 1.35, -4)}</>;
  }
  return (
    <svg viewBox="0 0 280 190" className={className} aria-hidden="true">
      <defs>
        <radialGradient id={`${g}b`} cx=".45" cy=".35" r=".8"><stop offset="0" stopColor="#f6c66b" /><stop offset=".6" stopColor="#df9a3c" /><stop offset="1" stopColor="#b36c1d" /></radialGradient>
        <linearGradient id={`${g}d`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#e8a748" /><stop offset="1" stopColor="#a8621a" /></linearGradient>
      </defs>
      {body}
    </svg>
  );
}
