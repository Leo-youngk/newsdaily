/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        // Substack 式：标题与正文用衬线，克制耐看
        serif: [
          'Georgia',
          'Cambria',
          '"Times New Roman"',
          '"Songti SC"',
          '"Noto Serif CJK SC"',
          'serif',
        ],
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'Roboto',
          '"Helvetica Neue"',
          '"PingFang SC"',
          '"Microsoft YaHei"',
          'sans-serif',
        ],
      },
      colors: {
        // 暖白纸张基调 + 墨色文字 + 单一克制强调色（terracotta）
        paper: {
          DEFAULT: '#fffdfa',
          soft: '#faf7f2',
          card: '#ffffff',
        },
        ink: {
          DEFAULT: '#1a1917',
          soft: '#3d3b37',
          muted: '#75716a',
          faint: '#a39e95',
        },
        line: '#e9e4db',
        accent: {
          DEFAULT: '#c05621',
          soft: '#e07a45',
          wash: '#fbf0e8',
        },
      },
      maxWidth: {
        reading: '42rem',
        feed: '46rem',
      },
      boxShadow: {
        card: '0 1px 2px rgba(26,25,23,0.04), 0 4px 16px rgba(26,25,23,0.04)',
        pop: '0 8px 40px rgba(26,25,23,0.12)',
      },
      typography: {
        DEFAULT: {
          css: {},
        },
      },
    },
  },
  plugins: [],
};
