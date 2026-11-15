# 01 - Phân tích

Phạm vi:
- Bối cảnh và vấn đề cần giải quyết (ứng viên, nhà tuyển dụng)
- Mục tiêu, phạm vi MVP, đối tượng sử dụng
- Vai trò người dùng và quyền hạn
- Danh sách chức năng chi tiết (F01-F20)

Nguồn: PRD_AI_Career_Coach v1.1.

## Sơ đồ use case tổng quát (chốt 2026-11-15)

![Sơ đồ use case tổng quát](so-do-use-case.png)

Bản chỉnh sửa được: [`so-do-use-case.drawio`](so-do-use-case.drawio) (mở bằng
diagrams.net), bản vector: [`so-do-use-case.svg`](so-do-use-case.svg). Ô nền
xanh viền đậm là chức năng AI chạy local do hệ thống tự xây dựng.

### Tác nhân

| Tác nhân | Mô tả |
| --- | --- |
| Khách | Người chưa đăng nhập |
| Người dùng | Tác nhân trừu tượng, cha của Ứng viên, Nhà tuyển dụng, Quản trị viên |
| Ứng viên | Tài khoản cổng ứng viên |
| Nhà tuyển dụng | Tài khoản cổng nhà tuyển dụng |
| Quản trị viên | Admin thường và superuser (ADR-0018) |

### Danh sách use case

✅ đã có trong code, ⬜ sẽ làm.

| Tác nhân | Use case | Trạng thái |
| --- | --- | --- |
| Khách | Đăng ký tài khoản («include» Xác minh email) | ✅ |
| Khách, Ứng viên | Tìm kiếm việc làm và xem chi tiết tin tuyển dụng | ✅ |
| Khách, Ứng viên | So sánh việc làm | ✅ |
| Khách, Ứng viên | Xem công ty, bài viết và mẫu CV | ✅ |
| Khách, Ứng viên | Tra cứu trung tâm trợ giúp | ✅ |
| Ứng viên | Quản lý hồ sơ cá nhân và nguyện vọng việc làm (gồm cho phép NTD tìm thấy hồ sơ) | ✅ |
| Ứng viên | Xem việc làm gợi ý («include» Đối sánh ngữ nghĩa CV–JD) | ✅ theo luật, ⬜ chuyển sang đối sánh ngữ nghĩa |
| Ứng viên | Phân tích mức độ phù hợp CV–JD («include» Đối sánh ngữ nghĩa CV–JD) | ⬜ |
| Ứng viên | Quản lý CV; Nhập CV từ tệp PDF/DOCX («extend») | ✅ |
| Ứng viên | Chia sẻ và tải CV | ✅ |
| Ứng viên | Ứng tuyển việc làm; Theo dõi hồ sơ ứng tuyển; Lưu việc làm | ✅ |
| Ứng viên | Đăng ký nhận thông báo việc làm | ✅ |
| Ứng viên | Theo dõi công ty; Báo cáo tin tuyển dụng và thông tin công ty | ✅ |
| Nhà tuyển dụng | Quản lý thông tin và xác thực doanh nghiệp; Quản lý trang công ty | ✅ |
| Nhà tuyển dụng | Quản lý chiến dịch tuyển dụng; Quản lý tin tuyển dụng; Xem thống kê tuyển dụng | ✅ |
| Nhà tuyển dụng | Tìm kiếm hồ sơ ứng viên («include» Đối sánh ngữ nghĩa CV–JD) | ⬜ |
| Nhà tuyển dụng | Quản lý hồ sơ ứng tuyển | ✅ |
| Nhà tuyển dụng | Sàng lọc và xếp hạng hồ sơ ứng tuyển bằng AI («extend» Quản lý hồ sơ ứng tuyển, «include» Đối sánh ngữ nghĩa CV–JD) | ⬜ |
| Quản trị viên | Quản lý tài khoản; Duyệt xác thực và cập nhật doanh nghiệp; Xử lý báo cáo tin tuyển dụng và công ty | ✅ |
| Quản trị viên | Quản lý mẫu CV; Quản lý bài viết; Quản lý trung tâm trợ giúp; Quản lý thông báo và cấu hình; Xem thống kê hệ thống | ✅ |
| Người dùng | Đăng nhập; Đăng xuất; Khôi phục mật khẩu | ✅ |
| (dùng chung) | Đối sánh ngữ nghĩa CV–JD | ⬜ |

### Phạm vi AI đã chốt

Mở rộng ngày 2026-11-15: thêm fine-tune mô hình, baseline cho thực nghiệm, kỹ
năng khớp/thiếu và gợi ý cải thiện CV. Tên các use case không đổi nên sơ đồ giữ
nguyên. Lộ trình ở [tiến độ dự án](../TIEN-DO-DU-AN.md#đối-sánh-ngữ-nghĩa-cvjd-chạy-local-2026-11-15).

- Đối sánh ngữ nghĩa CV–JD chạy và huấn luyện local: bi-encoder đa ngôn ngữ mã
  nguồn mở (`intfloat/multilingual-e5-base`) fine-tune trên máy, pipeline tự xây
  (trích kỹ năng, chấm điểm nhiều tiêu chí, vector lưu bằng pgvector), không gọi
  API ngoài. TF-IDF và BM25 chỉ làm baseline trong thực nghiệm.
- Ứng viên: Phân tích mức độ phù hợp CV–JD trả điểm tổng và điểm theo tiêu chí
  (kỹ năng, kinh nghiệm, học vấn, cấp bậc, địa điểm), kỹ năng khớp và kỹ năng
  còn thiếu, giải thích kèm bằng chứng trong CV, và gợi ý cải thiện CV sinh bằng
  luật (không dùng LLM). Xử lý được tin tiếng Việt và tiếng Anh. Việc làm gợi ý
  dùng chung module này.
- Nhà tuyển dụng: Sàng lọc và xếp hạng hồ sơ ứng tuyển theo điểm. Tìm kiếm hồ sơ
  ứng viên chọn một tin của NTD rồi xếp ứng viên theo độ phù hợp, chỉ gồm ứng
  viên đã cho phép NTD tìm thấy hồ sơ.
- Nhập CV từ tệp, AI tạo tin tuyển dụng (thuộc Quản lý tin tuyển dụng) và AI
  sinh nội dung CV mẫu vẫn gọi dịch vụ AI bên ngoài; sơ đồ vẽ như use case
  thường.

### Thay đổi so với sơ đồ trước

- Bỏ "phân quyền" khỏi Quản lý tài khoản (ADR-0018).
- "Trích xuất thông tin CV bằng AI" đổi thành "Nhập CV từ tệp PDF/DOCX".
- Bỏ liên kết trực tiếp Nhà tuyển dụng – Sàng lọc, vì use case này chỉ chạy qua
  «extend» của Quản lý hồ sơ ứng tuyển.
- Thêm: So sánh việc làm, Tra cứu trung tâm trợ giúp, Chia sẻ và tải CV, Đăng
  ký nhận thông báo việc làm, Theo dõi công ty, Quản lý trang công ty, Quản lý
  trung tâm trợ giúp; báo cáo và xử lý báo cáo mở rộng sang công ty; duyệt xác
  thực gồm cả yêu cầu cập nhật doanh nghiệp.
