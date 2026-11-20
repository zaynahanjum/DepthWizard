/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        geo: {
          bg: "#080c14",
          card: "#0d1424",
          "card-hover": "#131e36",
          surface: "#111a2e",
          border: "#1c2a4a",
          "border-light": "#273b66",
          cyan: "#00d2ff",
          teal: "#00f2c3",
          accent: "#38bdf8",
          muted: "#8899b5",
        },
      },
      fontFamily: {
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      boxShadow: {
        'geo-glow': '0 0 25px -5px rgba(0, 210, 255, 0.15)',
        'geo-glow-teal': '0 0 25px -5px rgba(0, 242, 195, 0.15)',
      }
    },
  },
  plugins: [],
};
