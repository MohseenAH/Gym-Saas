import React from "react";
import Image from "next/image";
import { GymApraLogo } from "@/components/ui/gymapra-logo";

interface AuthSplitLayoutProps {
  imageSrc: string;
  imageAlt: string;
  leftHeadline: string;
  leftSubheadline?: string;
  desktopTitle?: string;
  desktopSubtitle?: string;
  mobileHeadline?: string;
  mobileSubheadline?: string;
  children: React.ReactNode;
}

export function AuthSplitLayout({
  imageSrc,
  imageAlt,
  leftHeadline,
  leftSubheadline,
  desktopTitle,
  desktopSubtitle,
  mobileHeadline,
  mobileSubheadline,
  children,
}: AuthSplitLayoutProps) {
  const mHeading = mobileHeadline || leftHeadline;
  const mSub = mobileSubheadline || leftSubheadline;

  return (
    <div className="min-h-dvh w-full bg-white flex flex-col lg:grid lg:grid-cols-2 selection:bg-[#2563EB] selection:text-white">
      {/* =========================================================================
          DESKTOP LEFT 50% PHOTOGRAPHIC PANEL (lg+)
          Full viewport height, edge-to-edge, zero outer margins or cards.
          ========================================================================= */}
      <div className="relative hidden lg:flex flex-col justify-between p-8 lg:p-10 xl:p-14 overflow-hidden min-h-dvh h-full w-full select-none">
        {/* Full-bleed Gym Photography */}
        <Image
          src={imageSrc}
          alt={imageAlt}
          fill
          priority
          sizes="50vw"
          className="object-cover object-center"
        />

        {/* Deep Navy/Black Gradient Overlay for Contrast */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#10243E]/95 via-[#10243E]/65 to-[#10243E]/80 z-0" />

        {/* Top GymApra Logo */}
        <div className="relative z-10">
          <GymApraLogo variant="white" size="md" />
        </div>

        {/* Desktop Headline & Description toward Lower-Middle */}
        <div className="relative z-10 my-auto py-8 max-w-md">
          <h1 className="text-2xl xl:text-3xl font-extrabold text-white tracking-tight leading-tight whitespace-pre-line drop-shadow-sm">
            {leftHeadline}
          </h1>
          {leftSubheadline && (
            <p className="text-xs xl:text-sm text-blue-100/90 mt-2.5 whitespace-pre-line leading-relaxed font-normal">
              {leftSubheadline}
            </p>
          )}
        </div>

        {/* Subtle Blue Layered Wave Treatment at the Bottom of Photo */}
        <svg
          className="absolute bottom-0 left-0 w-full h-20 xl:h-24 pointer-events-none z-10"
          viewBox="0 0 500 150"
          preserveAspectRatio="none"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M0,70 C160,135 340,30 500,80 L500,150 L0,150 Z"
            fill="rgba(56, 189, 248, 0.25)"
          />
          <path
            d="M0,95 C180,45 320,120 500,85 L500,150 L0,150 Z"
            fill="rgba(37, 99, 235, 0.45)"
          />
          <path
            d="M0,120 C150,85 350,130 500,110 L500,150 L0,150 Z"
            fill="rgba(29, 78, 216, 0.65)"
          />
        </svg>
      </div>

      {/* =========================================================================
          MOBILE PHOTOGRAPHIC HEADER (< lg)
          Compact, edge-to-edge, with wave transition.
          ========================================================================= */}
      <div className="relative h-44 sm:h-50 w-full lg:hidden overflow-hidden flex flex-col justify-between p-4 sm:p-5 shrink-0 select-none">
        {/* Gym Photography */}
        <Image
          src={imageSrc}
          alt={imageAlt}
          fill
          priority
          sizes="100vw"
          className="object-cover object-center"
        />

        {/* Dark Navy Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#10243E]/90 via-[#10243E]/75 to-[#10243E]/95 z-0" />

        {/* Top Logo */}
        <div className="relative z-10">
          <GymApraLogo variant="white" size="sm" />
        </div>

        {/* Mobile Headline & Subtitle */}
        <div className="relative z-10 pb-2.5">
          <h1 className="text-lg sm:text-xl font-black text-white tracking-tight leading-tight whitespace-pre-line drop-shadow-xs">
            {mHeading}
          </h1>
          {mSub && (
            <p className="text-[11px] sm:text-xs text-blue-100/90 mt-0.5 whitespace-pre-line leading-snug font-normal">
              {mSub}
            </p>
          )}
        </div>

        {/* Mobile Smooth 3D Blue Wave Divider transitioning to white */}
        <svg
          className="absolute bottom-0 left-0 w-full h-8 sm:h-9 pointer-events-none z-10"
          viewBox="0 0 500 80"
          preserveAspectRatio="none"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M0,35 C150,75 350,5 500,45 L500,80 L0,80 Z"
            fill="rgba(56, 189, 248, 0.45)"
          />
          <path
            d="M0,50 C180,20 320,65 500,40 L500,80 L0,80 Z"
            fill="rgba(37, 99, 235, 0.75)"
          />
          <path
            d="M0,62 C160,35 340,70 500,55 L500,80 L0,80 Z"
            fill="#FFFFFF"
          />
        </svg>
      </div>

      {/* =========================================================================
          RIGHT 50% (Desktop) / BOTTOM FORM SECTION (Mobile)
          Full-height white background hosting centered compact authentication card.
          Card background: #F8FBFF, border: #E2EAF5, rounded: 14-16px, max-w: 420px.
          ========================================================================= */}
      <div className="relative z-10 bg-white lg:bg-white flex flex-col items-center justify-center p-4 sm:p-6 lg:p-8 xl:p-10 min-h-[calc(100dvh-11rem)] lg:min-h-dvh h-full w-full overflow-y-auto">
        {/* Compact Form Card: On desktop, styled as #F8FBFF with subtle border and padding; on mobile blends seamlessly */}
        <div className="w-full max-w-[420px] mx-auto my-auto lg:bg-[#F8FBFF] lg:border lg:border-[#E2EAF5] rounded-2xl lg:p-6 lg:shadow-2xs">
          {/* Form Heading (Inside Card) */}
          {(desktopTitle || desktopSubtitle) && (
            <div className="hidden lg:block mb-4 sm:mb-5">
              {desktopTitle && (
                <h2 className="text-xl sm:text-2xl font-bold text-[#10243E] tracking-tight">
                  {desktopTitle}
                </h2>
              )}
              {desktopSubtitle && (
                <p className="text-xs sm:text-sm text-[#64748B] mt-1 font-normal leading-relaxed">
                  {desktopSubtitle}
                </p>
              )}
            </div>
          )}

          {/* Form Content / Children */}
          {children}
        </div>
      </div>
    </div>
  );
}
