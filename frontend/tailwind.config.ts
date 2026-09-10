import type { Config } from "tailwindcss";

export default {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        brand: {
          DEFAULT: "#235434",
          dark: "#1B4229",
          light: "#35774C",
          accent: "#4A9462",
          soft: "#F1F7F3",
          border: "#DFECE3",
        },
        emerald: {
          50: "#F1F7F3",
          100: "#DFECE3",
          200: "#BEDBCA",
          300: "#98C5A8",
          400: "#6DAA82",
          500: "#4A9462",
          600: "#35774C",
          700: "#235434", // Signature Logo Background (#235434)
          800: "#1B4229",
          900: "#143320",
          950: "#0A1B11",
        },
        sebet: {
          50: "#F1F7F3",
          100: "#DFECE3",
          200: "#BEDBCA",
          300: "#98C5A8",
          400: "#6DAA82",
          500: "#4A9462",
          600: "#35774C",
          700: "#235434",
          800: "#1B4229",
          900: "#143320",
          950: "#0A1B11",
        },
        chains: {
          bravo: "#007A3D",
          araz: "#E30613",
          oba: "#009640",
          bazarstore: "#D01026",
        },
      },
    },
  },
  plugins: [],
} satisfies Config;

