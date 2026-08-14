/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#14181C",
        "ink-raised": "#1D2329",
        paper: "#EDE7D9",
        "paper-dim": "#DFD8C6",
        brass: "#B08D57",
        "brass-bright": "#D2AB74",
        survey: "#3F5D4E",
        "survey-bright": "#5C8570",
        signal: "#C1462F",
        chalk: "#F7F3EA",
      },
      fontFamily: {
        display: ["Fraunces", "serif"],
        body: ["Inter", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
      backgroundImage: {
        contour:
          "repeating-radial-gradient(circle at 50% 50%, transparent 0, transparent 38px, rgba(176,141,87,0.06) 39px)",
      },
    },
  },
  plugins: [],
}
