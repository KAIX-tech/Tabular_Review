import type { Config } from "tailwindcss";

// Token colors are defined as RGB channels in globals.css (:root) so Tailwind
// opacity modifiers (e.g. ring-primary/40) work via rgb(var(--x) / <alpha-value>).
const token = (name: string) => `rgb(var(${name}) / <alpha-value>)`;

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "sans-serif"],
        serif: ["Merriweather", "serif"],
      },
      colors: {
        canvas: token("--canvas"),
        surface: {
          DEFAULT: token("--surface"),
          muted: token("--surface-muted"),
        },
        border: {
          DEFAULT: token("--border"),
          strong: token("--border-strong"),
        },
        ink: {
          DEFAULT: token("--ink"),
          2: token("--ink-2"),
          3: token("--ink-3"),
        },
        primary: {
          DEFAULT: token("--primary"),
          hover: token("--primary-hover"),
          soft: token("--primary-soft"),
        },
      },
      boxShadow: {
        soft: "0 1px 2px 0 rgb(11 18 32 / 0.04), 0 1px 3px 0 rgb(11 18 32 / 0.05)",
        card: "0 1px 2px rgb(11 18 32 / 0.04), 0 8px 24px -8px rgb(11 18 32 / 0.10)",
        popover: "0 10px 38px -10px rgb(11 18 32 / 0.22), 0 4px 12px -6px rgb(11 18 32 / 0.12)",
      },
    },
  },
  plugins: [],
};

export default config;
