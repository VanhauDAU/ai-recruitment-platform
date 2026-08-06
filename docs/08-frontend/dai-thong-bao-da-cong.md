# Dải thông báo đa cổng — Runtime frontend

Trạng thái: **AN-P2 đã triển khai trên nhánh tính năng, chờ merge vào `dev`**.

Tài liệu này mô tả phần runtime của hệ thống thông báo. Contract sản phẩm,
schema, lifecycle và API canonical nằm tại
[`ke-hoach-he-thong-thong-bao-chay.md`](../03-database/ke-hoach-he-thong-thong-bao-chay.md).

## 1. Ownership và chiều phụ thuộc

```text
app/layouts
  → widgets/announcement-strip
    → entities/announcement
    → entities/session
    → shared/api + shared/config
```

- `entities/announcement` sở hữu endpoint active feed, query key theo phiên,
  normalize DTO, locale fallback phòng thủ và allowlist contract.
- `widgets/announcement-strip` sở hữu system reminder, priority resolver,
  rotation, animation, accessibility, trạng thái dismiss tạm thời và rollout.
- Layout chỉ truyền `surface`, `path`, locale/verification path và dữ liệu hồ sơ
  NTD đã có. Layout không xếp priority hoặc tự hiểu payload remote.
- Mọi import liên-slice đi qua `index.js`; không có feature-to-feature import.

Các module chính:

```text
frontend/src/entities/announcement/
  api/announcement.api.js
  api/announcement.keys.js
  model/announcement.contract.js
  model/announcement.presentation.js

frontend/src/widgets/announcement-strip/
  model/announcement-rollout.js
  model/priority-resolver.js
  model/system-announcements.js
  model/local-dismissal.js
  ui/AnnouncementStrip.jsx
  ui/announcement-strip.css
```

## 2. Luồng dữ liệu

1. Layout truyền một trong bốn surface canonical và pathname không có query/hash.
2. Strip chờ `SessionProvider` hoàn tất probe để không dùng nhầm feed guest qua
   ranh giới phiên.
3. Query key gồm `surface`, `path`, `locale` và audience identity.
4. Remote response được normalize; item thiếu ID/message bị bỏ riêng, URL hoặc
   enum ngoài allowlist dùng fallback an toàn.
5. Widget dựng system item từ session/profile rồi ghép với remote item.
6. Pure resolver chỉ giữ tier cao nhất và sắp cùng tier theo priority/source/ID.
7. Strip tự đo chiều cao bằng `ResizeObserver` và công bố
   `--announcement-strip-height` trên shell cha.

Remote feed lỗi, timeout hoặc payload hỏng không throw qua layout. System label
vẫn render; nếu không có system label thì strip ẩn và header/main giữ nguyên.

## 3. Priority hợp nhất

| Tier | Runtime source |
| ---: | --- |
| 1 | Critical remote |
| 2 | Xác thực email/bảo mật system hoặc remote |
| 3 | DPA/tuân thủ NTD system hoặc remote |
| 4 | Warning/maintenance remote |
| 5 | Nhắc nhu cầu công việc ứng viên |
| 6 | Info/success/event/feature remote |

Email chưa xác thực không bao giờ hiển thị đồng thời với reminder nhu cầu việc
làm. Critical là loại duy nhất được vượt email. Nhiều item cùng tier luân phiên
deterministic; system item đứng trước remote nếu priority bằng nhau.

## 4. Rollout và compatibility

Build-time flag:

```dotenv
VITE_ANNOUNCEMENT_ROLLOUT_SURFACES=admin_workspace,employer_marketing
```

Giá trị hỗ trợ:

- rỗng hoặc `none`: tắt unified strip trên mọi surface;
- danh sách phân tách dấu phẩy: chỉ bật surface được nêu;
- `all`: bật cả bốn surface.

Flag mặc định fail-closed. Khi surface tắt:

- candidate tiếp tục dùng `EmailVerificationBanner` và
  `JobPreferencesReminder`;
- employer marketing tiếp tục dùng `EmailVerificationBanner`;
- employer workspace tiếp tục dùng dải DPA cũ;
- admin không thêm dải mới.

`window.__ANNOUNCEMENT_ROLLOUT_SURFACES__` là bootstrap override dùng cho smoke
test hoặc host injection trước khi bundle chạy; nếu không có, frontend dùng
biến build-time.

AN-P5 dùng `ANNOUNCEMENT_REMOTE_ENABLED_SURFACES` phía backend làm kill switch
runtime theo surface. Active feed trả `remote_enabled`; contract frontend chỉ
normalize remote item khi field đúng `true`. False hoặc field thiếu đều bỏ
remote item nhưng vẫn dựng system label. Component error boundary trả đúng
banner `legacy` nếu runtime render lỗi. Feed/network và render failure gửi enum
PII-free best-effort, không gửi stack/message/path.

Docker local và production đều chuyển tiếp build arg này. Không sửa trực tiếp
`frontend/.env` đã có của người phát triển; dùng `.env` ở môi trường deploy.

## 5. UX và accessibility

- Strip sticky ngay dưới header; employer workspace dùng flex shell thực thay vì
  phép trừ `100dvh` theo chiều cao banner.
- Desktop một dòng ellipsis; mobile line-clamp tối đa hai dòng.
- Animation `slide`, `fade`, `static`; interval 4–15 giây từ backend.
- Rotation dừng khi hover, focus, tab ẩn hoặc reduced-motion.
- Reduced-motion ép item về static nhưng vẫn có nút trước/sau.
- Auto-rotation không phát `aria-live`; nút trước/sau thông báo item mới bằng
  live region `polite`. Critical dùng `alert/assertive`.
- Touch target điều khiển trên mobile là 44 × 44 px.
- Internal CTA dùng React Router. External CTA chỉ HTTPS, không credential, mở
  tab mới với `noopener noreferrer`.
- Nội dung chỉ render text node; icon lấy từ map code-owned, không nhận HTML.

### 5.1. Visual theme & ảnh nền (epic AN-V)

Nguồn: [kế hoạch visual](../03-database/ke-hoach-nang-cap-thong-bao-visual-theme.md).

- Backend AN-V1 đã expose `theme` + `background` trên active feed (additive).
- Runtime strip (AN-V3) sẽ map CSS variables từ DTO; ảnh nền decorative + overlay;
  **height theo content**, không khóa theo pixel asset (vd. 980×31).
- Admin (AN-V2) bắt buộc **live preview** với khung Desktop / Tablet / Mobile,
  tái dùng style strip, cập nhật khi đổi màu/ảnh.
- System reminder (email verify, DPA…) không nhận custom theme/ảnh.
- Responsive smoke: desktop + tablet + mobile trước khi merge AN-V3.

AN-P4 lưu close/snooze của guest trong `localStorage` theo
`public_id:dismissal_version`, đồng thời đọc fallback `sessionStorage` của P2
trong compatibility window. Authenticated remote item gọi state API idempotent;
UI vẫn đóng ngay bằng state cục bộ nếu API lỗi. Reminder nhu cầu công việc
snooze 7 ngày.

## 6. Refetch và failure handling

- Query retry tối đa một lần theo policy ứng dụng.
- Retry feed dùng delay 250 ms; lỗi cuối được báo operational best-effort và
  không làm hỏng header.
- `next_transition_at` đặt timer refetch ngay sau boundary.
- Tab trở lại visible refetch ngay; khi tab visible có fallback 60 giây.
- Impression/click/dismiss remote được gom batch ngắn, loại trùng trong batch và
  chỉ gửi khi ConsentProvider đang `ready` với Analytics bật. Backend signed
  cookie vẫn là nguồn chuẩn. Tracking best-effort, không retry vô hạn và CTA
  không chờ request.
- `ResizeObserver` không có thì chiều cao nội dung tự nhiên vẫn tham gia layout.
- Mọi external URL không an toàn bị bỏ CTA, không bỏ cả thông báo.

## 7. Điểm tích hợp

| Surface | Layout |
| --- | --- |
| candidate | `app/layouts/MainLayout.jsx` |
| employer marketing | `app/layouts/EmployerMarketingLayout.jsx` |
| employer workspace | `app/layouts/EmployerWorkspaceLayout.jsx` |
| admin workspace | `app/layouts/DashboardLayout.jsx` |

CV editor vẫn dùng candidate surface nhưng không dựng banner legacy khi rollout
tắt, giữ đúng hành vi trước AN-P2.

## 8. Kiểm thử và rollback

Unit test khóa:

- normalize payload, enum, URL và locale fallback;
- rollout parser fail-closed;
- toàn bộ thứ tự priority và tie ordering;
- legacy branch không gọi remote API;
- fail-safe email khi remote lỗi;
- critical vượt email;
- guest feed, external CTA và local close.

Playwright smoke chạy bốn surface trên desktop/tablet/mobile, kiểm:

- strip nằm sau header;
- mobile hai dòng/desktop một dòng;
- không horizontal overflow;
- employer shell vẫn đúng `100dvh`;
- CSS custom property chiều cao đã được công bố;
- không có `pageerror`.

Rollback P2: đặt flag rỗng/`none` để quay về banner compatibility. Không reverse
migration hoặc xóa announcement/revision/permission của AN-P1.
