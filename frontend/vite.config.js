import path from 'node:path'
import { paraglideVitePlugin } from '@inlang/paraglide-js'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import { visualizer } from 'rollup-plugin-visualizer'

const isCI = Boolean(process.env.CI)

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Vite intentionally does not copy .env values into process.env while this
  // config file is evaluated. Load only for config-time tooling; nothing here
  // is exposed to the browser unless it has the VITE_ prefix.
  const env = loadEnv(mode, process.cwd(), '')
  const setting = (name, fallback = '') => process.env[name] || env[name] || fallback
  const apiProxyTarget = setting('API_PROXY_TARGET', 'http://127.0.0.1:8000')
  const analyze = setting('ANALYZE')

  return {
    plugins: [
      // Biên dịch messages/**/{vi,en}.json thành hàm ES (tree-shake theo từng
      // chuỗi). Chỉ lưu localStorage rồi về vi: không đọc navigator.language để
      // người dùng Việt dùng trình duyệt tiếng Anh vẫn mặc định tiếng Việt.
      paraglideVitePlugin({
        project: './project.inlang',
        outdir: './src/shared/config/i18n/paraglide',
        strategy: ['localStorage', 'baseLocale'],
        localStorageKey: 'procv_lang',
        emitReadme: false,
      }),
      react(),
      tailwindcss(),
      // Audit bundle: `ANALYZE=1 npm run build` sinh dist/stats.html (treemap gzip).
      analyze
        && visualizer(analyze === 'json'
          ? { filename: 'dist/stats.json', template: 'raw-data', gzipSize: true }
          : { filename: 'dist/stats.html', gzipSize: true, template: 'treemap' }),
    ],
    resolve: {
      alias: { '@': path.resolve(import.meta.dirname, 'src') },
    },
    server: {
      // PORT do tool preview cấp khi 5173 bận; dev bình thường vẫn là 5173.
      port: Number(setting('PORT')) || 5173,
      // Backend/worker trong Docker gọi Vite qua hostname service `frontend`
      // (SEO shell, trang in PDF `cv-print.html`); Vite chặn Host lạ mặc định.
      allowedHosts: ['frontend'],
      // Dev phục vụ từng module một: biên dịch sẵn shell + trang chủ ngay khi
      // server khởi động để lần mở đầu không chờ transform hàng trăm file.
      warmup: {
        clientFiles: ['./src/main.jsx', './src/app/layouts/MainLayout.jsx', './src/pages/main/home/Home.jsx'],
      },
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
        // WebSocket thông báo: runserver (daphne trong INSTALLED_APPS) phục vụ ASGI.
        '/ws': {
          target: apiProxyTarget,
          changeOrigin: false,
          ws: true,
        },
        // Link theo dõi của kênh chiến dịch (/r/<mã>, /r/<mã>/<tin hoặc cong-ty>):
        // backend đếm lượt bấm rồi chuyển hướng.
        '^/r/[A-Za-z0-9]+(/[A-Za-z0-9_-]+)?$': {
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
        // Barrel (public index.js) của slice chỉ re-export, không chạy gì lúc
        // import. Khai báo để bundler đi thẳng tới module thật: guard chỉ cần
        // `withReturnUrl` thì không kéo LoginForm cùng barrel vào bundle đầu
        // (25/11: JS khởi tạo -52 KiB, CSS -1,7 KiB). check:architecture chặn
        // barrel có lệnh chạy lúc import.
        treeshake: {
          moduleSideEffects: [{ test: /[\\/]src[\\/](features|entities|widgets)[\\/].*[\\/]index\.js$/, sideEffects: false }],
        },
        // cv-print.html: trang in PDF do worker mở bằng Chromium (CVT-2).
        input: {
          main: path.resolve(import.meta.dirname, 'index.html'),
          'cv-print': path.resolve(import.meta.dirname, 'cv-print.html'),
        },
        output: {
          codeSplitting: {
            groups: [
              // Core React ít đổi: chunk riêng để cache qua các lần deploy.
              {
                name: 'react',
                test: /[\\/]node_modules[\\/](react|react-dom|react-router|react-router-dom|scheduler)[\\/]/,
                priority: 3,
              },
              // Thư viện mà trang đầu import tĩnh ($initial) gom vào một chunk thay
              // vì ~60 mảnh nhỏ (25/11: 78 → 21 file JS khởi tạo, -28 KiB gzip vì
              // bớt phần bọc chunk). Không bật entriesAware: rolldown coi mỗi route
              // lazy là một entry và lại băm vụn chunk. Antd của route lazy vẫn
              // để bundler tự tách theo route.
              {
                name: 'vendor',
                test: /[\\/]node_modules[\\/]/,
                tags: ['$initial'],
                priority: 2,
              },
            ],
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
      // CI runs one worker per shard under coverage, 2–3× slower than a laptop.
      // Its per-test timeout equals the hard budget enforced on the JUnit report
      // (scripts/check_test_budgets.mjs); locally the 5s default stays strict.
      testTimeout: isCI ? 10_000 : 5_000,
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
          // Output Paraglide sinh từ messages/*.json (~6 MB, hàng chục nghìn hàm):
          // không phải code viết tay, và remap coverage của nó chiếm hơn nửa thời
          // gian mỗi shard CI.
          'src/shared/config/i18n/paraglide/**',
          // Barrel re-export không có logic
          'src/**/index.js',
        ],
        // 25/11: bỏ output Paraglide khỏi phép đo → số thật 61,0 / 58,5 / 54,9 / 63,5;
        // trần đặt thấp hơn ~1 điểm để chênh lệch nhỏ giữa máy không làm đỏ CI.
        thresholds: {
          statements: 60,
          branches: 57,
          functions: 54,
          lines: 62,
        },
      },
    },
  }
})
