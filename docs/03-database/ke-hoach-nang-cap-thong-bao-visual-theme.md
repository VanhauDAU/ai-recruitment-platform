# Kế hoạch nâng cấp visual — Thông báo đa cổng

> Trạng thái: **AN-V0–V3 hoàn tất trên nhánh · AN-V4 runbook tuỳ chọn**
>
> Nhánh làm việc: `feat/announcement-visual-theme`
>
> Ngày: **2026-08-06**
>
> Nền tảng: [Hệ thống thông báo chạy đa cổng](ke-hoach-he-thong-thong-bao-chay.md),
> [Runtime strip](../08-frontend/dai-thong-bao-da-cong.md)
>
> ### Quyết định đã chốt
>
> | # | Hạng mục | Quyết định |
> | --- | --- | --- |
> | D1 | Màu | Hybrid: `kind` mặc định + **preset** + **custom hex** |
> | D2 | Ảnh nền | 1 ảnh + **overlay** contrast (light/dark); height strip theo content |
> | D3 | Blend | Ảnh + gradient fallback + overlay |
> | D4 | System banners | Không custom (email verify / DPA…) |
> | D5 | Triển khai | AN-V0 → AN-V1 backend → AN-V2 admin/preview → AN-V3 runtime |
> | D6 | Responsive + preview | **Bắt buộc** ở AN-V2/V3 (mục 4.3 preview, 4.4 responsive); không khóa height 31px |

## 1. Bối cảnh

Hệ thống announcement đa cổng đã ship:

- 4 surface: `candidate`, `employer_marketing`, `employer_workspace`, `admin_workspace`
- Revision immutable, targeting, dismiss, metrics, admin workspace
- Runtime strip sticky dưới header, priority tier, animation

**Giới hạn visual hiện tại**

| Hạng mục | Hiện trạng |
| --- | --- |
| Màu sắc | Map cứng theo `kind` trong `announcement-strip.css` (`--announcement-accent/bg/fg`) |
| Ảnh nền | **Ngoài phạm vi** đặc tả gốc (“Không hỗ trợ … ảnh banner”) |
| Admin | Chọn kind/icon/animation — không chọn màu/ảnh |
| Public DTO | Không có field theme/image |

Nhu cầu mới: admin muốn **chọn màu hiển thị** và **upload ảnh nền** strip (ví dụ **980×31** kiểu banner chạy quảng cáo/campaign).

## 2. Mục tiêu

1. Admin cấu hình **theme màu** (preset và/hoặc màu tùy chỉnh) theo từng revision.
2. Admin upload **ảnh nền** strip (định dạng ngang hẹp, ví dụ ~980×31).
3. Runtime áp dụng theme/ảnh **an toàn**: contrast chữ, fail-safe khi thiếu ảnh, không phá sticky/height.
4. Giữ contract hiện có: plain text message, 1 strip / surface, priority, dismiss, metrics.
5. Additive migration; revision đã publish vẫn immutable (sửa = revision mới).

## 3. Ngoài phạm vi (giữ)

- HTML/rich text trong message, video, marquee ngang chữ.
- Notification center / per-user inbox / push.
- Thay URL API namespace `/api/site/announcements/…`.
- Đổi token/storage key dismiss hiện hữu.
- Multi-layer designer (canvas editor kiểu Canva).

**Điều chỉnh so với đặc tả gốc:** cho phép **một ảnh nền decorative** trên revision; message vẫn plain text + icon allowlist.

## 4. Quyết định thiết kế đề xuất

### 4.1. Theme màu

**Khuyến nghị: hybrid preset + override.**

| Field (revision) | Kiểu | Ý nghĩa |
| --- | --- | --- |
| `theme_mode` | enum | `kind` (mặc định = map theo kind như hiện tại) · `preset` · `custom` |
| `theme_preset` | enum optional | `brand`, `emerald`, `amber`, `rose`, `violet`, `slate`, `ocean` |
| `color_accent` | `#RRGGBB` optional | Viền/icon/CTA |
| `color_bg_from` | `#RRGGBB` optional | Gradient start |
| `color_bg_to` | `#RRGGBB` optional | Gradient end |
| `color_fg` | `#RRGGBB` optional | Chữ chính |

**Luật resolve runtime**

```text
if theme_mode == kind (default):
  dùng CSS class --kind như hiện tại
elif theme_mode == preset:
  dùng token preset code-owned
elif theme_mode == custom:
  dùng 4 màu custom (validate hex); thiếu field → fallback brand/kind
```

- System announcements (email verify, DPA…) **không** nhận custom từ admin; giữ palette theo kind/system.
- Không nhận arbitrary CSS / `linear-gradient(...)` string từ client.

### 4.2. Ảnh nền

| Field (revision) | Kiểu | Ý nghĩa |
| --- | --- | --- |
| `background_image` | storage key blank | Ảnh nền strip |
| `background_fit` | enum | `cover` (default) · `repeat-x` · `contain` |
| `background_position` | enum | `center` (default) · `top` · `bottom` |
| `background_overlay` | enum | `none` · `light` · `dark` (lớp phủ tăng contrast chữ) |

**Upload**

- Endpoint admin: `POST /api/site/admin/announcements/backgrounds/`
- Storage prefix: `site/announcements/backgrounds/`
- Format: JPEG / PNG / WebP
- Dung lượng: ≤ **1 MB** (strip nhỏ, không cần file nặng)
- Kích thước pixel:
  - **Khuyến nghị:** 980×31 → 1920×48 (tỷ lệ ~30:1 đến 40:1)
  - **Min:** width ≥ 640, height ≥ 24
  - **Max:** width ≤ 2400, height ≤ **120** (chặn ảnh dọc/to che layout)
- Validate bằng Pillow (đã có `save_image_upload` pattern)
- API trả `{ path, url, width, height }`
- Public feed resolve `background_image_url` từ storage key (giống blog thumb)

**Render CSS (đề xuất)**

```css
.announcement-strip--has-bg {
  background-image:
    var(--announcement-overlay, none),
    var(--announcement-bg-image),
    linear-gradient(...fallback colors...);
  background-size: cover, cover, auto;
  background-position: center;
  background-repeat: no-repeat;
}
```

- Ảnh là **decorative** (`aria-hidden` layer), không thay message.
- Overlay do admin chọn: `none` / `light` / `dark` — **không** tự đổi `none` thành `dark` khi lưu.
- **Mobile:** vẫn cover full width; height strip do content (min ~42px) — ảnh 31px sẽ stretch cover, chấp nhận crop nhẹ. Không force height = 31px (tránh vỡ CTA/2 dòng mobile).

### 4.3. Preview admin (bắt buộc AN-V2)

Preview **không** là mock tĩnh tách biệt khỏi runtime. Mục tiêu: biên tập viên
thấy gần đúng dải thật trên mọi cổng trước khi publish.

| Yêu cầu | Chi tiết |
| --- | --- |
| Nguồn style | Tái dùng class/CSS variable từ `widgets/announcement-strip` (hoặc shared presentation map kind/preset → tokens). **Không** copy hex hai nơi. |
| Live update | Đổi mode/preset/hex/overlay/fit/ảnh → preview cập nhật ngay (debounce ≤ 100 ms). |
| Nội dung | Render message/badge/icon/CTA của revision đang sửa (locale vi/en switch nếu form đã có). |
| Viewport giả lập | Í chọn **Desktop / Tablet / Mobile** (hoặc resize preview frame): mobile preview **line-clamp 2**, CTA wrap, touch target ≥ 44px cho dismiss/prev-next mock. |
| Ảnh nền | Hiển thị `cover`/`repeat-x`/`contain` đúng `background_fit`; overlay light/dark; nếu URL ảnh lỗi → fallback gradient + toast “Ảnh xem trước lỗi”. |
| Surface hint | Label surface đang target (candidate / employer / admin) — strip cùng CSS, khác sticky context. |
| Contrast gợi ý | Custom hex: cảnh báo soft nếu fg/bg tương phản thấp (optional heuristic, không chặn lưu). |
| Reduced motion | Preview tôn trọng `prefers-reduced-motion` (tắt sheen / static). |
| Placement | Sticky hoặc panel cạnh form; không che nút Lưu/Publish trên mobile admin (stack dọc). |

Ownership: `features/manage-announcement` compose preview; presentation tokens
có thể extract nhẹ vào `entities/announcement` nếu strip và preview cùng map.

### 4.4. Responsive runtime (bắt buộc AN-V3)

Giữ contract AN-P2 và **không** phá layout header:

| Viewport | Hành vi |
| --- | --- |
| Desktop (≥1024) | Một dòng message ellipsis; strip full width; ảnh `cover` ngang. |
| Tablet | Giống desktop hoặc 2 dòng nếu CTA dài; không tràn ngang. |
| Mobile (≤767) | **Tối đa 2 dòng** message; CTA không làm document scroll-x; dismiss/prev-next **≥ 44×44**; height **theo content** (min ~42px), **cấm** `height: 31px` dù asset 980×31. |
| Ảnh hẹp (31px) | `background-size: cover` (hoặc `100% 100%` chỉ khi fit=`cover` và height strip > asset — chấp nhận crop); message/icon/CTA vẫn readable nhờ overlay. |
| Sticky | Strip sticky dưới header; `ResizeObserver` → `--announcement-strip-height` cho workspace; không hard-code trừ `100dvh`. |
| Safe area | Tôn trọng `env(safe-area-inset-*)` nếu layout đã dùng. |
| Ảnh lỗi / chậm | Gradient + màu theme; không layout shift lớn khi ảnh load (min-height ổn định). |
| System items | Palette kind/system; **không** áp custom theme/ảnh admin. |

Kiểm thử bắt buộc AN-V3: Vitest strip + E2E/smoke **desktop + tablet + mobile**
(ít nhất candidate surface) với item có ảnh nền + item chỉ màu.

### 4.5. Public DTO (additive)

```json
{
  "theme": {
    "mode": "custom",
    "preset": null,
    "accent": "#0f766e",
    "bg_from": "#ecfdf5",
    "bg_to": "#f0fdfa",
    "fg": "#134e4a"
  },
  "background": {
    "image_url": "https://…/site/announcements/backgrounds/….webp",
    "fit": "cover",
    "position": "center",
    "overlay": "dark"
  }
}
```

- Client normalize: hex invalid → null; image URL non-https/internal fail → bỏ ảnh, giữ màu.
- Không phá field cũ.

## 5. Kiến trúc & ownership

```text
backend apps.sitecontent
  models/announcements.py          # field revision
  services/announcements.py        # write + validate theme
  services/announcement_media.py   # upload background
  api/serializers + views
  migrations additive

frontend
  entities/announcement            # contract normalize theme/background
  features/manage-announcement     # form fields color + upload
  widgets/admin-announcement-management
  widgets/announcement-strip       # apply CSS vars + bg image
```

Cross-layer:

- ADR-0010: media helper qua `common.media_storage`.
- FSD: widget strip không gọi upload; admin feature/entity lo media.

## 6. Bảo mật & a11y

- Chỉ staff có `announcement.manage` upload.
- Không SVG upload (XSS risk); chỉ raster.
- Filename user không dùng làm path.
- Contrast: khi custom màu, admin preview cảnh báo nếu ratio chữ/nền thấp (optional P1); runtime luôn có overlay option.
- `prefers-reduced-motion`: không animate sheen khi reduced; ảnh nền tĩnh OK.
- Critical kind: vẫn cho custom màu/ảnh nhưng tier/priority không đổi.

## 7. Lộ trình triển khai

| Phase | Kết quả | Điều kiện qua | Trạng thái |
| --- | --- | --- | --- |
| **AN-V0** | Đặc tả + chốt quyết định (màu hybrid, ảnh+overlay, responsive/preview) | Review chủ dự án | ✅ 2026-08-06 |
| **AN-V1** | Migration + validate + public/admin DTO + tests | pytest announcement | ✅ 2026-08-06 |
| **AN-V2** | Upload backgrounds + form admin màu/ảnh + **live preview responsive** | Vitest form/preview; admin mobile stack | ✅ 2026-08-06 |
| **AN-V3** | Strip runtime theme/bg + normalize FE + **responsive 3 viewport** | Strip tests + smoke desktop/tablet/mobile | ✅ 2026-08-06 |
| **AN-V4** | Runbook, seed ví dụ, đồng bộ doc/runtime guide | Readiness checklist | ⬜ |

Mỗi phase PR nhỏ; AN-V2 **không** ship runtime strip chưa preview ổn.

### 7.1. AN-V1 — đã xong

1. Migration `0017_announcement_revision_visual_theme`.
2. `normalize_theme_and_background` trong `services/announcements.py`.
3. Public `theme`/`background`; admin revision fields + read DTO.
4. Tests: `test_announcement_visual_theme.py` + regression announcement.

### 7.2. AN-V2 — admin + preview (tiếp theo)

1. `POST /api/site/admin/announcements/backgrounds/` (Pillow, ≤1MB, max height 120).
2. Form: theme mode, preset select, ColorPicker custom, upload/xóa ảnh, fit/overlay.
3. **Live preview** theo mục 4.3 (desktop/tablet/mobile frames).
4. Vitest: map theme → CSS vars; preview cập nhật khi đổi màu/ảnh.
5. Không auto-publish; chỉ draft revision.

### 7.3. AN-V3 — runtime strip

1. `entities/announcement` normalize `theme`/`background`.
2. `AnnouncementStrip` CSS vars + bg layers; tắt sheen khi has-bg.
3. Responsive mục 4.4; system items bỏ qua custom.
4. Image `onError` → bỏ layer ảnh.
5. Smoke 3 viewport candidate (+ optional employer marketing).

## 8. Rủi ro

| Rủi ro | Giảm thiểu |
| --- | --- |
| Ảnh 980×31 quá thấp, chữ 2 dòng mobile vỡ | Strip height theo content, không lock 31px |
| Chữ khó đọc trên ảnh | Overlay dark/light bắt buộc khi có ảnh (default dark) |
| File lớn / abuse | 1MB + max height 120px |
| Breaking public clients | Field additive, default theme_mode=kind |
| Sheen CSS xấu trên ảnh | Tắt sheen khi has-bg |

## 9. Quyết định product (đã chốt)

| Câu hỏi | Trả lời |
| --- | --- |
| Theme | Hybrid preset + custom hex |
| Ảnh | 1 ảnh + overlay; chưa tách mobile asset (sau nếu cần) |
| Blend | Ảnh + gradient fallback + overlay |
| System banners | Không custom |
| Chỉ ảnh, ẩn icon | **Chưa** — giữ icon/badge/message structure |

## 10. Definition of Done

### AN-V0 / AN-V1

- [x] Kế hoạch + chốt D1–D6
- [x] Cập nhật `ke-hoach-he-thong-thong-bao-chay.md` ngoài phạm vi
- [x] Migration 0017 + service validate + DTO + tests
- [x] TIEN-DO / CHANGELOG / docs index

### AN-V2

- [x] Upload API `POST /api/site/admin/announcements/backgrounds/`
- [x] Admin form màu + ảnh (`AnnouncementVisualFields`)
- [x] Live preview desktop/tablet/mobile + theme tokens
- [x] Vitest theme token resolve

### AN-V3

- [x] Strip runtime theme/bg (`buildAnnouncementStripVisual`)
- [x] FE contract normalize theme/background
- [x] Unit tests contract + strip visual; mobile touch 44px
- [ ] Smoke E2E 3 viewport (tuỳ staging)

## 11. Tham chiếu code

- Model: `backend/apps/sitecontent/models/announcements.py`
- Migration: `0017_announcement_revision_visual_theme.py`
- Service: `backend/apps/sitecontent/services/announcements.py` (`normalize_theme_and_background`)
- Serializers: `api/serializers/announcements.py`
- Tests: `tests/test_announcement_visual_theme.py`
- CSS kind (runtime hiện tại): `widgets/announcement-strip/ui/announcement-strip.css`
- Contract FE: `entities/announcement/model/announcement.contract.js`
- Admin: `features/manage-announcement`
- Media: `common.media_storage.save_image_upload`
