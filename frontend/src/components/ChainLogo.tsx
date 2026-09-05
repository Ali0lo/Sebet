"use client";

import React, { useState } from "react";

interface ChainLogoProps {
  slug: string;
  name?: string;
  size?: "xs" | "sm" | "md" | "lg";
  className?: string;
  showText?: boolean;
}

const LOGO_CONFIG: Record<
  string,
  { src?: string; name: string; alt: string; bg: string; textClass: string }
> = {
  bravo: {
    src: "/chains/bravo.png",
    name: "Bravo",
    alt: "Bravo Supermarket",
    bg: "bg-[#74b826]",
    textClass: "text-[#74b826]",
  },
  araz: {
    src: "/chains/araz.png",
    name: "Araz",
    alt: "Araz Supermarket",
    bg: "bg-white",
    textClass: "text-[#E30613]",
  },
  oba: {
    src: "/chains/oba.png",
    name: "OBA",
    alt: "OBA Market",
    bg: "bg-[#007b3d]",
    textClass: "text-[#009640]",
  },
  bazarstore: {
    src: "/chains/bazarstore.png",
    name: "Bazarstore",
    alt: "Bazarstore",
    bg: "bg-[#4a4845]",
    textClass: "text-[#D01026]",
  },
  almarket: {
    src: "/chains/almarket.png",
    name: "Al Market",
    alt: "Al Market",
    bg: "bg-[#E31E24]",
    textClass: "text-[#E31E24]",
  },
  neptun: {
    src: "/chains/neptun.png",
    name: "Neptun",
    alt: "Neptun Supermarket",
    bg: "bg-[#f37021]",
    textClass: "text-[#f37021]",
  },
  spar: {
    src: "/chains/spar.png",
    name: "Spar",
    alt: "Spar Supermarket",
    bg: "bg-white",
    textClass: "text-[#007A3D]",
  },
  rahat: {
    name: "Rahat",
    alt: "Rahat Market",
    bg: "bg-[#009FE3]",
    textClass: "text-[#009FE3]",
  },
  grandmart: {
    name: "Grandmart",
    alt: "Grandmart Supermarket",
    bg: "bg-[#E30613]",
    textClass: "text-[#E30613]",
  },
  bolmart: {
    name: "Bolmart",
    alt: "Bolmart",
    bg: "bg-[#F39200]",
    textClass: "text-[#F39200]",
  },
};

export const ChainLogo: React.FC<ChainLogoProps> = ({
  slug,
  name,
  size = "sm",
  className = "",
  showText = false,
}) => {
  const [hasError, setHasError] = useState(false);
  const normalized = (slug || "").toLowerCase();

  let matchedKey: string | null = null;
  if (normalized.includes("bravo")) matchedKey = "bravo";
  else if (normalized.includes("araz")) matchedKey = "araz";
  else if (normalized.includes("oba")) matchedKey = "oba";
  else if (normalized.includes("bazarstore")) matchedKey = "bazarstore";
  else if (
    normalized.includes("almarket") ||
    normalized.includes("al_market") ||
    normalized.includes("al market")
  )
    matchedKey = "almarket";
  else if (normalized.includes("neptun")) matchedKey = "neptun";
  else if (normalized.includes("spar")) matchedKey = "spar";
  else if (normalized.includes("rahat")) matchedKey = "rahat";
  else if (normalized.includes("grandmart")) matchedKey = "grandmart";
  else if (normalized.includes("bolmart")) matchedKey = "bolmart";

  const config = matchedKey ? LOGO_CONFIG[matchedKey] : null;

  // Sizing definitions
  const sizeMap = {
    xs: { box: "w-4 h-4 rounded-xs", text: "text-[10px]" },
    sm: { box: "w-5 h-5 rounded-md", text: "text-xs font-bold" },
    md: { box: "w-8 h-8 rounded-lg", text: "text-sm font-bold" },
    lg: { box: "w-12 h-12 rounded-xl", text: "text-base font-extrabold" },
  };

  const { box, text } = sizeMap[size] || sizeMap.sm;

  if (config && config.src && !hasError) {
    return (
      <span className={`inline-flex items-center gap-1.5 shrink-0 ${className}`}>
        <span
          className={`${box} overflow-hidden flex items-center justify-center ${config.bg} shadow-2xs border border-black/10 dark:border-white/10 shrink-0`}
          title={config.name}
        >
          <img
            src={config.src}
            alt={config.alt}
            onError={() => setHasError(true)}
            className="w-full h-full object-contain p-0.5"
          />
        </span>
        {showText && (
          <span className={`${text} font-bold text-slate-800 dark:text-slate-100`}>
            {name || config.name}
          </span>
        )}
      </span>
    );
  }

  // Stylish badge for chains without image assets or on fallback
  const displayName = name || config?.name || slug || "Market";
  const badgeBg = config?.bg || "bg-slate-800";

  return (
    <span className={`inline-flex items-center gap-1.5 shrink-0 ${className}`}>
      <span
        className={`${box} overflow-hidden flex items-center justify-center ${badgeBg} text-white font-black text-[10px] shadow-2xs border border-black/10 dark:border-white/10 shrink-0`}
        title={displayName}
      >
        {displayName.charAt(0).toUpperCase()}
      </span>
      {showText && (
        <span className={`${text} font-bold text-slate-800 dark:text-slate-100`}>
          {displayName}
        </span>
      )}
    </span>
  );
};

