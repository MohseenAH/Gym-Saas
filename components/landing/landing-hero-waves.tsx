export function LandingHeroWaves() {
  return (
    <div
      aria-hidden="true"
      className="absolute inset-0 overflow-hidden pointer-events-none select-none"
    >
      <svg
        viewBox="0 0 1440 560"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="absolute right-0 top-0 w-[75%] lg:w-[60%] h-full"
        preserveAspectRatio="xMaxYMid meet"
      >
        <defs>
          <linearGradient id="lg-back" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#93C5FD" stopOpacity="0.55" />
            <stop offset="55%" stopColor="#BFDBFE" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#DCEAF7" stopOpacity="0.05" />
          </linearGradient>
          <linearGradient id="lg-mid" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#60A5FA" stopOpacity="0.65" />
            <stop offset="50%" stopColor="#93C5FD" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#DCEAF7" stopOpacity="0.1" />
          </linearGradient>
          <linearGradient id="lg-front" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.72" />
            <stop offset="45%" stopColor="#60A5FA" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#BFDBFE" stopOpacity="0.15" />
          </linearGradient>
          <radialGradient id="rg-glow" cx="75%" cy="20%" r="45%">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#DCEAF7" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Soft ambient glow */}
        <ellipse cx="1100" cy="140" rx="480" ry="260" fill="url(#rg-glow)" />

        {/* Back mountain ridge */}
        <path
          d="M 1440 560 L 1440 80 C 1360 50 1270 70 1200 115 C 1110 170 1040 290 930 315 C 840 335 760 295 660 345 C 560 395 480 490 380 530 C 280 565 190 555 100 560 Z"
          fill="url(#lg-back)"
        />
        {/* Back crest highlight */}
        <path
          d="M 1440 80 C 1360 50 1270 70 1200 115 C 1110 170 1040 290 930 315 C 840 335 760 295 660 345 C 560 395 480 490 380 530"
          stroke="white"
          strokeWidth="2"
          strokeOpacity="0.6"
          fill="none"
        />

        {/* Mid ridge */}
        <path
          d="M 1440 560 L 1440 190 C 1360 155 1280 165 1210 220 C 1120 290 1050 365 940 375 C 840 383 760 345 660 395 C 555 448 480 530 400 555 C 320 575 240 560 160 560 Z"
          fill="url(#lg-mid)"
        />
        {/* Mid crest highlight */}
        <path
          d="M 1440 190 C 1360 155 1280 165 1210 220 C 1120 290 1050 365 940 375 C 840 383 760 345 660 395 C 555 448 480 530 400 555"
          stroke="white"
          strokeWidth="2.5"
          strokeOpacity="0.75"
          fill="none"
        />

        {/* Front ridge */}
        <path
          d="M 1440 560 L 1440 300 C 1360 268 1285 278 1220 335 C 1130 410 1060 445 955 435 C 840 423 770 400 680 445 C 580 495 500 540 420 558 C 340 573 260 560 180 560 Z"
          fill="url(#lg-front)"
        />
        {/* Front crest highlight */}
        <path
          d="M 1440 300 C 1360 268 1285 278 1220 335 C 1130 410 1060 445 955 435 C 840 423 770 400 680 445 C 580 495 500 540 420 558"
          stroke="white"
          strokeWidth="3"
          strokeOpacity="0.9"
          fill="none"
        />
      </svg>
    </div>
  );
}
