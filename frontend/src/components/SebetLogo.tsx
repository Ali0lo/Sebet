"use client";

import React from "react";

interface SebetLogoProps {
  variant?: "full" | "icon" | "badge";
  size?: "sm" | "md" | "lg";
  className?: string;
}

export const SebetLogo: React.FC<SebetLogoProps> = ({
  variant = "full",
  size = "md",
  className = "",
}) => {
  // Height sizing for full logo
  const heightMap = {
    sm: "h-6",
    md: "h-7 sm:h-8",
    lg: "h-10 sm:h-12",
  };

  // Icon sizing
  const iconSizeMap = {
    sm: "w-7 h-7 p-1 rounded-lg",
    md: "w-8 h-8 sm:w-9 sm:h-9 p-1.5 rounded-xl",
    lg: "w-12 h-12 p-2 rounded-2xl",
  };

  if (variant === "badge") {
    return (
      <div className={`relative inline-flex items-center overflow-hidden rounded-xl shadow-xs ${className}`}>
        <img
          src="/logo-badge.png"
          alt="Sebet"
          className={`${heightMap[size]} w-auto object-contain`}
        />
      </div>
    );
  }

  if (variant === "icon") {
    return (
      <div
        className={`relative inline-flex items-center justify-center bg-[#235434] border border-[#2e6840]/40 shadow-xs shrink-0 overflow-hidden ${iconSizeMap[size]} ${className}`}
      >
        <img
          src="/sebet-icon-transparent.png"
          alt="Sebet Icon"
          className="w-full h-full object-contain drop-shadow-xs"
        />
      </div>
    );
  }

  // Default: variant === "full"
  return (
    <div className={`relative inline-flex items-center shrink-0 ${className}`}>
      {/* Light mode: forest green wordmark */}
      <img
        src="/logo-dark.png"
        alt="Sebet"
        className={`${heightMap[size]} w-auto object-contain dark:hidden select-none`}
      />
      {/* Dark mode: crisp white wordmark */}
      <img
        src="/logo-light.png"
        alt="Sebet"
        className={`${heightMap[size]} w-auto object-contain hidden dark:block select-none`}
      />
    </div>
  );
};

