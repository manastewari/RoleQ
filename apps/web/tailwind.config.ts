import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: "#172033",
        muted: "#68748a",
        line: "#dfe5ee",
        canvas: "#f5f7fb",
        brand: {
          50: "#eef8f5",
          100: "#d7eee7",
          500: "#2e7d6c",
          600: "#246858",
          700: "#1d5549"
        },
        coral: "#e9785f"
      },
      boxShadow: {
        card: "0 1px 2px rgba(20, 29, 48, .04), 0 12px 32px rgba(20, 29, 48, .06)"
      }
    }
  },
  plugins: []
} satisfies Config;

