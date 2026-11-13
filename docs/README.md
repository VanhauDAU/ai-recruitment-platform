# Tài liệu dự án — ProCV Platform

Mỗi chủ đề có một tài liệu chính. Tài liệu mô tả hệ thống đúng như code hiện
tại; lịch sử kế hoạch và bằng chứng triển khai nằm trong git và
[`CHANGELOG.md`](../CHANGELOG.md). Tiến độ: [`TIEN-DO-DU-AN.md`](TIEN-DO-DU-AN.md).

## Bắt đầu từ đâu

| Bạn cần | Đọc |
| --- | --- |
| Hiểu hệ thống làm gì và gồm những phần nào | [Tổng quan hệ thống](02-tong-quan/tong-quan-he-thong.md) |
| Chạy dự án trên máy | [Docker Compose](06-deployment/docker-compose.md) hoặc [cài đặt local](05-huong-dan/huong-dan-cai-dat.md) |
| Sửa code | [`AGENTS.md`](../AGENTS.md), [quy ước code](02-tong-quan/quy-uoc-code.md), [`frontend/ARCHITECTURE.md`](../frontend/ARCHITECTURE.md), [quy trình PR](05-huong-dan/quy-trinh-pull-request.md) |
| Nắm nghiệp vụ một module | Các file đặc tả trong [01-phan-tich](#01-phan-tich--yêu-cầu-và-đặc-tả) |
| Gọi hoặc sửa API | [Tài liệu API](04-api/tai-lieu-api.md) và [`openapi.yaml`](04-api/openapi.yaml) |
| Bật, tắt hoặc kiểm tra một tính năng đang chạy | [Vận hành và kill switch](06-deployment/van-hanh-va-kill-switch.md) |

## 01-phan-tich — Yêu cầu và đặc tả

| Tài liệu | Nội dung |
| --- | --- |
| [phan-tich-yeu-cau.md](01-phan-tich/phan-tich-yeu-cau.md) | Bài toán, đối tượng người dùng và yêu cầu tổng quan |
| [dac-ta-nha-tuyen-dung.md](01-phan-tich/dac-ta-nha-tuyen-dung.md) | Đăng ký, công ty và recruiter, xác thực, DPA, SMS, upload, readiness của nhà tuyển dụng |
| [dac-ta-chien-dich-va-tin-tuyen-dung.md](01-phan-tich/dac-ta-chien-dich-va-tin-tuyen-dung.md) | Chiến dịch, vòng đời tin, điều kiện đăng, hậu kiểm và pipeline ứng viên |
| [dac-ta-onboarding-ung-vien.md](01-phan-tich/dac-ta-onboarding-ung-vien.md) | Luồng onboarding và hồ sơ nhu cầu việc làm của ứng viên |
| [dac-ta-trung-tam-tro-giup.md](01-phan-tich/dac-ta-trung-tam-tro-giup.md) | Trung tâm trợ giúp: bài viết, revision, quyền và API |
| [dac-ta-thong-bao-da-cong.md](01-phan-tich/dac-ta-thong-bao-da-cong.md) | Thông báo đa cổng: surface, targeting, vòng đời, theme và analytics |
| [ke-hoach-cv-template-v3.md](01-phan-tich/ke-hoach-cv-template-v3.md) | Kế hoạch làm lại template CV, tạo CV, trích xuất CV upload và quản trị mẫu CV (CVT-0…CVT-7) |

## 02-tong-quan — Kiến trúc và quyết định

| Tài liệu | Nội dung |
| --- | --- |
| [tong-quan-he-thong.md](02-tong-quan/tong-quan-he-thong.md) | Ba cổng, stack, service Compose, bản đồ app và các luồng chính |
| [quy-uoc-code.md](02-tong-quan/quy-uoc-code.md) | Quy ước cấu trúc module và chất lượng code |
| [cv-builder-architecture-foundation.md](02-tong-quan/cv-builder-architecture-foundation.md) | Kiến trúc CV Builder: canonical document, template, editor, import và export |
| [adr-0012-job-services-architecture.md](02-tong-quan/adr-0012-job-services-architecture.md) | Vòng đời hiển thị của tin; phần dịch vụ đã được ADR-0015 thay thế |
| [adr-0013-public-companies-api.md](02-tong-quan/adr-0013-public-companies-api.md) | API công khai cho danh bạ công ty |
| [adr-0014-job-post-moderation.md](02-tong-quan/adr-0014-job-post-moderation.md) | Hậu kiểm tin tuyển dụng thay cho duyệt trước |
| [adr-0015-remove-commercial-services.md](02-tong-quan/adr-0015-remove-commercial-services.md) | Gỡ gói dịch vụ, quyền lợi và yêu cầu tư vấn |
| [adr-0016-remove-two-factor-auth.md](02-tong-quan/adr-0016-remove-two-factor-auth.md) | Gỡ xác thực hai bước (2FA/MFA) ở cả ba cổng |
| [employer-remediation-decision-log.md](02-tong-quan/employer-remediation-decision-log.md) | Biên bản quyết định của đợt hardening cổng nhà tuyển dụng |
| [chatbot-local-decision-log.md](02-tong-quan/chatbot-local-decision-log.md) | Biên bản quyết định cho chatbot ứng viên chạy local |
| [employer-flow-security-audit-2026-08.md](02-tong-quan/employer-flow-security-audit-2026-08.md) | Audit luồng và bảo mật nhà tuyển dụng (2026-08) |
| [flow-audit-2026-07.md](02-tong-quan/flow-audit-2026-07.md) | Audit ba luồng nghiệp vụ trọng yếu (2026-07) |

## 03-database

| Tài liệu | Nội dung |
| --- | --- |
| [thiet-ke-database.md](03-database/thiet-ke-database.md) | Quy ước, ERD, bảng theo miền, ràng buộc và bất biến |

## 04-api

| Tài liệu | Nội dung |
| --- | --- |
| [tai-lieu-api.md](04-api/tai-lieu-api.md) | Endpoint theo miền, quyền, mã lỗi |
| [openapi.yaml](04-api/openapi.yaml) | Schema OpenAPI sinh từ `manage.py spectacular` |
| [frontend-response-contracts.md](04-api/frontend-response-contracts.md) | Hình dạng response mà frontend phụ thuộc |
| [cookie-consent-va-job-view-tracking.md](04-api/cookie-consent-va-job-view-tracking.md) | Consent cookie và ghi nhận lượt xem, hiển thị việc làm |

## 05-huong-dan

| Tài liệu | Nội dung |
| --- | --- |
| [huong-dan-cai-dat.md](05-huong-dan/huong-dan-cai-dat.md) | Cài đặt và chạy local, seed, kiểm tra runtime, quy tắc migration |
| [cau-hinh-env.md](05-huong-dan/cau-hinh-env.md) | Biến môi trường backend và frontend |
| [cau-hinh-site-settings.md](05-huong-dan/cau-hinh-site-settings.md) | Site settings theo nhóm |
| [social-login.md](05-huong-dan/social-login.md) | Cấu hình đăng nhập Google, Facebook, LinkedIn |
| [quan-tri-thong-bao-da-cong.md](05-huong-dan/quan-tri-thong-bao-da-cong.md) | Thao tác quản trị thông báo đa cổng |
| [quy-trinh-pull-request.md](05-huong-dan/quy-trinh-pull-request.md) | Nhánh, commit, PR và cổng kiểm tra |

## 06-deployment

| Tài liệu | Nội dung |
| --- | --- |
| [docker-compose.md](06-deployment/docker-compose.md) | Chạy toàn bộ dự án bằng Docker Compose |
| [huong-dan-deployment.md](06-deployment/huong-dan-deployment.md) | Định hướng triển khai production (chưa triển khai) và tách static, media |
| [van-hanh-va-kill-switch.md](06-deployment/van-hanh-va-kill-switch.md) | Cờ tính năng, giá trị an toàn, lệnh kiểm tra và rollback |
| [cloudflare-r2-media.md](06-deployment/cloudflare-r2-media.md) | Chính sách lưu media trên Cloudflare R2 |
| [employer-upload-storage-boundary-runbook.md](06-deployment/employer-upload-storage-boundary-runbook.md) | Ranh giới lưu trữ public, private, quarantine của upload (chưa rollout xong) |
| [employer-dpa-evidence-rollout.md](06-deployment/employer-dpa-evidence-rollout.md) | Cấu hình bằng chứng DPA (chưa kích hoạt) |
| [employer-sms-provider-adapter.md](06-deployment/employer-sms-provider-adapter.md) | Adapter SMS xác thực số điện thoại (chưa có gateway production) |

## 07-algorithms

| Tài liệu | Nội dung |
| --- | --- |
| [thuat-toan-ai.md](07-algorithms/thuat-toan-ai.md) | AI lõi: import CV, điểm hoàn thiện CV, đối sánh CV–việc làm, runtime `ai_core` |
| [ai-job-post-generation.md](07-algorithms/ai-job-post-generation.md) | AI tạo tin tuyển dụng |
| [candidate-job-recommendations.md](07-algorithms/candidate-job-recommendations.md) | Gợi ý việc làm cho ứng viên |
| [saved-job-recommendations.md](07-algorithms/saved-job-recommendations.md) | Gợi ý từ việc làm đã lưu |
| [chatbot-ung-vien-faq.md](07-algorithms/chatbot-ung-vien-faq.md) | Đặc tả chatbot FAQ cho ứng viên (chưa triển khai) |

## 08-frontend

| Tài liệu | Nội dung |
| --- | --- |
| [cau-truc-frontend.md](08-frontend/cau-truc-frontend.md) | Tóm tắt stack, ba cổng, layer, routing và phiên đăng nhập |
| [admin-job-management.md](08-frontend/admin-job-management.md) | Module quản lý tin tuyển dụng của quản trị viên |
| [dai-thong-bao-da-cong.md](08-frontend/dai-thong-bao-da-cong.md) | Runtime dải thông báo đa cổng |
