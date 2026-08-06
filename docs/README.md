# Tài liệu dự án — ProCV Platform

> [TIEN-DO-DU-AN.md](TIEN-DO-DU-AN.md) — theo dõi tiến độ toàn bộ dự án theo từng giai đoạn.

| Thư mục                         | Tài liệu                                                         | Nội dung                                                                |
| ------------------------------- | ---------------------------------------------------------------- | ----------------------------------------------------------------------- |
| [01-phan-tich](01-phan-tich/)   | [phan-tich-yeu-cau.md](01-phan-tich/phan-tich-yeu-cau.md)        | Phân tích yêu cầu, bài toán, đối tượng người dùng (PRD)                 |
| [02-tong-quan](02-tong-quan/)   | [tong-quan-he-thong.md](02-tong-quan/tong-quan-he-thong.md)      | Tổng quan hệ thống, kiến trúc, phạm vi MVP                              |
| [02-tong-quan](02-tong-quan/)   | [quy-uoc-code.md](02-tong-quan/quy-uoc-code.md)                  | Quy ước cấu trúc module, DRY, trách nhiệm và kiểm tra chất lượng        |
| [02-tong-quan](02-tong-quan/)   | [chatbot-local-decision-log.md](02-tong-quan/chatbot-local-decision-log.md) | Biên bản từng quyết định đã xác nhận cho chatbot AI chạy hoàn toàn local |
| [03-database](03-database/)     | [thiet-ke-database.md](03-database/thiet-ke-database.md)         | Thiết kế database, ERD, quy ước đặt tên                                 |
| [03-database](03-database/)     | [cv-builder-architecture-foundation.md](03-database/cv-builder-architecture-foundation.md) | Canonical document, template/version, taxonomy màu và lifecycle CV V2 |
| [03-database](03-database/)     | [ke-hoach-hoan-thien-cv-builder-theo-giai-doan.md](03-database/ke-hoach-hoan-thien-cv-builder-theo-giai-doan.md) | Trạng thái và roadmap hoàn thiện CV Builder |
| [03-database](03-database/)     | [ke-hoach-chien-dich-va-vong-doi-tin.md](03-database/ke-hoach-chien-dich-va-vong-doi-tin.md) | Ownership recruiter, chiến dịch, duyệt tin, quota và pipeline ứng viên |
| [03-database](03-database/)     | [ke-hoach-database-phan-quyen-admin.md](03-database/ke-hoach-database-phan-quyen-admin.md) | RBAC admin theo phòng ban, role, membership và audit |
| [03-database](03-database/)     | [ke-hoach-he-thong-thong-bao-chay.md](03-database/ke-hoach-he-thong-thong-bao-chay.md) | Dải thông báo đa cổng: revision, targeting, priority, consent, rollout |
| [03-database](03-database/)     | [ke-hoach-nang-cap-thong-bao-visual-theme.md](03-database/ke-hoach-nang-cap-thong-bao-visual-theme.md) | Nâng cấp visual strip: chọn màu, ảnh nền (vd. 980×31), phase AN-V0…V4 |
| [03-database](03-database/)     | [ke-hoach-faq-huong-dan.md](03-database/ke-hoach-faq-huong-dan.md) | Đặc tả full-stack FAQ/hướng dẫn ứng viên, workflow duyệt và lộ trình triển khai trước chatbot |
| [03-database](03-database/)     | [ke-hoach-chatbot-ung-vien-faq.md](03-database/ke-hoach-chatbot-ung-vien-faq.md) | Chatbot ứng viên: retrieval FAQ tìm việc (pgvector + Ollama embedding), phase CB-P0…P3 |
| [04-api](04-api/)               | [tai-lieu-api.md](04-api/tai-lieu-api.md)                        | Tài liệu API (endpoint, request/response)                               |
| [04-api](04-api/)               | [frontend-response-contracts.md](04-api/frontend-response-contracts.md) | Contract response tối thiểu theo từng màn hình frontend             |
| [04-api](04-api/)               | [cookie-consent-va-job-view-tracking.md](04-api/cookie-consent-va-job-view-tracking.md) | Consent cookie, browser storage và job-view tracking |
| [05-huong-dan](05-huong-dan/)   | [huong-dan-cai-dat.md](05-huong-dan/huong-dan-cai-dat.md)        | Hướng dẫn cài đặt, chạy dự án local                                     |
| [05-huong-dan](05-huong-dan/)   | [cau-hinh-site-settings.md](05-huong-dan/cau-hinh-site-settings.md) | Cấu hình site settings (15 nhóm, schema-driven, quy ước env)         |
| [06-deployment](06-deployment/) | [knowledgebase-rollout-runbook.md](06-deployment/knowledgebase-rollout-runbook.md) | Rollout, readiness, observability và rollback Help Center |
| [05-huong-dan](05-huong-dan/)   | [social-login.md](05-huong-dan/social-login.md)                 | Cấu hình social login OAuth (lấy key Google/Facebook/LinkedIn)          |
| [05-huong-dan](05-huong-dan/)   | [quy-trinh-pull-request.md](05-huong-dan/quy-trinh-pull-request.md) | Quy trình Pull Request, review, branch protection và Definition of Done |
| [05-huong-dan](05-huong-dan/)   | [quan-tri-thong-bao-da-cong.md](05-huong-dan/quan-tri-thong-bao-da-cong.md) | Vận hành editor, priority, revision, lifecycle và audit thông báo |
| [06-deployment](06-deployment/) | [huong-dan-deployment.md](06-deployment/huong-dan-deployment.md) | Hướng dẫn deploy, Docker, môi trường production                         |
| [06-deployment](06-deployment/) | [admin-rbac-g1-runbook.md](06-deployment/admin-rbac-g1-runbook.md) | Hai release G1.1/G1.2 và readiness gate cho RBAC admin |
| [06-deployment](06-deployment/) | [announcement-rollout-runbook.md](06-deployment/announcement-rollout-runbook.md) | AN-P5: rollout tuần tự, kill switch, monitoring và rollback dải thông báo |
| [06-deployment](06-deployment/) | [announcement-staging-evidence-2026-07-29.md](06-deployment/announcement-staging-evidence-2026-07-29.md) | AN-P5: bằng chứng rehearsal bốn surface, priority, kill switch và Redis failure |
| [07-algorithms](07-algorithms/) | [thuat-toan-ai.md](07-algorithms/thuat-toan-ai.md)               | Thuật toán AI: trích xuất kỹ năng, matching CV-Job, chấm điểm phỏng vấn |
| [08-frontend](08-frontend/)     | [cau-truc-frontend.md](08-frontend/cau-truc-frontend.md)         | Cấu trúc frontend, component, quy ước code                              |
| [08-frontend](08-frontend/)     | [dai-thong-bao-da-cong.md](08-frontend/dai-thong-bao-da-cong.md) | Runtime strip đa cổng, priority, accessibility, rollout và rollback     |

Nội dung chi tiết sẽ được bổ sung dần theo từng bước triển khai.
