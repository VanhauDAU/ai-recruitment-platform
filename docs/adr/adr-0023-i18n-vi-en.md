# ADR-0023: Song ngữ vi/en cho cả ba cổng

**Trạng thái:** Đã chấp nhận
**Ngày:** 19/11/2026
**Owner:** Frontend + Backend

## Bối cảnh

Một số nhà tuyển dụng là người nước ngoài, nhưng hệ thống gần như chỉ có tiếng
Việt:

- **Frontend:** khoảng 8.800 dòng có chữ tiếng Việt viết cứng trong khoảng 780
  tệp. Riêng 4 trang marketing NTD dùng i18next; module đó cấm import ở các cổng
  khác để không kéo khoảng 15 KB gzip runtime vào bundle khởi tạo.
- **Backend:** không có gettext, `LocaleMiddleware` hay tùy chọn ngôn ngữ của
  tài khoản. Thông báo do dự án viết là tiếng Việt, còn thông báo có sẵn của
  DRF/Django ra tiếng Anh vì `LANGUAGE_CODE='en-us'`.

Ràng buộc: bundle JS khởi tạo còn khoảng 6 KiB trước trần 328,5 KiB. Không đổi
URL, payload API hay khóa token. Khoảng 2.700 truy vấn test theo chữ tiếng Việt
phải tiếp tục chạy.

## Quyết định

### 1. Frontend dùng Paraglide JS (inlang), bỏ i18next

- Chuỗi nằm ở `frontend/messages/<vùng>/{vi,en}.json` (common, employer, sau
  này main, admin). `project.inlang/settings.json` liệt kê các vùng trong
  `pathPattern`. Plugin định dạng được nạp từ `node_modules`, nên lúc build
  không phải tải gì từ CDN.
- Plugin Vite biên dịch thành `src/shared/config/i18n/paraglide/`. Thư mục này
  không commit; `vite`, `vite build` và vitest đều tự sinh lại.
- Mỗi chuỗi là một hàm ES (`m.marketing_nav_home()`). Bundler bỏ những chuỗi
  không dùng, nên chuỗi của trang nào chỉ nằm trong chunk của trang đó.
  - Runtime cộng thêm khoảng 1,4 KiB vào bundle khởi tạo (đo 19/11: 322,4 →
    323,8 KiB). i18next sẽ tốn khoảng 15 KiB.
  - Dự án là JS, không có TypeScript, nên gõ sai tên khóa không làm build lỗi:
    `m.khoa_sai()` văng `TypeError` lúc render. `check:i18n` bắt lỗi này từ
    bước lint (mục 4).
- Khóa phẳng dạng snake_case, có tiền tố theo vùng sở hữu (`marketing_…`,
  `common_…`). Danh sách và nhãn động là mảng hoặc map các hàm message, không
  ghép khóa bằng template string.
- Chỉ `@/shared/config/i18n` được import mã sinh (oxlint
  `no-restricted-imports`). Module này:
  - đọc ngôn ngữ một lần lúc khởi động (`overwriteGetLocale`), vì runtime mặc
    định đọc localStorage ở mỗi lần gọi `m.key()`;
  - chuyển khóa cũ `employer_marketing_lang` sang khóa mới;
  - xuất `m`, `getLocale`, `getIntlLocale`, `getOgLocale` và `changeLocale`.

### 2. Chọn ngôn ngữ

| Nguồn | Thứ tự ưu tiên | Ghi chú |
|---|---|---|
| `preferred_language` của tài khoản | 1 | `SessionProvider` áp dụng khi khôi phục phiên. Đăng nhập ở máy mới vẫn đúng ngôn ngữ. |
| localStorage `procv_lang` | 2 | Lựa chọn trên thiết bị, cho khách chưa đăng nhập. |
| `vi` | 3 | Mặc định. |

- **Không đọc `navigator.language`:** người Việt dùng trình duyệt tiếng Anh vẫn
  phải mặc định tiếng Việt. Playwright cũng chạy với `en-US`.
- **Không có tiền tố `/en/` trong URL:** route giữ hợp đồng hiện có. SEO shell
  ở backend vẫn tiếng Việt.
- **Đổi ngôn ngữ là tải lại trang.** antd (`ConfigProvider locale`), dayjs
  (`@/shared/lib/dayjs`), `Intl`, cache react-query và dữ liệu API cùng làm
  mới; không cần provider hay cơ chế render lại.
  - Nếu không ghi được localStorage, `changeLocale` không tải lại. Như vậy tránh
    được vòng lặp tải lại khi đồng bộ ngôn ngữ theo tài khoản.
- **Bộ chọn ngôn ngữ** (`features/common/preferences/switch-language`): khi đã
  đăng nhập thì PATCH `/api/auth/me/` trước rồi mới đổi. Lưu thất bại thì báo
  lỗi và giữ nguyên ngôn ngữ.
- **Không mất dữ liệu khi tải lại:** form đang soạn báo trạng thái "chưa lưu"
  qua `useUnsavedChanges(dirty)` (`@/shared/hooks/use-unsaved-changes`, sổ đăng
  ký ở `@/shared/lib/unsaved-changes`). Sổ này bật cảnh báo `beforeunload` của
  trình duyệt. Bộ chọn ngôn ngữ hỏi bằng hộp thoại trong app trước khi tải lại,
  rồi bỏ qua cảnh báo trình duyệt để không hỏi hai lần. Trình soạn có dữ liệu
  chưa lưu phải đăng ký vào sổ này.
- **Tài khoản mới** lấy ngôn ngữ của request đăng ký (`UserManager.create_user`).
  Vì vậy NTD chọn English rồi đăng ký sẽ không bị trả về tiếng Việt.
- Lựa chọn ngôn ngữ là lưu trữ "cần thiết" (người dùng chủ động yêu cầu), không
  phụ thuộc đồng ý nhóm preferences như chế độ màu.

### 3. Backend

- `LANGUAGE_CODE='vi'`, `LANGUAGES` gồm vi/en, và
  `django.middleware.locale.LocaleMiddleware` sau `SessionMiddleware`.
  Frontend gửi `Accept-Language` trong mọi request của axios.
- Chuỗi do dự án viết dùng msgid tiếng Việt, bọc trong `gettext`/`gettext_lazy`
  (`ngettext` khi có số đếm; tham số dạng `%(name)s`, không f-string).
  - Mỗi app có catalog riêng `apps/<app>/locale/en/LC_MESSAGES/django.po`.
  - `backend/locale/vi` chỉ bổ sung các thông báo DRF mà gói DRF chưa dịch.
- Docker và CI không có GNU gettext, nên dự án dùng `common/i18n_catalog.py`
  (Python thuần) thay `makemessages`/`compilemessages`:
  - `python -m common.i18n_catalog update apps/<app>` trích msgid từ code (nhận
    cả alias import) và template (`{% translate %}`, `{% blocktranslate trimmed %}`),
    cập nhật `.po` (giữ bản dịch cũ) rồi biên dịch `.mo`. `.mo` được commit.
  - `common/tests/test_locale_catalogs.py` chạy `check` cho mọi app: msgid trong
    code chưa có bản dịch tiếng Anh hoặc `.mo` cũ đều làm test lỗi.
- Email, Celery và thông báo trong ứng dụng render trong
  `common.i18n.recipient_language(user)`, theo ngôn ngữ của NGƯỜI NHẬN chứ không
  theo người thao tác. Thông báo đã lưu trong DB giữ nguyên.
- Dữ liệu lưu DB hoặc dùng để so sánh không phụ thuộc ngôn ngữ request. Ví dụ:
  snapshot nội dung tin (dùng để băm khi duyệt lại) luôn ghi bằng `LANGUAGE_CODE`.
- Prompt AI (sinh tin, nội dung chiến dịch) viết đầu ra theo ngôn ngữ của
  request; cấu trúc đầu ra không đổi.
- Danh mục cố định (tỉnh/thành, kỹ năng, ngành nghề, phúc lợi) thêm `name_en`
  và trả tên theo ngôn ngữ của request. Nội dung do người dùng viết (tin, trang
  công ty, CV, blog) không dịch.

### 4. Cổng kiểm tra

`npm run lint` gọi `scripts/check-i18n.mjs`, kiểm ba việc:

- Khóa và tham số `{name}` của `vi.json` và `en.json` phải khớp.
- Mọi `m.<khóa>` trong `src/` (kể cả test) phải có trong `messages/`. Truy cập
  động `m[...]` bị cấm; danh sách và nhãn động dùng map hàm message.
- Ratchet số dòng tiếng Việt viết cứng theo từng vùng (`scripts/i18n-baseline.json`).
  - Thêm chuỗi viết cứng mới là lỗi.
  - Di trú xong một vùng thì chạy `npm run check:i18n -- --update` để hạ trần.
  - Lệnh này không bao giờ nâng trần.

### 5. Lộ trình di trú

Mỗi giai đoạn là một PR. Bộ chọn ngôn ngữ chỉ hiện ở vùng đã dịch xong, để
người dùng không chọn English rồi vẫn thấy tiếng Việt.

| GĐ | Phạm vi |
|---|---|
| 0 | Nền tảng; 4 trang marketing NTD (#262) |
| 1 | Cổng NTD: frontend (cả entities/shared nó dùng, form đăng nhập dùng chung), app `accounts`/`employers`/`jobs`/`campaigns`/`applications`, email, thông báo, prompt AI |
| 2 | Danh mục `name_en`; entities/shared còn lại |
| 3 | Cổng ứng viên |
| 4 | Cổng quản trị; ratchet về 0 |

## Hệ quả

- **Bundle:** bundle khởi tạo tăng khoảng 3,9 KiB, chủ yếu vì `antd/locale/vi_VN`
  (khoảng 2,2 KiB). Trước đây chỉ cổng quản trị nạp gói này, nên cổng ứng viên và
  NTD đang hiện chữ mặc định tiếng Anh của antd. Chuỗi của các vùng sau nằm
  trong chunk lười của trang tương ứng.
- **dayjs:** phải import từ `@/shared/lib/dayjs`; import trực tiếp `dayjs` bị
  oxlint chặn.
- **Môi trường phát triển:** mã sinh của Paraglide chỉ có sau khi chạy `vite`,
  `vite build` hoặc vitest. Editor báo thiếu module cho tới lần chạy đầu.
- **Nâng cấp:** Paraglide 3.x vừa phát hành (11/2026). Dự án ghim 2.29.3 và
  nâng cấp sau khi bản 3 ổn định.
