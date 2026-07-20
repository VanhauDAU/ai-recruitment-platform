import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { visualizer } from 'rollup-plugin-visualizer'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    // Audit bundle: `ANALYZE=1 npm run build` sinh dist/stats.html (treemap gzip).
    process.env.ANALYZE
      && visualizer(process.env.ANALYZE === 'json'
        ? { filename: 'dist/stats.json', template: 'raw-data', gzipSize: true }
        : { filename: 'dist/stats.html', gzipSize: true, template: 'treemap' }),
  ],
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, 'src') },
  },
  server: {
    // PORT do tool preview cấp khi 5173 bận; dev bình thường vẫn là 5173.
    port: Number(process.env.PORT) || 5173,
  },
  build: {
    rollupOptions: {
      output: {
        // Chỉ tách core React (dùng ở mọi route, ít đổi) thành vendor chunk riêng
        // để cache tốt qua các lần deploy. KHÔNG gom antd vào 1 chunk: để Vite tự
        // tách antd theo route, tránh kéo antd của trang admin vào initial load.
        manualChunks(id) {
          if (/[\\/]node_modules[\\/](react|react-dom|react-router|react-router-dom|scheduler)[\\/]/.test(id)) return 'react'
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    environmentOptions: {
      jsdom: { url: 'http://localhost/' },
    },
    setupFiles: './src/test/setup.js',
    css: false,
    exclude: ['tests/e2e/**', 'node_modules/**', 'dist/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: [
        'src/app/router/guards/**/*.{js,jsx}',
        'src/entities/session/**/*.{js,jsx}',
        'src/features/auth/api/**/*.js',
        'src/features/auth/model/return-url.js',
        'src/features/saved-jobs/**/*.{js,jsx}',
        'src/features/search-jobs/**/*.{js,jsx}',
        'src/pages/main/account/model/use-my-cvs-data.js',
        'src/shared/api/client.js',
        'src/shared/api/error-mapper.js',
        'src/shared/api/request-deduplication.js',
        'src/shared/api/token-store.js',
      ],
      exclude: ['**/*.test.{js,jsx}', 'src/**/tests/**'],
      thresholds: {
        lines: 75,
        functions: 70,
        branches: 65,
        statements: 75,
      },
    },
  },
})
