/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        "dark-blue": "#020a19",
        "off-blue":  "#d5e0ff",
        "off-white": "#d5e0ff",
      },
      fontFamily: {
        sans: ["Grotesk", "Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["'Commit Mono'", "'JetBrains Mono'", "ui-monospace", "monospace"],
      },
      letterSpacing: {
        "ht-4":  "0.04em",
        "ht-8":  "0.08em",
        "ht-16": "0.16em",
        "ht-24": "0.24em",
      },
      fontSize: {
        // Fixed rem scale (product register). 16px base = 1rem.
        "ht-11": ["0.6875rem", { lineHeight: "1.2" }],
        "ht-12": ["0.75rem", { lineHeight: "1.2" }],
        "ht-14": ["0.875rem", { lineHeight: "1.6" }],
        "ht-16": ["1rem", { lineHeight: "1.6" }],
        "ht-32": ["2rem", { lineHeight: "1.05" }],
        "ht-40": ["2.5rem", { lineHeight: "1.0" }],
        "ht-56": ["3.5rem", { lineHeight: "1.0" }],
      },
    },
  },
  plugins: [],
};
