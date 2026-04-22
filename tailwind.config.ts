import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          blue: "#2563EB",
          indigo: "#4F46E5",
          sky: "#0EA5E9",
        },
        surface: {
          DEFAULT: "#F7F9FF",
          card: "#FFFFFF",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
      },
      animation: {
        "blob-1": "blob-move-1 24s ease-in-out infinite",
        "blob-2": "blob-move-2 30s ease-in-out infinite",
        "blob-3": "blob-move-3 20s ease-in-out infinite",
        "pulse-slow": "pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "spin-slow": "spin 8s linear infinite",
        "scan-line": "scanLine 2.2s ease-in-out infinite",
        "float": "float 6s ease-in-out infinite",
      },
      keyframes: {
        "blob-move-1": {
          "0%, 100%": { transform: "translate(0%, 0%) scale(1)" },
          "25%": { transform: "translate(5%, -8%) scale(1.05)" },
          "50%": { transform: "translate(-3%, 5%) scale(0.96)" },
          "75%": { transform: "translate(8%, 2%) scale(1.02)" },
        },
        "blob-move-2": {
          "0%, 100%": { transform: "translate(0%, 0%) scale(1)" },
          "30%": { transform: "translate(-8%, 6%) scale(0.96)" },
          "60%": { transform: "translate(5%, -4%) scale(1.04)" },
        },
        "blob-move-3": {
          "0%, 100%": { transform: "translate(0%, 0%) scale(1)" },
          "40%": { transform: "translate(6%, 6%) scale(1.05)" },
          "70%": { transform: "translate(-4%, -6%) scale(0.95)" },
        },
        scanLine: {
          "0%": { top: "0%", opacity: "0" },
          "10%": { opacity: "1" },
          "90%": { opacity: "1" },
          "100%": { top: "100%", opacity: "0" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-8px)" },
        },
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "gradient-brand": "linear-gradient(135deg, #2563EB, #4F46E5)",
      },
      boxShadow: {
        "glass": "0 8px 32px rgba(0,0,0,0.06), 0 1px 0 rgba(255,255,255,0.9) inset",
        "card": "0 2px 16px rgba(0,0,0,0.06), 0 1px 4px rgba(0,0,0,0.04)",
        "card-hover": "0 8px 40px rgba(0,0,0,0.1), 0 2px 8px rgba(0,0,0,0.06)",
        "blue": "0 4px 24px rgba(37,99,235,0.35)",
        "blue-lg": "0 8px 40px rgba(37,99,235,0.4)",
      },
    },
  },
  plugins: [],
};

export default config;
