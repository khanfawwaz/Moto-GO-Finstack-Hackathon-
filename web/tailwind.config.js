/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: { DEFAULT: "#10243A", soft: "#3C5068", mute: "#5F7388" },
        mint: { DEFAULT: "#EEF7F3", deep: "#D9EEE6" },
        go: { DEFAULT: "#18A999", dark: "#0B7D70", light: "#BFF0E6" },
        coral: { DEFAULT: "#F0505A", dark: "#C4343E", light: "#FFE1E3" },
        sun: { DEFAULT: "#FFC845", dark: "#B77D00", light: "#FFF1C7" },
        sky: { DEFAULT: "#4DA3FF", dark: "#1F6FCC", light: "#DCEEFF" },
      },
      fontFamily: { sans: ["Nunito", "ui-rounded", "system-ui", "sans-serif"] },
      borderRadius: { "4xl": "2rem" },
      boxShadow: {
        chunk: "0 4px 0 0 rgba(16,36,58,.14)",
        "chunk-go": "0 4px 0 0 #0B7D70",
        "chunk-coral": "0 4px 0 0 #C4343E",
        pop: "0 10px 30px -10px rgba(16,36,58,.25)",
      },
      keyframes: {
        pop: { "0%": { transform: "scale(.6)", opacity: "0" }, "70%": { transform: "scale(1.08)" }, "100%": { transform: "scale(1)", opacity: "1" } },
        floaty: { "0%,100%": { transform: "translateY(0)" }, "50%": { transform: "translateY(-6px)" } },
      },
      animation: { pop: "pop .45s cubic-bezier(.2,.9,.3,1.2) both", floaty: "floaty 3.2s ease-in-out infinite" },
    },
  },
  plugins: [],
};
