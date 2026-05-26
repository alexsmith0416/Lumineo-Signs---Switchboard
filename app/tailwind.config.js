/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        navy: "#141464",
        "navy-light": "#2a2a8a",
        "navy-bg": "#e8eaf5",
        red: {
          DEFAULT: "#E8151B",
          dark: "#c41218",
        },
        "label-bg": "rgba(232,235,245,1)",
        "input-bg": "rgba(242,244,248,1)",
        gray: {
          50: "#f7f8fa",
          100: "#eef0f4",
          200: "#dde0e8",
          300: "#c8ccd6",
          500: "#6b7280",
          700: "#374151",
          900: "#111827",
        },
      },
      fontFamily: {
        sans: [
          "Segoe UI",
          "-apple-system",
          "BlinkMacSystemFont",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
      },
      boxShadow: {
        "punch-card": "0 4px 14px rgba(20, 20, 100, 0.22)",
        "red-cta": "0 4px 12px rgba(232, 21, 27, 0.28)",
      },
      animation: {
        "pulse-dot": "pulseDot 1.6s infinite",
      },
      keyframes: {
        pulseDot: {
          "0%": { boxShadow: "0 0 0 0 rgba(34,197,94,0.7)" },
          "70%": { boxShadow: "0 0 0 8px rgba(34,197,94,0)" },
          "100%": { boxShadow: "0 0 0 0 rgba(34,197,94,0)" },
        },
      },
    },
  },
  plugins: [],
};
