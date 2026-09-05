"use client";

import React from "react";

interface ChainLogoProps {
  slug: string;
  name?: string;
  size?: "xs" | "sm" | "md" | "lg";
  className?: string;
  showText?: boolean;
}

export const ChainLogo: React.FC<ChainLogoProps> = ({
  slug,
  name,
  size = "sm",
  className = "",
  showText = false,
}) => {
  const normalized = (slug || "").toLowerCase();

  // Size configurations
  const heightClass =
    size === "xs"
      ? "h-4 px-1.5 text-[9px]"
      : size === "sm"
      ? "h-5 px-2 text-[10px]"
      : size === "md"
      ? "h-7 px-3 text-xs"
      : "h-9 px-4 text-sm";

  const imgHeightClass =
    size === "xs"
      ? "h-3.5 w-auto"
      : size === "sm"
      ? "h-4 w-auto"
      : size === "md"
      ? "h-5 w-auto"
      : "h-7 w-auto";

  if (normalized.includes("bravo")) {
    return (
      <span
        className={`inline-flex items-center justify-center font-black rounded-md tracking-wider bg-[#007A3D] text-white select-none shadow-2xs ${heightClass} ${className}`}
        title="Bravo Supermarket"
      >
        <span>BRAVO</span>
        <span className="w-1.5 h-1.5 rounded-full bg-[#E4002B] ml-1" />
      </span>
    );
  }

  if (normalized.includes("araz")) {
    return (
      <span
        className={`inline-flex items-center justify-center font-black rounded-md tracking-tight bg-[#E30613] text-white select-none shadow-2xs ${heightClass} ${className}`}
        title="Araz Supermarket"
      >
        <span>araz</span>
        <span className="w-1.5 h-1.5 rounded-full bg-[#FEDB00] ml-1" />
      </span>
    );
  }

  if (normalized.includes("oba")) {
    return (
      <span
        className={`inline-flex items-center justify-center font-black rounded-md tracking-widest bg-[#009640] text-[#FEDB00] select-none shadow-2xs ${heightClass} ${className}`}
        title="OBA Market"
      >
        <span>OBA</span>
      </span>
    );
  }

  if (normalized.includes("bazarstore")) {
    return (
      <span
        className={`inline-flex items-center justify-center font-black rounded-md tracking-tight bg-[#D01026] text-white select-none shadow-2xs ${heightClass} ${className}`}
        title="Bazarstore"
      >
        <span>bazarstore</span>
      </span>
    );
  }

  // Fallback generic
  return (
    <span
      className={`inline-flex items-center justify-center font-bold rounded-md bg-slate-800 text-white ${heightClass} ${className}`}
    >
      {name || slug}
    </span>
  );
};
