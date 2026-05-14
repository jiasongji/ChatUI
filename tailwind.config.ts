import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#e6f7f4",
          100: "#b3e8df",
          200: "#80d9c9",
          300: "#4dcab3",
          400: "#26bfa5",
          500: "#10a37f",
          600: "#0d8a6a",
          700: "#0a7156",
          800: "#075841",
          900: "#043f2d"
        },
        surface: {
          50: "#f9f9f9",
          100: "#ececec",
          200: "#e3e3e3",
          300: "#d1d1d1",
          400: "#a3a3a3",
          500: "#737373",
          600: "#525252",
          700: "#2f2f2f",
          800: "#212121",
          900: "#171717"
        }
      },
      animation: {
        "fade-in": "fadeIn 0.2s ease-out",
        "slide-in": "slideIn 0.25s ease-out"
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0", transform: "translateY(4px)" },
          "100%": { opacity: "1", transform: "translateY(0)" }
        },
        slideIn: {
          "0%": { opacity: "0", transform: "translateX(-8px)" },
          "100%": { opacity: "1", transform: "translateX(0)" }
        }
      }
    }
  },
  plugins: [require("@tailwindcss/typography")]
};

export default config;
