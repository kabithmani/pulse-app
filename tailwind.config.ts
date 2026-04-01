import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          '-apple-system', 'BlinkMacSystemFont', 'SF Pro Display',
          'Segoe UI', 'Roboto', 'Helvetica Neue', 'sans-serif',
        ],
      },
      colors: {
        pulse: {
          50: '#f8f9fa',
          100: '#f1f3f5',
          200: '#e9ecef',
          300: '#dee2e6',
          400: '#ced4da',
          500: '#adb5bd',
          600: '#868e96',
          700: '#495057',
          800: '#343a40',
          900: '#212529',
          accent: '#007AFF',
          'accent-light': '#E5F1FF',
          danger: '#FF3B30',
          'danger-light': '#FFF0EF',
          success: '#34C759',
          'success-light': '#EEFBF2',
          warning: '#FF9500',
          'warning-light': '#FFF7ED',
        },
      },
      borderRadius: {
        'xl': '16px',
        '2xl': '20px',
      },
      boxShadow: {
        'card': '0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.02)',
        'card-hover': '0 4px 12px rgba(0,0,0,0.06), 0 2px 4px rgba(0,0,0,0.03)',
        'modal': '0 20px 60px rgba(0,0,0,0.12), 0 4px 12px rgba(0,0,0,0.04)',
      },
    },
  },
  plugins: [],
};

export default config;
