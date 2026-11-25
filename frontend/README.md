# ProCV Frontend

SPA React 19 + Vite 8 + antd 6 + Tailwind 4 + TanStack Query, phục vụ ba cổng:
ứng viên (công khai), nhà tuyển dụng và quản trị. Chuỗi giao diện song ngữ vi/en
qua Paraglide (`messages/`, ADR-0023).

## Chạy local

Cách khuyến nghị là chạy cả hệ thống bằng Docker Compose
([hướng dẫn](../docs/06-deployment/docker-compose.md)). Chạy riêng frontend:

```bash
cp .env.example .env
npm ci
npm run dev
```

| Cổng | Dev (cùng host, `VITE_*_HOST` để trống) | Production (subdomain) |
| --- | --- | --- |
| Ứng viên | `http://localhost:5173/` | `VITE_MAIN_HOST` |
| Nhà tuyển dụng | `http://localhost:5173/tuyendung` (app ở `/tuyendung/app`) | `VITE_EMPLOYER_HOST` |
| Quản trị | `http://localhost:5173/admin/app` | `VITE_ADMIN_HOST` |

Biến môi trường chính: `VITE_API_BASE_URL` (để trống thì dùng proxy cùng origin),
`VITE_RECAPTCHA_SITE_KEY`, `VITE_SENTRY_DSN`. Mọi biến `VITE_*` lộ ra JavaScript
công khai, không đặt secret. Danh sách đủ ở `.env.example` và
[cấu hình env](../docs/05-huong-dan/cau-hinh-env.md).

## Kiểm tra

| Lệnh | Kiểm gì |
| --- | --- |
| `npm run lint` | oxlint + khóa i18n vi/en khớp, số chữ viết cứng không tăng |
| `npm run check:architecture` | dependency-cruiser theo layer, cấu trúc slice, axios chỉ trong `shared/api` |
| `npm run test:related <file>` | Unit test liên quan tới file đang sửa (dùng khi làm việc) |
| `npm run test:coverage` | Toàn bộ unit test + ngưỡng coverage (ratchet trong `vite.config.js`) |
| `npm run build && npm run check:bundle-budget` | Build production, trần gzip JS/CSS khởi tạo |
| `npm run test:e2e:smoke` | Playwright smoke ba khung desktop/tablet/mobile |

E2E chạy trên máy với API giả lập: đặt `PLAYWRIGHT_PORT=5180` và
`VITE_API_BASE_URL=http://localhost:8000/api` để không đụng server Docker. Chuẩn
viết test và ngân sách thời gian: [tiêu chuẩn kiểm thử](../docs/05-huong-dan/tieu-chuan-kiem-thu.md).

## Cấu trúc

```text
src/
├── app/       # provider, router, guard, layout, lazy registry theo cổng
├── pages/     # trang theo cổng: main, employer, admin, common (404)
├── widgets/   # khối UI lớn ghép nhiều domain
├── features/  # hành động của người dùng, theo cổng/module/slice
├── entities/  # domain: API, model, UI tái sử dụng
└── shared/    # hạ tầng và UI không biết domain
```

Quy tắc layer, import và chỗ đặt code: [`ARCHITECTURE.md`](./ARCHITECTURE.md).
Module nghiệp vụ nằm ở slice nào: [bản đồ sở hữu](../docs/08-frontend/ban-do-so-huu.md).
