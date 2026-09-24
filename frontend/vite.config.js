import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { visualizer } from 'rollup-plugin-visualizer'

const isCI = Boolean(process.env.CI)
const apiProxyTarget = process.env.API_PROXY_TARGET || 'http://127.0.0.1:8000'

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
    // API/media đi cùng origin để thiết bị thật trong LAN chỉ cần truy cập một
    // địa chỉ Vite.
    proxy: {
      '/api': {
        target: apiProxyTarget,
        // Giữ Host của trình duyệt để Django tạo URL media trỏ về Vite; Vite
        // tiếp tục proxy /media xuống backend. Development settings cho phép
        // host LAN động, còn production không dùng Vite config này.
        changeOrigin: false,
      },
      '/media': {
        target: apiProxyTarget,
        changeOrigin: false,
      },
    },
  },
  build: {
    // Bundle budget tooling uses the manifest to attribute every emitted chunk
    // and the incremental JS/CSS graph of each lazy route.
    manifest: true,
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
      // CI only consumes the machine-readable summary. Avoid generating and
      // printing the full per-file HTML/LCOV report on every pull request.
      reporter: isCI
        ? ['text-summary', 'json-summary']
        : ['text', 'html', 'lcov', 'json-summary'],
      // AR-P5: đo TOÀN BỘ src/ — allowlist cũ (11 đường dẫn) cho con số 84%
      // không đại diện. Threshold đặt bằng số đo thật tại 2026-07-21 và là
      // RATCHET: chỉ được tăng, không được giảm; PR làm tụt số phải bổ sung test.
      include: ['src/**/*.{js,jsx}'],
      exclude: [
        '**/*.test.{js,jsx}',
        'src/**/tests/**',
        'src/test/**',
        'src/main.jsx',
        'src/App.jsx',
        // Barrel re-export không có logic
        'src/**/index.js',
      ],
      thresholds: {
        statements: 33,
        branches: 29,
        functions: 28,
        lines: 35,
      },
    },
  },
})
