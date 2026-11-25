# Tài liệu dự án — ProCV Platform

Mỗi chủ đề có đúng một tài liệu nguồn, mô tả hệ thống đúng như code hiện tại.
Lịch sử thay đổi nằm trong [`CHANGELOG.md`](../CHANGELOG.md) và git. Trạng thái
từng module và việc còn mở: [`TIEN-DO-DU-AN.md`](TIEN-DO-DU-AN.md).

Quy ước: tên file kebab-case tiếng Việt không dấu; ADR giữ dạng
`adr-NNNN-<slug>.md`. Tài liệu mới phải có dòng trong chỉ mục này
(`scripts/check_markdown_links.py` chặn tài liệu mồ côi). Kế hoạch và audit đã xong
việc chuyển vào [`archive/`](archive/README.md).

## Bắt đầu từ đâu

| Bạn cần | Đọc |
| --- | --- |
| Hiểu hệ thống làm gì và gồm những phần nào | [Tổng quan hệ thống](02-tong-quan/tong-quan-he-thong.md) |
| Chạy dự án trên máy | [Docker Compose](06-deployment/docker-compose.md) hoặc [cài đặt local](05-huong-dan/huong-dan-cai-dat.md) |
| Sửa code | [`AGENTS.md`](../AGENTS.md), [quy ước code](02-tong-quan/quy-uoc-code.md), [`frontend/ARCHITECTURE.md`](../frontend/ARCHITECTURE.md), [quy trình PR](05-huong-dan/quy-trinh-pull-request.md) |
| Biết vì sao hệ thống được thiết kế như vậy | [Danh sách ADR](adr/README.md) |
| Nắm nghiệp vụ một module | Các file đặc tả trong [01-phan-tich](#01-phan-tich--yêu-cầu-và-đặc-tả) |
| Gọi hoặc sửa API | [Tài liệu API](04-api/tai-lieu-api.md) và [`openapi.yaml`](04-api/openapi.yaml) |
| Đưa lên production | [Go-live](06-deployment/go-live.md), [runbook deploy](06-deployment/huong-dan-deployment.md) |
| Bật, tắt hoặc kiểm tra một tính năng đang chạy | [Vận hành và kill switch](06-deployment/van-hanh-va-kill-switch.md) |

## 01-phan-tich — Yêu cầu và đặc tả

| Tài liệu | Nội dung |
| --- | --- |
| [phan-tich-yeu-cau.md](01-phan-tich/phan-tich-yeu-cau.md) | Bài toán, đối tượng người dùng và yêu cầu tổng quan |
| [mo-hinh-hoa-yeu-cau/](01-phan-tich/mo-hinh-hoa-yeu-cau/README.md) | Use case, sơ đồ hoạt động và tuần tự theo nhóm chức năng (mục 3.2 báo cáo) |
| [dac-ta-nha-tuyen-dung.md](01-phan-tich/dac-ta-nha-tuyen-dung.md) | Đăng ký, công ty và recruiter, xác thực, DPA, SMS, upload, readiness của nhà tuyển dụng |
| [dac-ta-chien-dich-va-tin-tuyen-dung.md](01-phan-tich/dac-ta-chien-dich-va-tin-tuyen-dung.md) | Chiến dịch, vòng đời tin, điều kiện đăng, hậu kiểm và pipeline ứng viên |
| [dac-ta-onboarding-ung-vien.md](01-phan-tich/dac-ta-onboarding-ung-vien.md) | Luồng onboarding và hồ sơ nhu cầu việc làm của ứng viên |
| [dac-ta-tim-viec-gan-day.md](01-phan-tich/dac-ta-tim-viec-gan-day.md) | Việc làm gần tôi: tìm việc theo khoảng cách, bản đồ, tọa độ nơi làm việc |
| [dac-ta-procv-connect.md](01-phan-tich/dac-ta-procv-connect.md) | ProCV Connect: lời mời kết nối và nhắn tin NTD ↔ ứng viên |
| [dac-ta-trung-tam-tro-giup.md](01-phan-tich/dac-ta-trung-tam-tro-giup.md) | Trung tâm trợ giúp: bài viết, revision, quyền và API |
| [dac-ta-thong-bao-da-cong.md](01-phan-tich/dac-ta-thong-bao-da-cong.md) | Thông báo đa cổng: surface, targeting, vòng đời, theme và analytics |

## 02-tong-quan — Kiến trúc

| Tài liệu | Nội dung |
| --- | --- |
| [tong-quan-he-thong.md](02-tong-quan/tong-quan-he-thong.md) | Ba cổng, stack, service Compose, bản đồ app và các luồng chính |
| [quy-uoc-code.md](02-tong-quan/quy-uoc-code.md) | Quy ước cấu trúc module và chất lượng code |
| [kien-truc-cv-builder.md](02-tong-quan/kien-truc-cv-builder.md) | Kiến trúc CV Builder: canonical document, template, editor, import và export |
| [cach-ly-upload.md](02-tong-quan/cach-ly-upload.md) | Lõi upload cách ly: vòng đời phiên, quét malware, bằng chứng |

## adr — Quyết định kiến trúc

[Danh sách đầy đủ, trạng thái và quan hệ thay thế](adr/README.md) của ADR-0012 đến
ADR-0033.

## 03-database

| Tài liệu | Nội dung |
| --- | --- |
| [thiet-ke-database.md](03-database/thiet-ke-database.md) | Quy ước, ERD, bảng theo miền, ràng buộc và bất biến |

## 04-api

| Tài liệu | Nội dung |
| --- | --- |
| [tai-lieu-api.md](04-api/tai-lieu-api.md) | Endpoint theo miền, quyền, mã lỗi |
| [openapi.yaml](04-api/openapi.yaml) | Schema OpenAPI sinh từ `manage.py spectacular` (CI chặn lệch) |
| [hop-dong-du-lieu-frontend.md](04-api/hop-dong-du-lieu-frontend.md) | Hình dạng response mà frontend phụ thuộc |
| [hop-dong-api-procv-connect.md](04-api/hop-dong-api-procv-connect.md) | REST và sự kiện WebSocket của ProCV Connect |
| [dong-y-cookie-va-luot-xem-tin.md](04-api/dong-y-cookie-va-luot-xem-tin.md) | Consent cookie và ghi nhận lượt xem, hiển thị việc làm |

## 05-huong-dan

| Tài liệu | Nội dung |
| --- | --- |
| [huong-dan-cai-dat.md](05-huong-dan/huong-dan-cai-dat.md) | Cài đặt và chạy local, seed, kiểm tra runtime, quy tắc migration |
| [cau-hinh-env.md](05-huong-dan/cau-hinh-env.md) | Biến môi trường backend và frontend |
| [cau-hinh-site-settings.md](05-huong-dan/cau-hinh-site-settings.md) | Cấu hình hệ thống: nguyên tắc, cách thêm/gỡ key, danh mục key |
| [dang-nhap-mang-xa-hoi.md](05-huong-dan/dang-nhap-mang-xa-hoi.md) | Cấu hình đăng nhập Google, Facebook, LinkedIn |
| [quan-tri-thong-bao-da-cong.md](05-huong-dan/quan-tri-thong-bao-da-cong.md) | Thao tác quản trị thông báo đa cổng |
| [quy-trinh-pull-request.md](05-huong-dan/quy-trinh-pull-request.md) | Nhánh, commit, PR, CHANGELOG và cổng kiểm tra |
| [tieu-chuan-kiem-thu.md](05-huong-dan/tieu-chuan-kiem-thu.md) | Chuẩn test: tầng đặt test, ngân sách thời gian, chia shard CI, lệnh chạy nhanh |

## 06-deployment

| Tài liệu | Nội dung |
| --- | --- |
| [go-live.md](06-deployment/go-live.md) | Checklist đưa procv.site lên VPS: tài khoản ngoài, ngày 2/12, việc sau go-live |
| [huong-dan-deployment.md](06-deployment/huong-dan-deployment.md) | Runbook triển khai production (VPS + Compose + Cloudflare/R2), tách static, media, route SEO |
| [sao-luu-va-khoi-phuc.md](06-deployment/sao-luu-va-khoi-phuc.md) | Sao lưu DB/file/bí mật, khôi phục toàn phần, diễn tập hằng quý, kịch bản sự cố |
| [van-hanh-va-kill-switch.md](06-deployment/van-hanh-va-kill-switch.md) | Cờ tính năng, giá trị an toàn, lệnh kiểm tra và rollback |
| [docker-compose.md](06-deployment/docker-compose.md) | Chạy toàn bộ dự án local bằng Docker Compose |
| [luu-tru-media-cloudflare-r2.md](06-deployment/luu-tru-media-cloudflare-r2.md) | Chính sách lưu media trên Cloudflare R2 |
| [ranh-gioi-luu-tru-upload.md](06-deployment/ranh-gioi-luu-tru-upload.md) | Ranh giới lưu trữ public, private, quarantine của upload (chưa rollout xong) |
| [trien-khai-bang-chung-dpa.md](06-deployment/trien-khai-bang-chung-dpa.md) | Cấu hình bằng chứng DPA (chưa kích hoạt) |
| [nha-cung-cap-sms.md](06-deployment/nha-cung-cap-sms.md) | Adapter SMS xác thực số điện thoại (chưa có gateway production) |
| [tich-hop-mang-xa-hoi.md](06-deployment/tich-hop-mang-xa-hoi.md) | Cấu hình app Facebook, Instagram, Threads, LinkedIn để tự đăng bài chiến dịch |

## 07-algorithms

| Tài liệu | Nội dung |
| --- | --- |
| [thuat-toan-ai.md](07-algorithms/thuat-toan-ai.md) | Tổng quan AI: import CV, điểm hoàn thiện CV, đối sánh ngữ nghĩa CV–tin, runtime `ai_core` |
| [ai-tao-tin-tuyen-dung.md](07-algorithms/ai-tao-tin-tuyen-dung.md) | AI tạo tin tuyển dụng |
| [goi-y-viec-lam-ung-vien.md](07-algorithms/goi-y-viec-lam-ung-vien.md) | Gợi ý việc làm cho ứng viên |
| [goi-y-tu-viec-da-luu.md](07-algorithms/goi-y-tu-viec-da-luu.md) | Gợi ý từ việc làm đã lưu |
| [huy-hieu-sam-chop.md](07-algorithms/huy-hieu-sam-chop.md) | Huy hiệu Sấm Chớp tính từ mức phản hồi của nhà tuyển dụng |
| [suc-khoe-chien-dich.md](07-algorithms/suc-khoe-chien-dich.md) | Điểm sức khỏe chiến dịch tuyển dụng |
| [chatbot-ung-vien-faq.md](07-algorithms/chatbot-ung-vien-faq.md) | Đặc tả chatbot FAQ cho ứng viên (chưa triển khai) |

## 08-frontend

| Tài liệu | Nội dung |
| --- | --- |
| [cau-truc-frontend.md](08-frontend/cau-truc-frontend.md) | Tóm tắt stack, ba cổng, layer, routing và phiên đăng nhập |
| [quan-ly-tin-cong-quan-tri.md](08-frontend/quan-ly-tin-cong-quan-tri.md) | Module quản lý tin tuyển dụng của quản trị viên |
| [dai-thong-bao-da-cong.md](08-frontend/dai-thong-bao-da-cong.md) | Runtime dải thông báo đa cổng |
| [mascot.md](08-frontend/mascot.md) | Bộ hình mascot ProCV và cách dùng cho empty state, lỗi, loading |

## archive — Lưu trữ

[Kế hoạch đã thực hiện, audit theo thời điểm, biên bản quyết định](archive/README.md).
Không phải nguồn sự thật.
