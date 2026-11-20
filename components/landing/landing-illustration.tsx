export function LandingIllustration() {
  return (
    <div className="relative w-full max-w-md mx-auto select-none py-4">
      <svg
        viewBox="0 0 500 360"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-auto drop-shadow-md"
      >
        <defs>
          {/* Pedestal blob */}
          <radialGradient id="il-blob" cx="50%" cy="60%" r="50%">
            <stop offset="0%" stopColor="#C3DDF5" stopOpacity="0.9" />
            <stop offset="65%" stopColor="#A9CCE8" stopOpacity="0.65" />
            <stop offset="100%" stopColor="#DCEAF7" stopOpacity="0" />
          </radialGradient>

          {/* Dumbbell plate */}
          <linearGradient id="il-plate-l" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#1E3A5F" />
            <stop offset="55%" stopColor="#0F2340" />
            <stop offset="100%" stopColor="#08162A" />
          </linearGradient>
          <linearGradient id="il-plate-r" x1="1" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#26456E" />
            <stop offset="60%" stopColor="#132D4C" />
            <stop offset="100%" stopColor="#0B1E34" />
          </linearGradient>

          {/* Bar */}
          <linearGradient id="il-bar" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#D8EAFA" />
            <stop offset="30%" stopColor="#FFFFFF" />
            <stop offset="70%" stopColor="#A5C6E4" />
            <stop offset="100%" stopColor="#7BAACD" />
          </linearGradient>

          {/* Bottle */}
          <linearGradient id="il-bottle" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#2563EB" stopOpacity="0.9" />
            <stop offset="45%" stopColor="#60A5FA" />
            <stop offset="85%" stopColor="#2563EB" />
            <stop offset="100%" stopColor="#1D4ED8" />
          </linearGradient>
          <linearGradient id="il-cap" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1E3A5F" />
            <stop offset="100%" stopColor="#0A1826" />
          </linearGradient>

          {/* Towel */}
          <linearGradient id="il-towel" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#FFFFFF" />
            <stop offset="85%" stopColor="#EDF4FC" />
            <stop offset="100%" stopColor="#D2E4F4" />
          </linearGradient>
        </defs>

        {/* Pedestal blob */}
        <ellipse cx="250" cy="265" rx="215" ry="82" fill="url(#il-blob)" />

        {/* Drop shadows */}
        <ellipse cx="375" cy="278" rx="52" ry="16" fill="#7BAAC8" fillOpacity="0.3" />
        <ellipse cx="185" cy="284" rx="88" ry="22" fill="#7BAAC8" fillOpacity="0.38" />

        {/* ——— Shaker Bottle ——— */}
        <g>
          {/* Body */}
          <rect x="348" y="118" width="58" height="130" rx="13" fill="url(#il-bottle)" />
          {/* Highlight */}
          <path d="M356 132 L356 238" stroke="white" strokeWidth="4" strokeLinecap="round" strokeOpacity="0.4" />
          {/* Volume marks */}
          <line x1="358" y1="162" x2="366" y2="162" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeOpacity="0.55" />
          <line x1="358" y1="180" x2="369" y2="180" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeOpacity="0.55" />
          <line x1="358" y1="198" x2="366" y2="198" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeOpacity="0.55" />
          {/* Collar */}
          <rect x="344" y="106" width="66" height="17" rx="5" fill="url(#il-cap)" />
          {/* Cap dome */}
          <path d="M352 106 C352 90 358 83 377 83 C396 83 402 90 402 106 Z" fill="url(#il-cap)" />
          {/* Handle */}
          <path d="M377 83 L377 68 C377 64 383 61 389 61 C395 61 399 65 399 70 L399 83" stroke="#10243E" strokeWidth="7" strokeLinecap="round" fill="none" />
        </g>

        {/* ——— Hexagonal Dumbbell ——— */}
        <g>
          {/* Left plate */}
          <polygon points="98,218 134,189 165,218 160,264 125,288 94,258" fill="url(#il-plate-l)" />
          <polygon points="98,218 134,189 124,288 94,258" fill="#1E3A5F" fillOpacity="0.5" />
          {/* Bar */}
          <rect x="162" y="228" width="82" height="17" rx="4" fill="url(#il-bar)" />
          {/* Knurling */}
          {[178, 188, 198, 208, 218, 228].map((x) => (
            <line key={x} x1={x} y1="228" x2={x} y2="245" stroke="#9BC0E0" strokeWidth="1.5" />
          ))}
          {/* Right plate */}
          <polygon points="240,214 275,185 305,214 300,258 265,282 236,253" fill="url(#il-plate-r)" />
          <polygon points="240,214 275,185 305,214 275,222" fill="#3B6396" fillOpacity="0.35" />
        </g>

        {/* ——— Folded Towel ——— */}
        <g>
          {/* Shadow layer */}
          <rect x="306" y="244" width="120" height="38" rx="15" fill="#A0C3DC" />
          {/* Bottom fold */}
          <rect x="302" y="234" width="126" height="40" rx="17" fill="url(#il-towel)" stroke="#D0E6F5" strokeWidth="1.5" />
          {/* Top fold */}
          <rect x="310" y="225" width="112" height="30" rx="13" fill="url(#il-towel)" stroke="#C2D9EF" strokeWidth="1.5" />
          {/* Blue stripes */}
          <path d="M320 230 L320 252" stroke="#2563EB" strokeWidth="2.5" strokeLinecap="round" />
          <path d="M313 240 L313 268" stroke="#2563EB" strokeWidth="2.5" strokeLinecap="round" />
          {/* Roll highlight */}
          <path d="M404 232 C418 232 418 246 409 249 C400 251 397 242 406 240" stroke="#94BBD9" strokeWidth="1.5" fill="none" strokeLinecap="round" />
        </g>
      </svg>
    </div>
  );
}
