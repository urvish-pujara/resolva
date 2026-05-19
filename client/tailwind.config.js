/** @type {import('tailwindcss').Config} */
const withVar = (name) => `rgb(var(${name}) / <alpha-value>)`;

export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        ink: {
          50: '#f8f9fb',
          100: '#eff1f5',
          200: '#dde1ea',
          300: '#c0c6d4',
          400: '#8a92a6',
          500: '#5a6479',
          600: '#3f485c',
          700: '#2c3344',
          800: '#1c2230',
          900: '#0e1220',
        },
        app: withVar('--color-app'),
        surface: {
          DEFAULT: withVar('--color-surface'),
          muted: withVar('--color-surface-muted'),
          hover: withVar('--color-surface-hover'),
          raised: withVar('--color-surface-raised'),
        },
        sidebar: {
          DEFAULT: withVar('--color-sidebar'),
          hover: withVar('--color-sidebar-hover'),
          active: withVar('--color-sidebar-active'),
        },
        accent: {
          DEFAULT: withVar('--color-accent'),
          hover: withVar('--color-accent-hover'),
        },
        fg: {
          DEFAULT: withVar('--color-fg'),
          muted: withVar('--color-fg-muted'),
          subtle: withVar('--color-fg-subtle'),
          strong: withVar('--color-fg-strong'),
        },
        'on-accent': withVar('--color-on-accent'),
        'on-sidebar': {
          DEFAULT: withVar('--color-on-sidebar'),
          muted: withVar('--color-on-sidebar-muted'),
        },
        line: {
          DEFAULT: withVar('--color-line'),
          subtle: withVar('--color-line-subtle'),
          strong: withVar('--color-line-strong'),
        },
        link: withVar('--color-link'),
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
    },
  },
  plugins: [],
};
