import { useEffect, useRef, useState } from "react";

/**
 * Signature hummingbird — a large, detailed, iridescent bird that hovers
 * as the focal point of the welcome experience. It gracefully fades and
 * drifts off-screen on the first meaningful user interaction (pointer
 * move, scroll, click, key press, or touch).
 *
 * Motion is calm and organic:
 *   - Continuous wing flap (fast, blurred).
 *   - Gentle body bob and micro-drift (breathing).
 *   - Occasional slow head turns.
 *   - Slow positional drift so it feels alive but never busy.
 *
 * Respects prefers-reduced-motion: renders as a still, elegant portrait.
 */
export function HummingbirdMascot() {
  const [reduced, setReduced] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const armed = useRef(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, []);

  // Arm interaction listeners after a short delay so the entrance is felt.
  useEffect(() => {
    const t = window.setTimeout(() => {
      armed.current = true;
    }, 1600);
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => {
    const dismiss = () => {
      if (!armed.current || dismissed) return;
      setDismissed(true);
    };
    const opts: AddEventListenerOptions = { passive: true };
    window.addEventListener("pointermove", dismiss, opts);
    window.addEventListener("scroll", dismiss, opts);
    window.addEventListener("wheel", dismiss, opts);
    window.addEventListener("touchstart", dismiss, opts);
    window.addEventListener("keydown", dismiss);
    window.addEventListener("click", dismiss);
    return () => {
      window.removeEventListener("pointermove", dismiss);
      window.removeEventListener("scroll", dismiss);
      window.removeEventListener("wheel", dismiss);
      window.removeEventListener("touchstart", dismiss);
      window.removeEventListener("keydown", dismiss);
      window.removeEventListener("click", dismiss);
    };
  }, [dismissed]);

  return (
    <div
      aria-hidden
      className={[
        "pointer-events-none fixed inset-0 z-40 overflow-hidden",
        "flex items-start justify-center",
        "transition-opacity duration-[1400ms] ease-out",
        dismissed ? "opacity-0" : "opacity-100",
      ].join(" ")}
    >
      <div
        className={[
          "hb-stage",
          reduced ? "hb-stage--still" : "",
          dismissed ? "hb-stage--exit" : "hb-stage--enter",
        ].join(" ")}
      >
        <Hummingbird reduced={reduced} />
      </div>

      <style>{`
        .hb-stage {
          position: absolute;
          top: 6vh;
          left: 50%;
          width: min(46vh, 60vw);
          aspect-ratio: 3 / 2;
          transform: translateX(-50%);
          will-change: transform, opacity;
        }

        /* Slow positional drift — the whole bird moves a few pixels in a long, calm loop. */
        @keyframes hb-drift {
          0%,100% { transform: translate(calc(-50% + 0px), 0px); }
          25%     { transform: translate(calc(-50% + 10px), -6px); }
          50%     { transform: translate(calc(-50% - 6px), -10px); }
          75%     { transform: translate(calc(-50% - 12px), -4px); }
        }
        @keyframes hb-enter-in {
          0%   { opacity: 0; transform: translate(calc(-50% + 40px), 30px) scale(0.96); }
          100% { opacity: 1; transform: translate(-50%, 0) scale(1); }
        }
        @keyframes hb-exit-out {
          0%   { opacity: 1; transform: translate(-50%, 0) scale(1); }
          100% { opacity: 0; transform: translate(calc(-50% + 90vw), -30vh) scale(0.9) rotate(-8deg); }
        }
        .hb-stage--enter { animation: hb-enter-in 1600ms cubic-bezier(.22,.8,.28,1) both, hb-drift 14s ease-in-out 1600ms infinite; }
        .hb-stage--exit  { animation: hb-exit-out 1600ms cubic-bezier(.5,0,.3,1) forwards; }
        .hb-stage--still { animation: none !important; }

        /* Body — subtle vertical hover, like the bird holding position. */
        @keyframes hb-body-hover {
          0%,100% { transform: translateY(0) rotate(0deg); }
          50%     { transform: translateY(-4px) rotate(0.4deg); }
        }
        .hb-body { animation: hb-body-hover 2.4s ease-in-out infinite; transform-origin: 50% 60%; }

        /* Head — occasional slow turn. */
        @keyframes hb-head-turn {
          0%, 42%, 100% { transform: rotate(0deg); }
          46%, 58%      { transform: rotate(-6deg); }
          62%, 74%      { transform: rotate(4deg); }
          78%           { transform: rotate(0deg); }
        }
        .hb-head { animation: hb-head-turn 9s ease-in-out infinite; transform-origin: 70% 55%; transform-box: fill-box; }

        /* Wings — fast flap, both blurred for motion realism. */
        @keyframes hb-wing-up {
          0%,100% { transform: rotate(-14deg) scaleY(0.95); }
          50%     { transform: rotate(46deg)  scaleY(1.05); }
        }
        @keyframes hb-wing-down {
          0%,100% { transform: rotate(14deg)  scaleY(1.05); }
          50%     { transform: rotate(-46deg) scaleY(0.95); }
        }
        .hb-wing {
          transform-box: fill-box;
          transform-origin: 15% 50%;
          filter: blur(1.2px);
          opacity: 0.92;
        }
        .hb-wing--upper { animation: hb-wing-up   0.09s linear infinite; }
        .hb-wing--lower { animation: hb-wing-down 0.09s linear infinite; opacity: 0.55; filter: blur(2.4px); }

        /* Tail — barely perceptible sway. */
        @keyframes hb-tail-sway {
          0%,100% { transform: rotate(-1deg); }
          50%     { transform: rotate(2deg); }
        }
        .hb-tail { animation: hb-tail-sway 3s ease-in-out infinite; transform-origin: 90% 50%; transform-box: fill-box; }

        @media (prefers-reduced-motion: reduce) {
          .hb-body, .hb-head, .hb-wing, .hb-tail { animation: none !important; filter: none !important; }
        }

        @media (max-width: 640px) {
          .hb-stage { top: 4vh; width: min(70vw, 52vh); }
        }
      `}</style>
    </div>
  );
}

function Hummingbird({ reduced }: { reduced: boolean }) {
  return (
    <svg
      viewBox="0 0 600 400"
      width="100%"
      height="100%"
      xmlns="http://www.w3.org/2000/svg"
      style={{
        overflow: "visible",
        filter: "drop-shadow(0 24px 40px rgba(20, 30, 50, 0.18)) drop-shadow(0 6px 12px rgba(20, 30, 50, 0.12))",
      }}
    >
      <defs>
        {/* Iridescent body gradient: emerald → turquoise → sapphire → violet */}
        <linearGradient id="hb-back" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%"  stopColor="#0F5D4A" />
          <stop offset="28%" stopColor="#18B08A" />
          <stop offset="55%" stopColor="#2AC7C7" />
          <stop offset="78%" stopColor="#2A6BE6" />
          <stop offset="100%" stopColor="#6D2FB8" />
        </linearGradient>

        <linearGradient id="hb-belly" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"  stopColor="#E9F4EE" />
          <stop offset="55%" stopColor="#C8D9CE" />
          <stop offset="100%" stopColor="#8FA9A0" />
        </linearGradient>

        {/* Iridescent throat gorget — sapphire to violet with gold flash */}
        <radialGradient id="hb-gorget" cx="0.35" cy="0.4" r="0.7">
          <stop offset="0%"  stopColor="#F6D780" />
          <stop offset="18%" stopColor="#C97ADB" />
          <stop offset="55%" stopColor="#3D5EE0" />
          <stop offset="100%" stopColor="#0E1E4A" />
        </radialGradient>

        {/* Head crown highlight — emerald with gold sheen */}
        <radialGradient id="hb-crown" cx="0.4" cy="0.35" r="0.7">
          <stop offset="0%"  stopColor="#F1E4A0" stopOpacity="0.9" />
          <stop offset="30%" stopColor="#2FCF9A" />
          <stop offset="80%" stopColor="#0B4A3D" />
        </radialGradient>

        {/* Wing gradient — translucent, motion-blurred feel */}
        <linearGradient id="hb-wing" x1="0" y1="0" x2="1" y2="0.6">
          <stop offset="0%"  stopColor="#3B4A66" stopOpacity="0.85" />
          <stop offset="55%" stopColor="#6B7CA0" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#B7C4DC" stopOpacity="0.08" />
        </linearGradient>

        <linearGradient id="hb-tail" x1="0" y1="0" x2="1" y2="0.5">
          <stop offset="0%"  stopColor="#0B2A5C" />
          <stop offset="60%" stopColor="#2A4CA6" />
          <stop offset="100%" stopColor="#7C3DC6" />
        </linearGradient>

        {/* Feather texture overlay */}
        <pattern id="hb-feathers" x="0" y="0" width="14" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(18)">
          <path d="M0 5 Q7 -2 14 5 Q7 12 0 5 Z" fill="rgba(255,255,255,0.08)" />
          <path d="M0 5 Q7 -2 14 5" stroke="rgba(0,0,0,0.08)" strokeWidth="0.4" fill="none" />
        </pattern>

        {/* Iridescent sheen highlight */}
        <linearGradient id="hb-sheen" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%"  stopColor="#FFFFFF" stopOpacity="0.55" />
          <stop offset="40%" stopColor="#FFFFFF" stopOpacity="0.05" />
          <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* --- BIRD --- */}
      <g className="hb-body">
        {/* Tail feathers (behind body) */}
        <g className="hb-tail">
          <path
            d="M120 210
               C 80 200, 50 210, 30 225
               C 55 226, 80 226, 105 224 Z"
            fill="url(#hb-tail)"
          />
          <path
            d="M118 220
               C 78 218, 46 232, 28 248
               C 58 244, 88 238, 112 232 Z"
            fill="url(#hb-tail)"
            opacity="0.85"
          />
          <path
            d="M120 228
               C 88 236, 60 254, 44 272
               C 74 262, 100 250, 120 240 Z"
            fill="url(#hb-tail)"
            opacity="0.7"
          />
          {/* Feather separators */}
          <path d="M40 226 L120 218 M42 246 L120 230 M60 264 L120 238"
                stroke="rgba(255,255,255,0.15)" strokeWidth="0.8" fill="none" />
        </g>

        {/* Lower (back) wing — blurred, translucent, deep blue */}
        <g className={reduced ? "" : "hb-wing hb-wing--lower"}>
          <path
            d="M270 190
               C 300 100, 400 60, 520 90
               C 470 150, 400 190, 320 210 Z"
            fill="url(#hb-wing)"
          />
        </g>

        {/* Main body */}
        <ellipse cx="200" cy="220" rx="95" ry="52" fill="url(#hb-back)" />
        <ellipse cx="200" cy="220" rx="95" ry="52" fill="url(#hb-feathers)" opacity="0.55" />

        {/* Belly / underside */}
        <path
          d="M130 230
             C 160 268, 240 275, 285 245
             C 260 265, 200 272, 150 258 Z"
          fill="url(#hb-belly)"
          opacity="0.9"
        />

        {/* Body sheen */}
        <ellipse cx="180" cy="200" rx="70" ry="28" fill="url(#hb-sheen)" />

        {/* HEAD */}
        <g className="hb-head">
          <circle cx="298" cy="180" r="46" fill="url(#hb-crown)" />
          <circle cx="298" cy="180" r="46" fill="url(#hb-feathers)" opacity="0.5" />
          {/* Crown highlight */}
          <ellipse cx="284" cy="162" rx="22" ry="10" fill="url(#hb-sheen)" opacity="0.7" />

          {/* Throat gorget — iridescent patch */}
          <path
            d="M282 200
               C 300 214, 328 216, 344 208
               C 340 226, 316 236, 292 230
               C 280 224, 276 212, 282 200 Z"
            fill="url(#hb-gorget)"
          />
          <path
            d="M282 200
               C 300 214, 328 216, 344 208"
            stroke="rgba(255,215,120,0.5)" strokeWidth="0.8" fill="none"
          />

          {/* Eye */}
          <circle cx="322" cy="172" r="5.5" fill="#0B0B10" />
          <circle cx="323.6" cy="170.4" r="1.6" fill="#FFFFFF" />
          <circle cx="320.5" cy="173.5" r="0.9" fill="#FFFFFF" opacity="0.6" />

          {/* Beak — long, slender, slightly curved */}
          <path
            d="M340 184
               C 400 178, 460 176, 520 178
               C 460 184, 400 188, 342 190 Z"
            fill="#141018"
          />
          <path
            d="M340 184 C 400 178, 460 176, 520 178"
            stroke="rgba(255,255,255,0.25)" strokeWidth="0.6" fill="none"
          />
        </g>

        {/* Upper (front) wing — blurred, sweeping across the body */}
        <g className={reduced ? "" : "hb-wing hb-wing--upper"}>
          <path
            d="M240 200
               C 280 90, 420 40, 560 70
               C 500 140, 400 190, 300 220 Z"
            fill="url(#hb-wing)"
          />
          {/* Feather streaks */}
          <path
            d="M260 190 C 320 130, 420 90, 540 90"
            stroke="rgba(255,255,255,0.25)" strokeWidth="1" fill="none"
          />
          <path
            d="M270 205 C 340 155, 440 120, 550 110"
            stroke="rgba(0,0,0,0.2)" strokeWidth="0.8" fill="none"
          />
        </g>

        {/* Tiny feet tucked under */}
        <path d="M198 268 l -4 10 M212 270 l 2 10"
              stroke="#2A1F1A" strokeWidth="1.6" strokeLinecap="round" fill="none" />
      </g>
    </svg>
  );
}
