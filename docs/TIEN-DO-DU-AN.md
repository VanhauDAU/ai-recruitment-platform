# Tiến độ dự án

> Quy ước: mỗi khi hoàn thành một công việc (xong code + test), tick `[x]` và đổi cột Trạng thái ngay trong lần commit đó — không để dồn việc cập nhật lại sau. Cập nhật dòng "Cập nhật lần cuối" ở cuối file.

Thứ tự giai đoạn theo tài liệu database v1.4 (mục 7), đã đối chiếu với PRD mục 11.

## Giai đoạn 0 — Khởi tạo dự án

| # | Công việc | Trạng thái |
|---|---|---|
| 0.1 | Chốt công nghệ (ReactJS+Vite, Django+DRF, PostgreSQL, JWT) | [x] Done |
| 0.2 | Scaffold Django project + apps skeleton | [x] Done |
| 0.3 | Scaffold React + Vite + Tailwind + Ant Design | [x] Done |
| 0.4 | Cấu trúc `docs/` theo chủ đề | [x] Done |
| 0.5 | README, CHANGELOG, hướng dẫn cài đặt local | [x] Done |

## Giai đoạn 1 — MVP lõi

| # | Công việc | Trạng thái |
|---|---|---|
| 1.1 | Bảng `users` (custom User, role, JWT auth) | [x] Done |
| 1.2 | Bảng `skills` (nguồn kỹ năng chuẩn, seed data) | [x] Done |
| 1.3 | Bảng `candidate_profiles` + API | [x] Done |
| 1.4 | Bảng `employer_profiles` + API | [x] Done |
| 1.5 | Frontend: trang đăng ký/đăng nhập, dashboard shell theo role | [x] Done |
| 1.6 | Bảng `job_categories` + API | [x] Done |
| 1.7 | Bảng `locations` (2 cấp tỉnh/xã, seed 34 tỉnh + 3321 xã/phường từ provinces.open-api.vn) + API tra cứu | [x] Done |
| 1.8 | Bảng `cv_templates` + API list/detail | [x] Done |
| 1.9 | Bảng `user_cvs` (builder + upload) + API CRUD/upload | [x] Done |
| 1.10 | Bảng `cv_skills` (nested trong API user_cvs) | [x] Done |
| 1.11 | Bảng `jobs` + API public list/detail + employer CRUD | [x] Done |
| 1.12 | Bảng `job_skills` (nested trong API jobs) | [x] Done |
| 1.13 | Bảng `applications` + API ứng tuyển/xem/đổi trạng thái | [x] Done |
| 1.14 | Frontend: CV builder, kho template, danh sách/chi tiết job, ứng tuyển | [ ] Một phần — trang chủ TopCV-style: header mega-menu (Việc làm/Tạo CV/Công cụ/Cẩm nang nghề nghiệp, icon, vách ngăn cột, mũi tên hiệu ứng khi hover), hero search + `LocationFilter`, **banner carousel** (tự trượt, prev/next, dot, dừng khi hover), mega-menu danh mục 3 cấp (nhóm nghề→nghề→vị trí chuyên môn khi hover, next/prev phân trang nhóm); danh sách job (bộ lọc, phân trang), chi tiết job (nhiều địa điểm, số lượng tuyển, học vấn); **CategoryPicker modal 3 cấp (multi-select, rút gọn id khi apply, drill-down mobile)**; **LocationFilter dùng chung Home+Jobs (chọn nhiều tỉnh+phường/xã, click tên là chọn, giữ checkbox khi mở lại, label "Tỉnh (Tất cả)"/"(n phường/xã)", drill-down mobile, áp dụng địa điểm ở trang chủ tìm ngay không cần bấm thêm)**; Skeleton + lazy-load + theme AntD xanh. Còn thiếu CV builder, kho template, luồng ứng tuyển |
| 1.6b | Seed job_categories (taxonomy 3 cấp: 8 nhóm nghề + 24 nghề + 61 vị trí chuyên môn) qua `seed_job_categories`; API lọc job nhận nhiều `?category=` và tự mở rộng xuống cấp con | [x] Done |
| 1.14b | Redesign trang danh sách việc làm kiểu TopCV: thanh tìm kiếm nền xanh (danh mục + từ khóa + địa điểm), heading đếm job + breadcrumb + gợi ý "N việc làm tại Hà Nội", sidebar Lọc nâng cao (danh mục nghề có số lượng & mở rộng cấp con, mức lương bucket + khoảng tự nhập + thoả thuận, cấp bậc, hình thức/loại hình làm việc, Xóa lọc), tabs tìm-theo + sắp xếp (Mới nhất/Lương cao nhất — thêm `?ordering=salary_desc` backend), JobCard mới (logo công ty, chips, kỹ năng, "Đăng N ngày trước", lưu tim localStorage); serializer thêm `company_logo_url` + `published_at` | [x] Done |
| 1.14d | Trang việc làm: header tự ẩn khi cuộn xuống (hook `useHideOnScroll` dùng chung toàn site), thanh tìm kiếm xanh sticky né header (offset động theo header), sidebar lọc dính ngay dưới thanh tìm kiếm (CSS var `--sb-top`), gắn `SearchDropdown` (gợi ý từ khóa + lịch sử + "việc làm quan tâm" + tabs tìm-theo) như trang chủ; các bộ lọc lựa chọn chuyển sang chip bo tròn (`SingleChips`/`MultiChips`) tự xuống hàng gọn thay grid 2 cột bị vỡ | [x] Done |
| 1.14c | Bộ lọc đầy đủ kiểu TopCV: thêm 3 field vào `jobs` (`experience_years` — kinh nghiệm theo năm chọn nhiều, `position_level` — 8 cấp bậc, `weekend_policy` — nghỉ/làm thứ 7, backfill dữ liệu demo từ experience_level qua migration 0007); filter API tương ứng + `?industry=` (lĩnh vực công ty, endpoint distinct `/api/employer/industries/`); sidebar mới: Nghỉ thứ 7 (badge AI), Kinh nghiệm checkbox 2 cột, Lĩnh vực công ty select, Cấp bậc 8 bậc, thanh dính đáy "Xóa lọc + Lưu bộ lọc" (localStorage); breadcrumb chuỗi danh mục cha→con click được; JobCard viền xanh nhạt | [x] Done |
| 1.15 | Quy trình duyệt/publish job (status draft -> active) | [ ] Chưa làm — hiện chỉnh trực tiếp qua Django shell/admin |

## Giai đoạn 2 — AI cơ bản

| # | Công việc | Trạng thái |
|---|---|---|
| 2.1 | Bảng `cv_analysis` | [ ] Chưa làm |
| 2.2 | Bảng `match_results` | [ ] Chưa làm |
| 2.3 | Bảng `ai_suggestions` | [ ] Chưa làm |
| 2.4 | Bảng `ai_usage_logs` | [ ] Chưa làm |
| 2.5 | `ai_core/cv_parser.py` — đọc CV PDF (PyMuPDF) | [ ] Chưa làm |
| 2.6 | `ai_core/skill_extractor.py` — trích xuất kỹ năng | [ ] Chưa làm |
| 2.7 | Dataset + train model phân loại nhóm kỹ năng (`skill_classifier.py`) | [ ] Chưa làm |
| 2.8 | `ai_core/job_matcher.py` — công thức match_score thống nhất | [ ] Chưa làm |

## Giai đoạn 3 — Tối ưu tìm kiếm / matching

| # | Công việc | Trạng thái |
|---|---|---|
| 3.1 | Bảng `embeddings` (pgvector) | [ ] Chưa làm |
| 3.2 | Semantic matching CV-JD (Sentence Transformer) | [ ] Chưa làm |

## Giai đoạn 4 — CV nâng cao

| # | Công việc | Trạng thái |
|---|---|---|
| 4.1 | Bảng `cv_versions` (undo/restore) | [ ] Chưa làm |
| 4.2 | Bảng `cv_exports` + export PDF | [ ] Chưa làm |

## Giai đoạn 5 — Tuyển dụng nâng cao

| # | Công việc | Trạng thái |
|---|---|---|
| 5.1 | Bảng `saved_jobs` | [ ] Chưa làm |
| 5.2 | Bảng `application_status_history` | [ ] Chưa làm |
| 5.3 | Bảng `notifications` | [ ] Chưa làm |

## Giai đoạn 6 — Thương mại & quản trị

| # | Công việc | Trạng thái |
|---|---|---|
| 6.1 | Bảng `subscription_plans` | [ ] Chưa làm |
| 6.2 | Bảng `user_subscriptions` (quota AI) | [ ] Chưa làm |
| 6.3 | Bảng `audit_logs` | [ ] Chưa làm |
| 6.4 | App `sitecontent`: `SiteSetting` (config key-value JSON) + `LinkGroup`/`LinkItem` (cụm link có thứ tự, source manual/auto từ locations·categories) + Django admin + API public `/api/site/`; frontend `PopularSearches` (cụm link SEO trên footer) đọc từ API | [x] Done |
| 6.5 | `sitecontent.Banner` (slide carousel trang chủ: eyebrow/title/subtitle/theme gradient hoặc image_url/CTA, order, is_active) + admin + API `/api/site/banners/`; `Home.jsx` render banner IT/CV từ API thay vì hardcode (slide thống kê vẫn code cứng vì cần số liệu jobCount/categories realtime) | [x] Done |

## Giai đoạn 7 — Phỏng vấn AI

| # | Công việc | Trạng thái |
|---|---|---|
| 7.1 | Bảng `interview_question_bank` | [ ] Chưa làm |
| 7.2 | Bảng `interview_sessions` | [ ] Chưa làm |
| 7.3 | Bảng `interview_questions` | [ ] Chưa làm |
| 7.4 | Bảng `interview_answers` + chấm điểm rule-based | [ ] Chưa làm |

## Giai đoạn 8 — Deployment

| # | Công việc | Trạng thái |
|---|---|---|
| 8.1 | Dockerfile backend + docker-compose (backend + PostgreSQL) | [ ] Chưa làm |
| 8.2 | Deploy (Vercel + Render/Railway hoặc Docker tự host) | [ ] Chưa làm |

---

Cập nhật lần cuối: 2026-07-08
