/**
 * Subtle botanical background — softly swaying leaves as decorative accents.
 * Absolute-positioned, non-interactive, respects prefers-reduced-motion.
 */
export function BotanicalBackground() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 overflow-hidden"
    >
      {/* Top-left leaf cluster */}
      <svg
        className="botanical-leaf botanical-sway-a absolute -top-6 -left-8 opacity-30"
        width="220"
        height="220"
        viewBox="0 0 200 200"
        fill="none"
      >
        <path
          d="M20 180 Q60 100 40 20 Q100 60 120 140 Q80 170 20 180Z"
          fill="#A8B2A1"
          opacity="0.55"
        />
        <path
          d="M40 180 Q80 110 70 40 Q120 80 130 150 Q90 175 40 180Z"
          fill="#8FA88A"
          opacity="0.35"
        />
      </svg>

      {/* Bottom-right frond */}
      <svg
        className="botanical-leaf botanical-sway-b absolute -bottom-10 -right-10 opacity-25"
        width="260"
        height="260"
        viewBox="0 0 200 200"
        fill="none"
      >
        <path
          d="M180 180 Q120 140 100 60 Q80 130 20 170 Q100 200 180 180Z"
          fill="#B7A58D"
          opacity="0.55"
        />
        <path
          d="M180 180 Q140 150 130 90 Q110 145 60 175 Q120 195 180 180Z"
          fill="#A8B2A1"
          opacity="0.4"
        />
      </svg>

      {/* Small floating leaf */}
      <svg
        className="botanical-leaf botanical-sway-c absolute top-1/3 right-8 opacity-20"
        width="72"
        height="72"
        viewBox="0 0 80 80"
        fill="none"
      >
        <path
          d="M10 70 Q40 40 30 10 Q70 30 70 70 Q40 78 10 70Z"
          fill="#8FA88A"
        />
      </svg>

      <style>{`
        .botanical-leaf { transform-origin: 50% 100%; will-change: transform; }
        @keyframes bot-sway-a {
          0%,100% { transform: rotate(-2deg) translateY(0); }
          50%     { transform: rotate(3deg)  translateY(-2px); }
        }
        @keyframes bot-sway-b {
          0%,100% { transform: rotate(2deg)  translateY(0); }
          50%     { transform: rotate(-3deg) translateY(-3px); }
        }
        @keyframes bot-sway-c {
          0%,100% { transform: rotate(-4deg) translateY(0); }
          50%     { transform: rotate(6deg)  translateY(-4px); }
        }
        .botanical-sway-a { animation: bot-sway-a 7s ease-in-out infinite; }
        .botanical-sway-b { animation: bot-sway-b 9s ease-in-out infinite; }
        .botanical-sway-c { animation: bot-sway-c 5.5s ease-in-out infinite; }

        @media (prefers-reduced-motion: reduce) {
          .botanical-sway-a, .botanical-sway-b, .botanical-sway-c {
            animation: none !important;
          }
        }
      `}</style>
    </div>
  );
}
