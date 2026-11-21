import React from "react";

interface GymApraLogoProps {
  variant?: "white" | "dark";
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function GymApraLogo({
  variant = "white",
  size = "md",
  className = "",
}: GymApraLogoProps) {
  const isWhite = variant === "white";

  const sizeClasses = {
    sm: "h-5 text-base gap-1.5",
    md: "h-6 text-lg gap-2",
    lg: "h-7 text-xl gap-2",
  };

  const iconSizes = {
    sm: "w-5 h-5",
    md: "w-6 h-6",
    lg: "w-7 h-7",
  };

  return (
    <div className={`inline-flex items-center font-black tracking-tight ${sizeClasses[size]} ${className}`}>
      {/* Dynamic GymApra Emblem */}
      <svg
        className={iconSizes[size]}
        viewBox="0 0 36 36"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="gymapra-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#38BDF8" />
            <stop offset="100%" stopColor="#2563EB" />
          </linearGradient>
        </defs>
        <path
          d="M6 25L15 7H23L14 25H6Z"
          fill="url(#gymapra-grad)"
        />
        <path
          d="M16 29L22 17H30L24 29H16Z"
          fill="#38BDF8"
          fillOpacity={isWhite ? "0.9" : "0.85"}
        />
        <circle cx="27" cy="11" r="3" fill="#60A5FA" />
      </svg>

      <span className={isWhite ? "text-white" : "text-[#10243E]"}>
        Gym<span className="text-[#38BDF8]">Apra</span>
      </span>
    </div>
  );
}
