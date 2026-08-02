"use client";

import { useEffect, useRef, useState } from "react";

interface AmbientLine {
  from: string;
  to: string;
  text: string;
}

interface FlightBubble {
  id: number;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  text: string;
  color: string;
  startedAt: number;
}

const FLIGHT_MS = 2600;
const BURST_INTERVAL = 1700; // ms between new bubbles

// Map agent → tag color for the bubble (matches card accent)
const TIER_COLOR: Record<string, string> = {
  antaqor: "#1080CA",
  ceo: "#1080CA",
  cfo: "#4FE065",
  cto: "#1080CA",
  cso: "#1080CA",
  treasurer: "#15803D",
  tax: "#1080CA",
  coder: "#9CA3AF",
  designer: "#7E22CE",
  researcher: "#1080CA",
  strategist: "#C81348",
  marketer: "#FFB547",
  content: "#1080CA",
  sales: "#15803D",
  valeria: "#C9A961",
  kaira: "#1080CA",
  zayden: "#1080CA",
  nova: "#1080CA",
  rei: "#EC4899",
};

export default function AgentAmbient({ lines }: { lines: AmbientLine[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [bubbles, setBubbles] = useState<FlightBubble[]>([]);
  const idRef = useRef(0);
  const idxRef = useRef(0);
  const [reduced, setReduced] = useState(false);

  // Respect prefers-reduced-motion
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    if (reduced) return;
    if (!containerRef.current) return;

    const fire = () => {
      const container = containerRef.current;
      if (!container) return;

      // Walk the script in order; loop. Adds rhythm + readability.
      const line = lines[idxRef.current % lines.length];
      idxRef.current++;

      const fromEl = document.querySelector<HTMLElement>(`[data-agent="${line.from}"]`);
      const toEl = document.querySelector<HTMLElement>(`[data-agent="${line.to}"]`);
      if (!fromEl || !toEl) return;

      const cRect = container.getBoundingClientRect();
      const fRect = fromEl.getBoundingClientRect();
      const tRect = toEl.getBoundingClientRect();

      // Clip to viewport: skip if either card is offscreen (no point animating).
      const vh = window.innerHeight;
      const cardOnScreen = (r: DOMRect) => r.bottom > 0 && r.top < vh;
      if (!cardOnScreen(fRect) && !cardOnScreen(tRect)) return;

      const fromX = fRect.left - cRect.left + fRect.width / 2;
      const fromY = fRect.top - cRect.top + fRect.height / 2;
      const toX = tRect.left - cRect.left + tRect.width / 2;
      const toY = tRect.top - cRect.top + tRect.height / 2;

      idRef.current += 1;
      const bubble: FlightBubble = {
        id: idRef.current,
        fromX,
        fromY,
        toX,
        toY,
        text: line.text,
        color: TIER_COLOR[line.from] || "#1080CA",
        startedAt: performance.now(),
      };
      setBubbles((b) => [...b, bubble]);

      // Auto-cull after the flight finishes
      setTimeout(() => {
        setBubbles((b) => b.filter((x) => x.id !== bubble.id));
      }, FLIGHT_MS + 200);
    };

    // Kick off immediately with a slight stagger
    const initial = setTimeout(fire, 600);
    const interval = setInterval(fire, BURST_INTERVAL);
    return () => {
      clearTimeout(initial);
      clearInterval(interval);
    };
  }, [lines, reduced]);

  if (reduced) return null;

  return (
    <div
      ref={containerRef}
      aria-hidden
      className="pointer-events-none absolute inset-0 z-[6] overflow-hidden"
    >
      {/* SVG layer for the connection lines */}
      <svg className="pointer-events-none absolute inset-0 h-full w-full" style={{ overflow: "visible" }}>
        {bubbles.map((b) => (
          <line
            key={`l-${b.id}`}
            x1={b.fromX}
            y1={b.fromY}
            x2={b.toX}
            y2={b.toY}
            stroke={b.color}
            strokeWidth={1.5}
            strokeDasharray="3 4"
            opacity={0.45}
            style={{
              animation: `lineFade ${FLIGHT_MS}ms cubic-bezier(0.4, 0, 0.2, 1) both`,
            }}
          />
        ))}
      </svg>

      {/* Floating bubbles */}
      {bubbles.map((b) => (
        <div
          key={b.id}
          className="absolute font-mono text-[10px] font-bold"
          style={
            {
              left: 0,
              top: 0,
              "--fx": `${b.fromX}px`,
              "--fy": `${b.fromY}px`,
              "--tx": `${b.toX}px`,
              "--ty": `${b.toY}px`,
              animation: `bubbleFly ${FLIGHT_MS}ms cubic-bezier(0.4, 0, 0.2, 1) both`,
              willChange: "transform, opacity",
            } as React.CSSProperties
          }
        >
          <span
            className="inline-flex items-center gap-1.5 rounded-none border px-2 py-1 backdrop-blur-md"
            style={{
              borderColor: `${b.color}66`,
              background: `${b.color}1A`,
              color: "#F4EFE6",
              boxShadow: `0 4px 18px ${b.color}33, 0 0 0 1px ${b.color}26`,
            }}
          >
            <span className="inline-block h-[5px] w-[5px] rounded-full" style={{ background: b.color }} />
            {b.text}
          </span>
        </div>
      ))}

      <style>{`
        @keyframes bubbleFly {
          0%   { transform: translate(var(--fx), var(--fy)) translate(-50%, -50%) scale(0.6); opacity: 0; }
          15%  { opacity: 1; transform: translate(var(--fx), var(--fy)) translate(-50%, -50%) scale(1); }
          85%  { opacity: 1; transform: translate(var(--tx), var(--ty)) translate(-50%, -50%) scale(1); }
          100% { opacity: 0; transform: translate(var(--tx), var(--ty)) translate(-50%, -50%) scale(0.85); }
        }
        @keyframes lineFade {
          0%, 10% { opacity: 0; }
          25%, 75% { opacity: 0.55; }
          100% { opacity: 0; }
        }
      `}</style>
    </div>
  );
}
