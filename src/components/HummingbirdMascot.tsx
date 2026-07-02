import { useEffect, useRef, useState } from "react";

/**
 * Animated hummingbird brand mascot.
 *
 * Choreography (~4.5s):
 *   0.0s  Enters from right, off-screen.
 *   0.8s  Hovers near the logo (wing-flap continues throughout).
 *   1.6s  Circles the logo once (clockwise loop).
 *   3.4s  Glides toward the top-right corner and fades out.
 *
 * Motion is disabled when the user prefers reduced motion; instead the
 * hummingbird settles gently near the top-right corner as a static accent.
 *
 * Positioning: the component is anchored to a `data-oonah-logo` element if
 * one is present in the DOM (so the flight path circles the OONAH logo).
 * Falls back to the viewport centre when the logo is absent.
 */
export function HummingbirdMascot() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [reduced, setReduced] = useState(false);
  const [target, setTarget] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, []);

  useEffect(() => {
    const measure = () => {
      const logo = document.querySelector<HTMLElement>("[data-oonah-logo]");
      if (logo) {
        const r = logo.getBoundingClientRect();
        setTarget({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
      } else {
        setTarget({ x: window.innerWidth / 2, y: window.innerHeight / 3 });
      }
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  if (!target) return null;

  return (
    <div
      ref={wrapRef}
      aria-hidden
      className="pointer-events-none fixed inset-0 z-40 overflow-hidden"
      style={
        {
          // CSS custom properties consumed by the keyframes below
          ["--hb-target-x" as string]: `${target.x}px`,
          ["--hb-target-y" as string]: `${target.y}px`,
        } as React.CSSProperties
      }
    >
      <div
        className={reduced ? "hb-static" : "hb-flight"}
        style={{ position: "absolute", left: 0, top: 0, willChange: "transform" }}
      >
        <Hummingbird reduced={reduced} />
      </div>

      <style>{`
        @keyframes hb-flight {
          0%   { transform: translate(calc(100vw + 80px), 30vh) rotate(-6deg); }
          18%  { transform: translate(calc(var(--hb-target-x) + 120px), calc(var(--hb-target-y) + 10px)) rotate(-4deg); }
          30%  { transform: translate(calc(var(--hb-target-x) + 90px), calc(var(--hb-target-y) - 6px)) rotate(-2deg); }
          /* Circle the logo (clockwise) */
          42%  { transform: translate(calc(var(--hb-target-x) + 70px), calc(var(--hb-target-y) - 60px)) rotate(15deg); }
          52%  { transform: translate(calc(var(--hb-target-x) - 10px), calc(var(--hb-target-y) - 80px)) rotate(35deg); }
          62%  { transform: translate(calc(var(--hb-target-x) - 80px), calc(var(--hb-target-y) - 30px)) rotate(90deg); }
          72%  { transform: translate(calc(var(--hb-target-x) - 40px), calc(var(--hb-target-y) + 40px)) rotate(150deg); }
          80%  { transform: translate(calc(var(--hb-target-x) + 60px), calc(var(--hb-target-y) + 10px)) rotate(200deg); }
          85%  { transform: translate(calc(var(--hb-target-x) + 90px), calc(var(--hb-target-y) - 4px)) rotate(-6deg); opacity: 1; }
          100% { transform: translate(calc(100vw - 40px), -60px) rotate(-18deg); opacity: 0; }
        }
        .hb-flight {
          animation: hb-flight 4.6s cubic-bezier(.42,.0,.2,1) both;
        }
        .hb-static {
          transform: translate(calc(100vw - 90px), 40px);
          opacity: 0.85;
        }
        @keyframes hb-bob {
          0%,100% { transform: translateY(0); }
          50%     { transform: translateY(-2px); }
        }
        .hb-body { animation: hb-bob 1.6s ease-in-out infinite; transform-origin: center; }

        @keyframes hb-wing-up {
          0%,100% { transform: rotate(-18deg); }
          50%     { transform: rotate(38deg); }
        }
        @keyframes hb-wing-down {
          0%,100% { transform: rotate(18deg); }
          50%     { transform: rotate(-38deg); }
        }
        .hb-wing-top    { animation: hb-wing-up   0.08s linear infinite; transform-origin: 34px 22px; }
        .hb-wing-bottom { animation: hb-wing-down 0.08s linear infinite; transform-origin: 34px 22px; }

        @media (prefers-reduced-motion: reduce) {
          .hb-body, .hb-wing-top, .hb-wing-bottom { animation: none !important; }
        }
      `}</style>
    </div>
  );
}

function Hummingbird({ reduced }: { reduced: boolean }) {
  return (
    <svg
      width="72"
      height="52"
      viewBox="0 0 72 52"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ filter: "drop-shadow(0 4px 8px rgba(30,30,30,0.15))" }}
    >
      <defs>
        <linearGradient id="hb-body-grad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#C97A63" />
          <stop offset="55%" stopColor="#8FA88A" />
          <stop offset="100%" stopColor="#1E1E1E" />
        </linearGradient>
        <linearGradient id="hb-wing-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FAF7F2" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#B7A58D" stopOpacity="0.4" />
        </linearGradient>
      </defs>

      <g className="hb-body">
        {/* Tail */}
        <path
          d="M4 24 L14 20 L16 24 L14 28 Z"
          fill="url(#hb-body-grad)"
          opacity="0.9"
        />
        {/* Body */}
        <ellipse cx="26" cy="24" rx="14" ry="7" fill="url(#hb-body-grad)" />
        {/* Head */}
        <circle cx="40" cy="22" r="6" fill="url(#hb-body-grad)" />
        {/* Eye */}
        <circle cx="42" cy="21" r="1" fill="#FAF7F2" />
        {/* Beak */}
        <path d="M46 22 L64 20 L46 24 Z" fill="#1E1E1E" />

        {/* Wings */}
        <g className={reduced ? "" : "hb-wing-top"}>
          <path
            d="M32 22 Q40 6 60 12 Q46 20 34 24 Z"
            fill="url(#hb-wing-grad)"
            stroke="#B7A58D"
            strokeWidth="0.5"
            opacity="0.85"
          />
        </g>
        <g className={reduced ? "" : "hb-wing-bottom"}>
          <path
            d="M32 22 Q40 40 58 34 Q46 26 34 24 Z"
            fill="url(#hb-wing-grad)"
            stroke="#B7A58D"
            strokeWidth="0.5"
            opacity="0.7"
          />
        </g>
      </g>
    </svg>
  );
}
