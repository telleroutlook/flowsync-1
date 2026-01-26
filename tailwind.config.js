/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./*.{js,ts,jsx,tsx}",
    "./src/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: '#F5F6F7', // Fiori Horizon App Background
        surface: '#FFFFFF', // Fiori Card/Header Background
        primary: {
          DEFAULT: '#0070F2', // SAP Blue
          hover: '#005AC2',
          foreground: '#FFFFFF'
        },
        secondary: {
          DEFAULT: '#556B82',
          foreground: '#FFFFFF'
        },
        accent: {
          DEFAULT: '#5D36FF', // Joule Purple
          hover: '#4B2BD0',
          foreground: '#FFFFFF'
        },
        text: {
          primary: '#131E29',
          secondary: '#556B82',
        },
        border: {
          subtle: '#D9D9D9',
        },
        input: '#D9D9D9',
        ring: '#0070F2',
        joule: {
          start: '#5d36ff',
          end: '#a100c2',
        },
        success: {
          DEFAULT: '#256F3A',
          foreground: '#FFFFFF',
        },
        warning: {
          DEFAULT: '#E76500',
          foreground: '#FFFFFF',
        },
        critical: {
          DEFAULT: '#E76500',
          foreground: '#FFFFFF',
        },
        negative: {
          DEFAULT: '#AA0808',
          foreground: '#FFFFFF',
        },
        error: {
          DEFAULT: '#AA0808',
          foreground: '#FFFFFF',
        },
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Helvetica', 'Arial', 'sans-serif'],
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'slide-in-right': 'slideInRight 0.3s ease-out',
        'scale-in': 'scaleIn 0.2s ease-out',
        'shimmer': 'shimmer 1.5s infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        slideInRight: {
          '0%': { transform: 'translateX(100%)' },
          '100%': { transform: 'translateX(0)' },
        },
        scaleIn: {
          '0%': { transform: 'scale(0.95)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
    },
  },
  plugins: [],
}
