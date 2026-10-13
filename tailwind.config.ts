import type { Config } from "tailwindcss";

// Palette « Kapok » : or, vert profond, beige, blanc cassé, noir élégant.
const config: Config = {
  content: ["./index.html", "./src/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        or: { DEFAULT: "#C8A15A", pale: "#E6D3A3", fonce: "#8A6A2E" },
        foret: "#1F3D2B",
        nuit: "#12261A",
        kapok: "#EFE6D6",
        coton: "#FAF7F1",
        ebene: "#141414",
        terre: "#B5563A",
        sepia: { clair: "#B89566", fonce: "#5E4526" },
        sauge: "#9DB08A",
      },
      fontFamily: {
        serif: ["Fraunces Variable", "Fraunces", "Georgia", "serif"],
        sans: ["Inter", "system-ui", "sans-serif"],
        main: ["Caveat", "cursive"],
      },
      boxShadow: {
        doux: "0 10px 30px rgba(18,38,26,0.12), 0 1px 3px rgba(18,38,26,0.06)",
        or: "0 10px 28px rgba(200,161,90,0.38)",
        polaroid: "0 10px 24px rgba(0,0,0,0.35)",
      },
    },
  },
  plugins: [],
};

export default config;
