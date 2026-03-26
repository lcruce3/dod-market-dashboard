import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        navy: { DEFAULT: "#03065A", light: "#0a1068", dark: "#020440" },
        accent: { DEFAULT: "#54a2d3", light: "#7bbde3" },
        "brand-blue": "#2A5CBA",
      },
    },
  },
  plugins: [],
};
export default config;
