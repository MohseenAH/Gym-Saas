import React from "react";

export type GymApraLogoVariant = "white" | "dark" | "orange" | "black-bg" | "symbol";

interface GymApraLogoProps {
  /**
   * "white" / "orange" -> /brand/gymapra-logo.svg (orange transparent full logo for dark backgrounds)
   * "dark"             -> /brand/gymapra-logo-light.svg (orange symbol + dark lettering for light backgrounds)
   * "black-bg"         -> /brand/gymapra-logo-black-bg.svg (black background variant)
   * "symbol"           -> /brand/gymapra-symbol.svg (compact brand symbol)
   */
  variant?: GymApraLogoVariant;
  size?: "xs" | "sm" | "md" | "lg";
  className?: string;
}

export function GymApraLogo({
  variant = "orange",
  size = "md",
  className = "",
}: GymApraLogoProps) {
  const isSymbol = variant === "symbol";

  const src =
    variant === "symbol"
      ? "/brand/gymapra-symbol.svg"
      : variant === "dark"
      ? "/brand/gymapra-logo-light.svg"
      : variant === "black-bg"
      ? "/brand/gymapra-logo-black-bg.svg"
      : "/brand/gymapra-logo.svg";

  const lockupSizes = {
    xs: "h-5",
    sm: "h-6",
    md: "h-7",
    lg: "h-8",
  };

  const symbolSizes = {
    xs: "h-4",
    sm: "h-5",
    md: "h-6",
    lg: "h-7",
  };

  const heightClass = isSymbol ? symbolSizes[size] : lockupSizes[size];

  return (
    <img
      src={src}
      alt="GymApra"
      width={isSymbol ? 520 : 500}
      height={isSymbol ? 430 : 115}
      className={`${heightClass} w-auto object-contain select-none shrink-0 ${className}`}
      decoding="async"
    />
  );
}
