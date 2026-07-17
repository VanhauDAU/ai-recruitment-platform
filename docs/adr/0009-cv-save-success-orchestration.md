# ADR 0009 — Luồng sau khi lưu CV dựa trên immutable version

- **Trạng thái:** Accepted
- **Ngày:** 2026-07-17

## Bối cảnh

Trang lưu CV thành công từng render lại draft bằng HTML, lấy danh sách việc làm
công khai rồi gắn nhãn phù hợp và cập nhật consent bằng PUT toàn bộ job
preferences. Nút tải CV chưa nối với export pipeline. Các cách này làm preview
có thể khác PDF, recommendation không giải thích được và một switch quyền riêng
tư có thể bị lỗi do contract preference bắt buộc.

## Quyết định

Nút **Lưu CV** luôn autosave rồi tạo một `CvVersion(manual_save)` bất biến. Mọi
artifact sau lưu đều lấy version này làm nguồn:

```text
CvDraft --save-version--> CvVersion
                            ├── private WebP thumbnail
                            ├── owner-only PDF export
                            └── explainable CV-to-job ranking
```

- Thumbnail được worker render từ canonical PDF pipeline, lưu dưới private
  storage key và chỉ đọc qua owner endpoint. `UserCv.thumbnail_url` tiếp tục là
  storage projection hiện hành; API không trả storage key.
- Đường hiển thị chính của trang lưu thành công không chờ thumbnail. Frontend
  chuyển nguyên response immutable `save-version` qua navigation state, dùng
  cùng `CvDocumentPreview` với editor làm nguồn capture rồi chuyển trang đầu
  thành Blob URL cho thẻ `<img>`. Khi direct reload, frontend đọc metadata
  rồi lấy đích danh `latest_version_public_id`; không dùng owner-view vì endpoint
  đó có thể ưu tiên published version cũ. Thumbnail tiếp tục được tạo nền cho
  thư viện CV và các consumer cần bitmap.
- HTML của canonical PDF chỉ dùng các primitive đã được WeasyPrint hỗ trợ ổn
  định. Bố cục nhiều cột dùng float/chiều rộng tường minh, không dùng CSS Grid
  hoặc kích thước font bằng `calc()`. Storage key của thumbnail chứa renderer
  revision để thay đổi renderer không tái sử dụng nhầm artifact cũ.
- `GET /api/jobs/recommendations/by-cv/{cv_public_id}/` thuộc jobs domain. Rule
  `profile-rule-v2` dựa trên vị trí, kỹ năng, địa điểm, kinh nghiệm và lương.
  Vị trí/headline của CV vừa lưu luôn ưu tiên hơn danh sách sở thích cấp tài
  khoản; sở thích chuyên môn chỉ là fallback khi CV không có tín hiệu vị trí.
  Job dưới 20 điểm bị loại thay vì dùng để lấp đủ danh sách. Category chỉ được
  tính khi tiêu đề job có tín hiệu ngữ nghĩa tương ứng; tier trả phí chỉ là
  tie-breaker, không tạo điểm phù hợp. Response trả thêm `match_details`
  (`code`, `label`, `points`) bên cạnh `match_score`, `match_reasons`,
  `is_high_match`, `focus_keyword` và related positions. Không giả danh rule
  này là AI model.
- Recruiter visibility có purpose-specific endpoint và immutable audit event.
  Bật quyền bắt buộc confirmation; tắt quyền không cần modal. Consent này không
  thay đổi `UserCv.visibility`, vốn là access policy của share/application.
- Frontend page chỉ lấy route params. Widget compose preview, recommendation và
  hai feature `export-cv-pdf`, `update-recruiter-visibility` theo FSD.

## Hệ quả

- Preview tức thời và dữ liệu recommendation cùng tham chiếu phiên bản đã lưu;
  PDF/thumbnail vẫn là immutable artifact của version đó nhưng không chặn UI.
- Job card chỉ hiện “Rất phù hợp” khi backend trả `is_high_match=true`.
- Thumbnail cũ được thay nguyên tử khi version mới nhất render xong; task stale
  không được cập nhật CV. Frontend dừng trạng thái chờ sau 30 giây, báo lỗi có
  thể thử lại; worker/backfill vẫn dùng cùng task idempotent.
- Regression test phải trích xuất text từ PDF thật và xác nhận nội dung section,
  không chỉ kiểm tra chuỗi HTML, nhằm phát hiện renderer âm thầm bỏ cột/nội dung.
- Thuật toán recommendation có thể được thay bởi model khác sau này nhưng phải
  giữ response giải thích được và tôn trọng owner scope.
