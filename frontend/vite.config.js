import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
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
  },
})
