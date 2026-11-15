# Tiến độ dự án

File này giữ trạng thái hiện tại và việc còn mở. Chi tiết từng thay đổi nằm ở
[`CHANGELOG.md`](../CHANGELOG.md); lịch sử đầy đủ của file này nằm trong git.

## Tổng quan

| Hạng mục | Trạng thái |
| --- | --- |
| [Thống nhất luồng đăng tin, hiển thị, ứng tuyển, công ty](#thống-nhất-luồng-đăng-tin-hiển-thị-ứng-tuyển-công-ty-2026-11-15) | ✅ Cả 6 giai đoạn đã gộp (#208–#215); hoàn thiện luồng nhắc NTD và lịch sử nộp trên nhánh `feat/application-reminders` |
| [Đối sánh ngữ nghĩa CV–JD chạy local](#đối-sánh-ngữ-nghĩa-cvjd-chạy-local-2026-11-15) | 🟨 Nền tảng (tuần 1) xong trên nhánh `feat/ai-matching-foundation`, chưa mở PR |
| [CV tải lên: tệp gốc, tiêu chuẩn upload, giới hạn CV, NTD tìm kiếm](#cv-tải-lên-tệp-gốc-tiêu-chuẩn-upload-giới-hạn-cv-ntd-tìm-kiếm-2026-11-15) | ✅ Gộp vào `dev` (#203) |
| [Việc làm tốt nhất xếp theo chất lượng tin](#việc-làm-tốt-nhất-xếp-theo-chất-lượng-tin-2026-11-15) | ✅ Gộp vào `dev` (#204) |
| [Thiết kế lại quản lý tin tuyển dụng của NTD](#thiết-kế-lại-quản-lý-tin-tuyển-dụng-của-ntd-2026-11-15) | ✅ Gộp vào `dev` (nhánh `feat/employer-job-workspace`) |
| [Gỡ widget Trợ lý ProCV ở cổng ứng viên](#gỡ-widget-trợ-lý-procv-ở-cổng-ứng-viên-2026-11-14) | 🟨 Xong trên nhánh `refactor/remove-candidate-assistant`, chờ gộp PR vào `dev` |
| [Gỡ phòng ban, chức danh, nhân viên quản trị (ADR-0018)](#gỡ-phòng-ban-chức-danh-nhân-viên-quản-trị-adr-0018-2026-11-14) | 🟨 Xong trên nhánh `refactor/remove-admin-rbac`, chờ gộp PR vào `dev` |
| [Trang công ty và quyền biên tập (CP)](#trang-công-ty-và-quyền-biên-tập-cp-2026-11-14) | 🟨 CP-0 → CP-7 xong trên nhánh `feat/company-page`, chờ gộp PR |
| [Làm lại Template CV, tạo CV, trích xuất upload (CVT-v3)](#làm-lại-template-cv-cvt-v3-2026-11-13) | 🟨 CVT-0 → CVT-2 đã gộp vào `dev` (PR #176, #178–#182); CVT-3 xong code |
| [Gỡ xác thực hai bước (ADR-0016)](#gỡ-xác-thực-hai-bước-adr-0016-2026-11-13) | 🟨 Xong trên nhánh `refactor/remove-two-factor`, chưa commit/gộp |
| [Epic hậu kiểm tin, gỡ dịch vụ, dọn docs (PM)](#epic-hậu-kiểm-tin-gỡ-dịch-vụ-thương-mại-và-dọn-docs-pm-2026-11-13) | 🟨 PM-0 đến PM-6 xong trên nhánh, chưa gộp; còn PM-5 và một phần PM-7 |
| [Epic tái cấu trúc ProCV (P0–P10)](#epic-tái-cấu-trúc-procv-p0p10-2026-09) | 🟨 P0 Verified, P1–P4 và P8–P9 Implemented |
| [Epic hardening cổng nhà tuyển dụng (ER)](#epic-rà-soát-và-hardening-cổng-nhà-tuyển-dụng-er-2026-08-10) | 🟨 Code xong; chờ kích hoạt ER-3, ER-8 |
| [Các epic đã hoàn tất](#các-epic-đã-hoàn-tất) | ✅ |
| [Lộ trình theo PRD](#lộ-trình-theo-prd) | 🟨 Phần AI lõi (giai đoạn 2–3) còn mở |
| [Việc còn mở](#việc-còn-mở) | |

## Thống nhất luồng đăng tin, hiển thị, ứng tuyển, công ty (2026-11-15)

Rà soát luồng thấy nhiều khái niệm có nhiều nơi tự tính (trạng thái tin tính ở
8 chỗ với 2 múi giờ, quyền đăng tin và quyền nhận hồ sơ mỗi thứ có 2 bộ điều
kiện), dẫn đến luật bị lách và UI hứa tính năng chưa có. Mục tiêu: mỗi khái
niệm chỉ một hàm làm nguồn sự thật. Làm xong đợt này rồi mới tiếp tục AI; mỗi
giai đoạn một PR vào `dev`.

Quyết định đã chốt: tài nguyên vẫn theo từng NTD nhưng chặn ứng viên tính cho
cả công ty và tham gia công ty cần owner duyệt; bắt buộc xác thực + DPA trước
khi đăng tin; mở lại tin áp luật như gia hạn, không tính lượt; mỗi ứng viên chỉ
một hồ sơ hiệu lực trên một tin, có trạng thái "Đã rút"; tin bị ẩn vì lý do sửa
được thì có vòng yêu cầu sửa; công ty bị ẩn, mất DPA hoặc dính compliance hold
thì tin tự ẩn và tự hiện lại khi khắc phục; gỡ cờ `JOB_LIFECYCLE_V2_MODE`; "Đang
tuyển" chỉ đếm tin đang công khai, luôn theo giờ Việt Nam; tìm hồ sơ cho NTD làm
thật trong hạng mục AI.

| GĐ | Hạng mục | Trạng thái |
| --- | --- | --- |
| 1 | Trạng thái hiệu lực của tin + lý do ẩn, giờ VN, bộ lọc công khai khớp quyền xem dữ liệu ứng viên | ✅ Gộp vào `dev` (#209) |
| 2 | Dùng chung điều kiện chặn đăng tin; mở lại tin áp luật gia hạn | ✅ Gộp vào `dev` (#211) |
| 3 | Một hồ sơ hiệu lực trên một tin, rút hồ sơ, tự động từ chối và thống kê chỉ tính hồ sơ hiệu lực | ✅ Gộp vào `dev` (#213) |
| 4 | Vòng yêu cầu sửa tin → NTD sửa → gửi duyệt lại | ✅ Gộp vào `dev` (#214) |
| 5 | Chặn ứng viên theo công ty, owner duyệt yêu cầu tham gia, logic công ty vào service, gỡ liên kết công ty, SMS dev | ✅ Gộp vào `dev` (#215) |
| 6 | Tắt đồng ý tìm hồ sơ thì gỡ mọi CV khỏi tìm kiếm; sửa câu chữ hứa tính năng chưa có | ✅ Gộp vào `dev` (#208) |

<details><summary>Ngừng tuyển và trang "Việc làm đã ứng tuyển" mới (16/11)</summary>

- NTD **ngừng tuyển** (đổi tên từ "Đóng tin"; tin hết hạn nộp/hết thời gian hiển
  thị cũng tính là ngừng tuyển). Tin ngừng tuyển vẫn xem được chi tiết
  (`accepting_applications=false`, `stopped_at`), nút ứng tuyển thay bằng nhãn
  "Hết hạn ứng tuyển" + nút "Xem việc làm liên quan" cuộn xuống cuối trang; tin
  bị ẩn do kiểm duyệt/công ty vẫn trả 404.
- Trang "Việc làm đã ứng tuyển" làm lại theo mẫu TopCV: banner hướng dẫn "Nhắc
  NTD", bộ lọc luôn đủ 8 trạng thái (cuộn hai chiều), dòng trạng thái nổi bật
  ("NTD ngừng tuyển vị trí này (giờ)", "NTD đã xem CV. ProCV đã nhắc NTD…"),
  thanh 5 bước có hiệu ứng trượt/ánh sáng, tiến trình chi tiết thu gọn được.
  Mốc ngừng tuyển thắng nếu đến sau mọi thao tác của ứng viên; hồ sơ đã có kết
  quả giữ kết quả. Tin đã ngừng tuyển thì không còn nút Nhắc NTD/Rút hồ sơ.
- **Bỏ tính năng "Đổi CV"** (API `applications/<id>/cv/`, action `update_cv`):
  muốn nộp CV khác thì rút hồ sơ rồi ứng tuyển lại (tốn 1 lượt).

</details>

<details><summary>Hoàn thiện luồng ứng tuyển: nhắc NTD, lịch sử nộp (16/11)</summary>

- Nhắc NTD (`ApplicationReminder`, thông báo `application_awaiting_reply`):
  hệ thống tự nhắc khi hồ sơ chưa phản hồi 3 ngày và 7 ngày (gom một thông báo
  mỗi tin, task `send_unanswered_application_reminders` chạy mỗi giờ); ứng viên
  có nút "Nhắc NTD" sau 3 ngày kể từ khi nộp, tối đa 2 lần, cách nhau 3 ngày.
  Mỗi lần nhắc là một mốc "ProCV đã nhắc nhà tuyển dụng phản hồi CV của bạn"
  trong lịch sử ứng tuyển của ứng viên; NTD thấy lần nhắc gần nhất trong khung
  xử lý hồ sơ.
- NTD thấy đúng "Lần N" của hồ sơ hiện tại và mục "Các lần nộp trước" (chỉ xem,
  kèm kết quả: đã rút, không phù hợp).

</details>

<details><summary>Ghi chú GĐ5</summary>

- Tham gia công ty có sẵn tạo `CompanyJoinRequest` chờ chủ công ty duyệt (thông
  báo cho owner và người xin); chỉ khi duyệt mới gán `RecruiterProfile.company`
  với vai trò thành viên. Người xin thấy thẻ "Đang chờ duyệt" và hủy được để
  chọn công ty khác; owner duyệt/từ chối ở trang Thông tin công ty. Logic tạo
  và tham gia công ty nằm ở `employers/services/company_membership.py`.
- Chặn ứng viên tính cho cả công ty khi nộp hồ sơ (`is_candidate_blocked_for_job`);
  "từ chối hồ sơ chờ" khi chặn vẫn chỉ trên tin của chính NTD đó.
- Gỡ liên kết công ty (admin) chia 3 nhóm: không chặn (nhu cầu tuyển dụng, lịch
  sử xác thực, tin nháp/đã đóng); tự rút khi gỡ (hồ sơ xác thực chưa duyệt về
  nháp kèm sự kiện `withdrawn_by_unlink`, giấy tờ chưa duyệt, yêu cầu cập nhật
  đang chờ); chặn kèm cách xử lý (đã duyệt xác thực, còn tin đang tuyển, chiến
  dịch chưa kết thúc, compliance hold, chủ công ty còn thành viên khác).
- SMS OTP trên dev: `EMPLOYER_SMS_OTP_ENABLED=True`, `EMPLOYER_SMS_PROVIDER=console`
  (đổi `backend/.env` xong phải `docker compose up -d backend worker`), mã OTP
  hiện trong `docker logs -f ai-recruitment-platform-worker-1`. Production chỉ
  cho phép provider `http` và cần adapter riêng cho nhà cung cấp được chọn.

</details>

<details><summary>Ghi chú GĐ4</summary>

- Quản trị viên có thao tác "Yêu cầu chỉnh sửa", chỉ với lý do sửa được (thiếu
  nội dung, gây hiểu nhầm, trùng lặp, khác); tin chuyển hold
  `changes_requested`, vẫn ẩn, NTD nhận thông báo kèm ghi chú cần sửa.
- NTD sửa được tin, rồi bấm "Gửi duyệt lại"; sau đó khóa tới khi admin khôi phục
  hoặc yêu cầu sửa tiếp. Hàng chờ admin có bộ lọc "Chờ duyệt lại", ô tổng hợp
  đếm số tin chờ.
- Lý do nặng (bị cấm, lừa đảo, báo cáo đã xác nhận) vẫn khóa cứng. Cập nhật
  [ADR-0014](02-tong-quan/adr-0014-job-post-moderation.md).

</details>

<details><summary>Ghi chú GĐ3</summary>

- `Application.is_current` + ràng buộc unique có điều kiện: mỗi ứng viên chỉ một
  hồ sơ hiệu lực trên một tin; bản nộp cũ là lịch sử chỉ đọc. Migration
  `applications.0018` đánh dấu bản mới nhất của mỗi cặp là hiệu lực (sao lưu
  `backups/pre-application-single-active-20261116.dump`).
- Trạng thái mới `withdrawn` ("Đã rút"): ứng viên rút được khi hồ sơ chưa có kết
  quả, NTD nhận thông báo trong chuông, thông báo quyết định đang chờ gửi bị hủy;
  NTD không đổi được trạng thái hồ sơ đã rút.
- Nộp lại chỉ khi hồ sơ hiệu lực đã bị từ chối hoặc đã rút (vẫn giữ trần 3 lần
  và chờ 5 phút).
- Tự động từ chối, nhắc hạn, chặn ứng viên kèm từ chối hồ sơ chờ, dashboard,
  danh sách/xuất CSV của NTD, thống kê chiến dịch và tin chỉ tính hồ sơ hiệu lực;
  `application_count` đếm ứng viên, không đếm lượt nộp.
- Ứng viên: trang "Việc làm đã ứng tuyển" có nút "Rút hồ sơ"; nút ở
  trang tin hiện "Đã ứng tuyển" khi hồ sơ đang được xử lý.

</details>

<details><summary>Sửa migration test đỏ sẵn trên dev</summary>

- `ApplicationSnapshotMigrationTests.test_mismatched_snapshot_is_refused` xóa
  `CvVersion` bằng model runtime khi schema đang ở mốc cũ; Django lan phép xóa
  sang `matching_matchdocument` (app matching mới) chưa tồn tại ở mốc đó, test
  hỏng giữa chừng và kéo theo các test migration khác trong cùng worker. Giờ xóa
  bằng model của trạng thái migration đang áp dụng.

</details>

<details><summary>Ghi chú GĐ2</summary>

- `employer_job_posting_context` tính `job_postable` bằng đúng các điều kiện
  `publish_job` chặn (xác thực đã duyệt, DPA hiện hành, không compliance hold)
  và trả `publish_blockers`; banner hạn mức ở đầu form liệt kê từng điều kiện
  kèm liên kết khắc phục, câu chữ quota lấy số lượt Cấp 3 từ site settings
  (`verified_publish_limit`).
- `_ensure_public_lifetime` dùng chung cho gia hạn và mở lại: trần 90 ngày tính
  từ lần duyệt đầu, hạn nộp không vượt thời gian hiển thị, không quá ngày kết
  thúc chiến dịch. Mở lại vẫn không tính lượt; hết vòng đời thì phải nhân bản.
- Gia hạn kiểm tra lại xác thực, DPA, compliance hold như khi đăng; sửa lỗi
  crash khi tin không có hạn nộp.
- Sửa e2e smoke danh sách tin đỏ sau GĐ1 (mock thiếu `effective_state`).

</details>

<details><summary>Ghi chú GĐ1</summary>

- Nguồn duy nhất ở `apps/jobs/models/querysets.py` (xem
  [ADR-0019](02-tong-quan/adr-0019-job-effective-state.md)): danh sách điều kiện
  công khai có mã, nhãn, hành động khắc phục; `JobState` gồm nháp, đang tuyển,
  bị ẩn, hết hạn, đã đóng. Danh sách tin NTD, chiến dịch, dashboard, admin và
  lý do chặn ở trang kiểm duyệt đều đọc từ đây, luôn theo lịch Việt Nam
  (`common/vietnam_time.py`).
- Bộ lọc công khai bắt buộc xác thực đã duyệt, DPA hiện hành, không compliance
  hold của NTD và trang công ty không bị ẩn, tức khớp `candidate_data_access`.
  `create_application_record` kiểm tra lại dưới khóa, kèm việc chặn ứng viên
  (chuyển từ serializer vào service).
- Gỡ cờ `JOB_LIFECYCLE_V2_MODE`; migration `jobs.0052` điền cửa sổ hiển thị cho
  tin còn thiếu mốc.
- NTD thấy tab "Bị ẩn" và khung lý do kèm liên kết khắc phục ở chi tiết tin;
  dashboard báo số tin đang bị ẩn; admin lọc được tin bị ẩn.
- Nhập tin hàng loạt và `seed_demo_jobs` chỉ đăng dưới NTD đã xác thực, còn DPA.
  Ngày 15/11 đã bổ sung bằng chứng demo (hoàn tất đăng ký, SĐT, giấy tờ, DPA,
  duyệt xác thực) cho 9 NTD demo trên DB dev để 100/100 tin công khai và nhận
  hồ sơ; sao lưu trước khi sửa: `backups/pre-demo-employer-approval-20261115.dump`.

</details>

<details><summary>Ghi chú GĐ6</summary>

- Tắt đồng ý `RECRUITER_VISIBILITY` ở cả hai đường ghi (API
  `recruiter-visibility` và form nhu cầu công việc) đều đặt
  `recruiter_searchable=False` cho mọi CV của ứng viên
  (`withdraw_cvs_from_recruiter_search` trong `apps/cvs/services`).
- Gỡ khối "Đang bật/tắt tìm việc" ở sidebar tài khoản: công tắc chỉ là state cục
  bộ và hứa hồ sơ "hiển thị nổi bật" trong tìm kiếm của NTD. Câu chữ ở sidebar,
  hộp đồng ý và banner "Bật tìm việc cho CV" nói rõ tính năng tìm ứng viên sắp
  ra mắt.
- Khi làm tìm ứng viên trong hạng mục AI: chỉ trả CV có `recruiter_searchable`
  và hồ sơ còn đồng ý; giữ cam kết trong hộp đồng ý là ẩn họ tên, ảnh và thông
  tin liên hệ cho tới khi ứng viên đồng ý kết nối.

</details>

## Đối sánh ngữ nghĩa CV–JD chạy local (2026-11-15)

AI lõi của đồ án cho phía ứng viên: bấm "Xem độ phù hợp" trên một tin để nhận
điểm tổng, điểm theo tiêu chí, kỹ năng khớp/thiếu và gợi ý cải thiện CV. Mô hình
`intfloat/multilingual-e5-base` chạy và fine-tune trên máy local, không gọi API
ngoài. Lộ trình 8 tuần (16/11/2026 → 10/01/2027), mỗi giai đoạn một PR.

| Tuần | Hạng mục | Trạng thái |
| --- | --- | --- |
| 1 | Nền tảng: pgvector, schema `apps/matching`, môi trường huấn luyện `ml/`, kiểm chứng fine-tune trên MPS | 🟨 Code xong trên nhánh, chưa mở PR; còn nhập JD thật và viết rubric chấm điểm |
| 2 | Trích xuất và chuẩn hóa CV/JD, mở rộng taxonomy kỹ năng, baseline TF-IDF/BM25 (PR 1) | ⬜ |
| 3 | Encoder zero-shot, chấm điểm, giải thích, API, worker suy luận (PR 2) | ⬜ |
| 4 | Giao diện "Xem độ phù hợp" ở trang chi tiết tin (PR 3), bản demo tối thiểu | ⬜ |
| 5 | Tập vàng 150 cặp do người chấm; đo baseline và zero-shot; sinh dữ liệu huấn luyện | ⬜ |
| 6 | Fine-tune, ablation, chọn mô hình đưa vào sản phẩm | ⬜ |
| 7 | Đo hiệu năng, nghiệm thu chức năng (PR 4) | ⬜ |
| 8 | Viết báo cáo, diễn tập demo | ⬜ |

<details><summary>Ghi chú tuần 1</summary>

- Image DB là `pgvector/pgvector:pg16-trixie`, không phải tag `pg16`: volume
  `pgdata` tạo trên Debian trixie (glibc 2.41), còn `pg16` là bookworm (glibc
  2.36) nên sẽ lệch phiên bản collation. Bản sao lưu trước khi đổi:
  `backups/pre-pgvector-20261115.dump`.
- Ngày 15/11 đã xóa toàn bộ 53 tin mẫu cùng hồ sơ ứng tuyển thử trong DB dev
  (sao lưu `backups/pre-job-cleanup-20261115.dump`). Tin thật được điền vào
  `ml/data/jd_input.xlsx` (không commit) rồi nhập bằng
  `ml/scripts/import_jd.py` (chạy thử trước, `--apply --create-skills` để ghi;
  bảng đối chiếu mã tin lưu ở `ml/data/jd_import_map.json`); rubric gán nhãn bản
  nháp ở `ml/labeling/rubric.md`.
- Ngày 15/11 đã nhập 100 tin thật (90 TopCV, 10 ITviec; 78 tin tiếng Việt, 22
  tin tiếng Anh; đủ 8 nhóm ngành) vào các công ty demo. Danh mục kỹ năng tăng
  từ 42 lên 344; bảng gộp cách viết và hai nhóm "Kỹ năng mềm", "Phẩm chất cá
  nhân" ở `ml/labeling/skill_merge.json`. Sao lưu trước khi nhập:
  `backups/pre-jd-import-20261115.dump`.
- `apps/matching` mới có ba bảng (`MatchDocument`, `MatchChunk`,
  `MatchAnalysis`) và test ràng buộc; chưa có service, API hay task.
- Đo trên MacBook Pro M5, 16 GB (torch 2.15.0, sentence-transformers 6.3.0):
  mã hóa 371 câu ngắn/giây trên MPS; fine-tune 5,6 giây/bước ở batch 32, ước
  45–90 phút cho 5.000 bộ ba × 3 epoch.
- Fine-tune trên MPS với cấu hình mặc định báo lỗi dropout của
  `scaled_dot_product_attention`; phải nạp mô hình với
  `attention_probs_dropout_prob=0.0` (đã đặt sẵn trong `ml/scripts/smoke_mps.py`).
- Không giới hạn thì vùng nhớ MPS lên khoảng 9,7 GB và swap tăng khoảng 6 GB.
  Đặt `PYTORCH_MPS_HIGH_WATERMARK_RATIO=0.6` giữ ở khoảng 7,4 GB, chậm hơn
  khoảng 9% (6,1 giây/bước).

</details>

## CV tải lên: tệp gốc, tiêu chuẩn upload, giới hạn CV, NTD tìm kiếm (2026-11-15)

- Lỗi tìm thấy: `backend/.env` bật `*_UPLOAD_SESSION_REQUIRED=True` khi quarantine
  tắt nên mọi upload bị 409; local đã đưa về `False` (bật lại phải kèm
  `UPLOAD_QUARANTINE_ENABLED=True` + ClamAV). CV tải lên hiện trống vì mọi màn
  hình dựng từ `content_json` rỗng.
- Xem tệp gốc: `GET /api/v2/cvs/<id>/source/` (chủ CV) và
  `GET /api/v2/cvs/shares/<token>/source/` (link chia sẻ, không ghi thêm lượt
  truy cập); DOCX đổi sang PDF bằng LibreOffice. Hàm đổi chuyển từ `employers`
  sang `common/office_preview.py`. Trang xem và link chia sẻ của CV tải lên hiện
  tệp gốc (ẩn thanh công cụ PDF); thẻ CV tải lên là biểu tượng thư mục, không
  có nút sửa.
- Tiêu chuẩn upload + nhận dạng CV (`apps/cvs/services/cv_document.py`, dùng
  chung cho upload trực tiếp, phiên upload và job import AI): PDF/DOCX đúng chữ
  ký, ≤ 5 MB, ≤ 20 trang, PDF có lớp chữ và không mật khẩu; phải có email/số
  điện thoại và ≥ 2 nhóm mục CV, trong đó có kinh nghiệm/học vấn/kỹ năng. Từ khóa
  chỉ tính ở dòng ngắn dạng tiêu đề (≤ 40 ký tự, hoặc phần trước dấu ":") để báo
  cáo/thư nhắc "kinh nghiệm" trong câu không lọt; so khớp bỏ dấu, bỏ khoảng trắng
  vì PDF hay tách chữ; văn bản > 30.000 ký tự bị loại. Lỗi trả `CV_REJECTED` kèm
  `reason`.
- Giới hạn số CV theo site setting `candidate_max_cvs` (mặc định 6, tính cả CV
  lưu trữ) áp ở mọi đường tạo CV; lỗi `CV_LIMIT_REACHED` "Hiện tại tài khoản của
  bạn chỉ hỗ trợ tạo 6 CV!".
- Cho NTD tìm kiếm theo từng CV: cột `UserCv.recruiter_searchable` (migration
  `cvs.0017`), chỉ bật được khi hồ sơ đã đồng ý `RECRUITER_VISIBILITY`. Công tắc
  trên mọi thẻ CV, popup "Quản lý danh sách" (bật/tắt nhiều CV + đồng ý một lần)
  và khối "Bật tìm việc cho CV" đầu trang CV của tôi; sidebar đếm số CV đang bật.
  Chưa có màn hình NTD tìm ứng viên đọc cờ này (thuộc hạng mục đối sánh CV–JD);
  tắt đồng ý thì mọi CV về `recruiter_searchable=False` (GĐ6 đợt thống nhất luồng).
- Trang xem CV `/cvs/<id>/view` và `/cv/share/<token>`: layout riêng không header
  site, thanh mảnh với Tải CV PDF / Sửa CV / Copy CV (nhân bản); bỏ khối chọn
  phiên bản + xuất PDF (`CvPdfExportControl` đã xóa).
- Editor CV bỏ tự động lưu: chỉ lưu khi bấm Lưu CV (hoặc trước khi đổi mẫu/áp
  nội dung mẫu); rời trang khi còn thay đổi thì hỏi xác nhận.
- Trang `/tai-cv-len` (kéo thả, tiêu chuẩn, lợi ích) và màn hình tải lên thành
  công gợi ý mẫu CV online (`?nguon=tai-len`).
- Còn mở: CV tải lên nguyên tệp chưa dùng để ứng tuyển được — version của nó
  rỗng nên `application_readiness_issues` chặn (cần phân tích nội dung hoặc cho
  NTD xem tệp gốc).

## Việc làm tốt nhất xếp theo chất lượng tin (2026-11-15)

- Lỗi tìm thấy: box "Việc làm tốt nhất" ở trang chủ chỉ nhận tin hạng TOP (dịch
  vụ trả phí đã gỡ), còn 100 tin thật nhập ngày 15/11 đều là tin thường nên box
  trống.
- Nay mọi tin đang hoạt động đều đủ điều kiện, xếp theo điểm chất lượng
  (`apps/jobs/selectors/homepage.py`): công khai lương +3, nhãn HOT/GẤP +2, đăng
  trong 7 ngày +2 (trong 30 ngày +1), từ 5 lượt ứng tuyển +1. Tin cùng điểm vẫn
  luân phiên theo seed (F5 ra lượt khác, phân trang ổn định).
- Feed `/viec-lam` mặc định vẫn xếp theo hạng tin rồi độ mới; không ảnh hưởng vì
  mọi tin hiện là tin thường.

## Xử lý hồ sơ ứng tuyển — giai đoạn 1 (2026-11-15)

Lộ trình 6 giai đoạn của workspace `/tuyendung/app/applications`; mỗi giai
đoạn một PR.

| GĐ | Hạng mục | Trạng thái |
| --- | --- | --- |
| 1 | Quy trình 6 trạng thái (bỏ `considering`), thông báo ứng viên (chuông + email) có cửa sổ hoàn tác, tải PDF CV kèm nhật ký truy cập, chặn nộp CV rỗng, làm lại giao diện | ✅ Đã gộp vào dev (#195, #199) |
| 2 | Điểm phù hợp CV–JD có giải thích, xếp hạng danh sách | ⬜ |
| 3 | Chia sẻ CV bằng link bảo mật + phiếu đánh giá nội bộ | ✅ Đã gộp vào dev (#196) |
| 4 | Danh sách đen + phát hiện ứng tuyển hàng loạt | ✅ Đã gộp vào dev (#197) |
| 5 | Kho ứng viên tiềm năng + gợi ý lại khi đăng tin mới | ✅ Đã gộp vào dev (#198) |
| 6 | Gợi ý kỹ năng còn thiếu cho ứng viên bị từ chối | ⬜ |
| Sau | Nhắn tin ứng viên (nút đã đặt sẵn), hẹn lịch phỏng vấn | ⬜ |

<details><summary>Ghi chú giai đoạn 1</summary>

- Trạng thái: `submitted`/`viewed` do hệ thống đặt; NTD chọn Phù hợp, Phỏng
  vấn, Trúng tuyển, Không phù hợp (không cần lý do). Trạng thái cuối có xác
  nhận.
- `CandidateNotification` (app `candidates`) vừa là hộp thư vừa là outbox
  email. Quyết định hẹn giao sau 5 phút; quyết định mới hơn trên cùng hồ sơ
  thay thế thông báo chưa giao; hoàn tác hủy thông báo. Giao và hủy là hai
  UPDATE có điều kiện nên không tranh chấp. Beat `dispatch-candidate-notifications`
  60s. Ứng viên chỉ thấy trạng thái đã được báo.
- NTD tải PDF qua `CvExport` của snapshot (`cv=NULL`, còn sau khi ứng viên xóa
  CV); mọi lần xem/tải ghi `CvAccessLog` (trước đây không nơi nào ghi).
- Lỗi tìm thấy: form ứng tuyển nộp CV DOCX/PDF trước khi phân tích xong nên NTD
  nhận CV rỗng. Nay chờ `waitForCvImport` và server chặn CV thiếu họ tên /
  liên hệ / nội dung.
- Sửa thêm: GET snapshot của ứng viên bị hạn chế trả 500.
- Xác nhận nộp hồ sơ (chuông + email có việc làm tương tự) và trang "Cài đặt
  nhận thông báo" theo kênh Email/Web; xóa 9 công tắc không có tác dụng.
- Sidebar NTD: "Quản lý CV" → "CV ứng tuyển" (mọi tin, badge CV chưa xem);
  "Kho ứng viên tiềm năng" và "Danh sách đen" hiện "Sắp mở" theo GĐ 4–5.

</details>

## Thiết kế lại quản lý tin tuyển dụng của NTD (2026-11-15)

| Hạng mục | Trạng thái |
| --- | --- |
| Danh sách `/tuyendung/app/jobs`: tab trạng thái có số đếm, tìm kiếm tự động, cột hồ sơ/hiệu quả/hạn nộp | ✅ |
| Chi tiết `/tuyendung/app/jobs/:id`: header gọn, 4 chỉ số bấm được, giữ 4 tab | ✅ |
| Tab CV ứng tuyển lọc/phân trang phía server, chip trạng thái kèm số | ✅ |
| API: `status_counts`, `unviewed_application_count`, `application_summary`, `impression_count` | ✅ |

<details><summary>Ghi chú chi tiết</summary>

- Danh sách: tab Tất cả/Đang tuyển/Nháp/Hết hạn/Đã đóng đọc `status_counts`
  của `GET /api/jobs/mine/` (một aggregate, đếm theo cùng `q`); tìm kiếm debounce
  400 ms, giữ `status|q|page` trên URL. Mỗi tin hiện số ứng viên, badge "N mới"
  dẫn tới `/applications?job=…&scope=unread`, lượt xem + tỉ lệ ứng tuyển, hạn
  nộp có đếm ngược, màu cảnh báo và thanh thời gian đã trôi. Từ 1280px dòng là
  bảng; hẹp hơn là thẻ xếp chồng. Trạng thái rỗng dùng `MascotEmpty`.
- Chi tiết: bỏ thông tin lặp (lượt xem xuất hiện ba lần, hai thẻ CV luôn bằng
  nhau vì chỉ có nguồn `applied`). Header gồm tiêu đề, trạng thái, dòng meta bằng
  icon, "Xem tin đăng" khi tin đang công khai; "Đóng tin" nằm trong menu và có
  xác nhận. Bốn chỉ số Lượt xem/Ứng viên/CV chưa xem/Chưa phản hồi; hai chỉ số
  sau mở tab CV với bộ lọc tương ứng (`cv_filter` trên URL). Mobile dùng
  `Segmented` thay cho Select chọn tab.
- Tab CV trước đây tải trang đầu (20 CV) rồi tự tính số liệu, nên sai khi tin
  có nhiều hồ sơ. Nay số liệu lấy từ `application_summary` của chi tiết tin và
  danh sách gọi `/api/v2/recruiter/applications/?job=…&latest=1` có phân trang,
  sắp xếp, tìm kiếm, lọc phía server; gỡ `getRecruiterApplications` không còn
  nơi dùng. Tab "Ứng viên đã xem tin" thành phễu Hiển thị → Xem → Ứng tuyển.
- `Application.UNANSWERED_STATUSES` là định nghĩa duy nhất cho "chưa phản hồi"
  (scope API, báo cáo chiến dịch, summary tin). Budget query danh sách 5 → 6.
- Style riêng của hai trang nằm trong `employer-jobs.css` đi theo chunk lazy;
  CSS khởi tạo giảm từ 38,3 xuống 38,0 KiB gzip.

</details>

## Gỡ widget Trợ lý ProCV ở cổng ứng viên (2026-11-14)

Xóa toàn bộ `frontend/src/widgets/candidate-assistant` (nút nổi góc phải dưới,
panel chat, kịch bản keyword tĩnh, CSS, unit test) và điểm mount trong
`MainLayout`. Widget không gọi API nên backend không đổi; khóa
`sessionStorage` `procv-assistant-greeting-seen` không còn được ghi. Smoke E2E
bỏ luồng hỏi trợ lý, test tablet chỉ còn kiểm tra nút nổi hỗ trợ. Mascot,
`use-progressive-reply` và `use-visual-viewport-bottom-inset` giữ lại vì
onboarding, hero và nút hỗ trợ còn dùng. Đặc tả chatbot (CB) ghi chú tạm dừng:
mở lại CB-P2 phải dựng UI mới.

## Gỡ phòng ban, chức danh, nhân viên quản trị (ADR-0018, 2026-11-14)

Quyết định: [`adr-0018-remove-admin-rbac.md`](02-tong-quan/adr-0018-remove-admin-rbac.md).
Còn hai cấp quản trị: superuser và admin thường. Xóa phòng ban, chức danh, gán
nhân viên, phạm vi cấp tài khoản và danh mục 56 mã quyền (backend, frontend,
docs); trang `/access-control` và bước CI đồng bộ quyền bị gỡ. Superuser mời
admin qua email (không chọn chức danh), đăng nhập/đặt lại mật khẩu giữ nguyên.
Migration `accounts.0034` (xóa dữ liệu RBAC — cần `pg_dump` trước khi chạy) và
`sitecontent.0023` (xóa nhóm settings `admin_roles`).

Kiểm chứng:

- Backend: ruff, import-linter, layering, `makemigrations --check` sạch. Test
  theo nhóm: accounts/knowledgebase/sitecontent 264 passed, employers 468
  passed, applications/blog/cv_templates/cvs/jobs 463 passed (3 test
  `test_pdf_renderer` lỗi do venv local thiếu `playwright`, không liên quan).
  `accounts.0034` chạy tới → lùi `0033` → tới lại trên DB riêng. Suite đầy đủ
  kèm ngưỡng coverage 84% chưa chạy xong cục bộ, để CI xác nhận.
- Frontend: lint, kiến trúc, build, bundle budget đạt; vitest 1389 test, ratchet
  coverage đạt. E2E smoke 284 passed; spec `admin-company.spec.js` vốn fail trên
  mobile ở CI của `dev` từ khi gộp trang công ty (6 tab tràn khung, antd mobile
  bỏ menu "…" nên tab ngoài khung không bấm được) — test nay chọn tab bằng bàn
  phím (focus + Enter), pass cả desktop/tablet/mobile.
- Chạy thật trên DB riêng `rbac_verify`: superuser đăng nhập → mời admin (không
  có ô chức danh) → link `/invitation` đặt mật khẩu → admin thường đăng nhập,
  thấy 11 khu vực, không có nhóm "Hệ thống"; `/settings` → trang từ chối,
  `/access-control` → 404; API lời mời/settings/audit toàn hệ thống trả 403.

## Trang công ty và quyền biên tập (CP, 2026-11-14)

Kế hoạch: [`ke-hoach-trang-cong-ty.md`](01-phan-tich/ke-hoach-trang-cong-ty.md).
Quyết định: [ADR-0017](02-tong-quan/adr-0017-company-page.md), ER-D58 đến ER-D64.

| Giai đoạn | Nội dung | Trạng thái |
| --- | --- | --- |
| CP-0 | Nền móng: predicate người đại diện chuyển xuống `employers/models/representation.py`; `GET /api/jobs/?company=<public_id>` (0 query phát sinh) và `company_slug` trên DTO tin; slug `tim-kiem` dành riêng; `Company.public_headquarters` dùng chung cho danh bạ và chi tiết tin (hộ kinh doanh không lộ địa chỉ); frontend chuyển `CompanyLogo` + helper tên công ty vào `entities/company`, `RichContent` và `ShareButtons` vào `shared/ui` | ✅ Xong trên nhánh, chưa gộp |
| CP-1 | `GET /api/companies/<slug>/` dạng khối có kiểu (một builder), công ty tương tự, facets tỉnh/thành; admin tạm ẩn trang (`company_page.moderate`, 404 thật, loại khỏi danh bạ/sitemap/gợi ý); SEO shell `/cong-ty/<slug>` + `Organization`/`BreadcrumbList`, `sitemaps/companies.xml`; seed tạo owner đã xác thực | ✅ Xong trên nhánh, chưa gộp |
| CP-2 | Trang `/cong-ty/:slug` (Tổng quan / Việc làm qua URL, lọc từ khoá + tỉnh), thay mọi liên kết công ty theo tên bằng slug, tab admin "Trang công khai" | ✅ Xong trên nhánh, chưa gộp |
| CP-3 | Theo dõi công ty (idempotent, `follower_count` qua `F()`), trang `/tai-khoan/cong-ty-dang-theo-doi` | ✅ Xong trên nhánh, chưa gộp |
| CP-4 | Báo cáo thông tin sai, hàng chờ admin "Báo cáo công ty" (`company_report.*`), xử lý kèm tạm ẩn trang | ✅ Xong trên nhánh, chưa gộp |
| CP-5 | Chính sách quyền ở tầng models, uỷ quyền biên tập, bố cục áp dụng ngay (khoá lạc quan), tin ghim; workspace `/tuyendung/app/company-page` có xem trước | ✅ Xong trên nhánh, chưa gộp |
| CP-6 | Khẩu hiệu, văn hoá, video, mạng xã hội, phúc lợi dạng thẻ, văn phòng qua `CompanyUpdateRequest` (gộp theo khối), tab "Nội dung", độ hoàn thiện | ✅ Xong trên nhánh, chưa gộp |
| CP-7 | Nguồn digest email thứ ba "công ty đang theo dõi", tuỳ chọn `followed_company_jobs` | ✅ Xong trên nhánh, chưa gộp |

## Làm lại Template CV (CVT-v3, 2026-11-13)

Kế hoạch: [`ke-hoach-cv-template-v3.md`](01-phan-tich/ke-hoach-cv-template-v3.md)
(gồm mục 5.6 — dữ liệu CV cùng từ vựng với JD để làm matching sau này).

| Giai đoạn | Nội dung | Trạng thái |
| --- | --- | --- |
| CVT-0 | Sửa preview kẹt khi mở trang chi tiết mẫu; bỏ "Khôi phục bản chưa lưu" (UI + `GET /api/v2/cvs/latest-recoverable-draft/`); đồng bộ H1/breadcrumb/`<title>` và query `nguon`, `vi-tri`, `ngon-ngu`, `mau`; chỉ còn tiếng Việt/Anh (`SUPPORTED_LOCALE_CODES`, redirect 301 kho Nhật/Trung) | ✅ Gộp vào `dev` (PR #176, 2026-11-13). pytest 1155 passed (87,48%), vitest 1196/1198 (2 test nhà tuyển dụng timeout khi chạy song song, chạy riêng pass), E2E smoke 257 passed + 1 flaky (announcement strip mobile, chạy lại 3/3 pass) |
| CVT-1a | Ngôn ngữ CV thành enum `CvLanguage`; tên/mô tả/SEO mẫu thành trường `*_vi`/`*_en` (data migration giữ dữ liệu); gỡ `sitecontent.Locale`, API locale, `locale_ref`, tab admin "Ngôn ngữ", entity FE `locale`; xóa dữ liệu tiếng Nhật/Trung | ✅ Gộp vào `dev` (PR #178 frontend, #179 backend + docs, 2026-11-14). pytest 1151 passed (87,48%), vitest 1198/1198, E2E smoke 258 passed |
| CVT-1b | `CvPositionProfile` (1-1 vị trí chuyên môn, `section_preset`), `ExperienceBand`, nội dung mẫu theo vị trí × ngôn ngữ × nhóm kinh nghiệm, bỏ `CvContentBlueprint` (data migration giữ nội dung), resolver ưu tiên đúng nhóm kinh nghiệm, seed mới; gỡ tab/menu Blueprint và menu "Ngôn ngữ" sót từ CVT-1a | ✅ Gộp (PR #180, 2026-11-14). pytest 1155 passed (87,60%), vitest 1198/1198, E2E smoke 258 passed |
| CVT-1c | `UserCv.experience_years` (enum JD, tính từ mục kinh nghiệm) dùng cho gợi ý việc làm; gỡ cột legacy của `UserCv`/`CvTemplate`, adapter V1, `theme_color`/`color_variants` trên card, `sample_content_public_id` khi tạo CV và endpoint chi tiết nội dung mẫu | ✅ Gộp (PR #181, 2026-11-14) |
| CVT-2 | Registry 8 layout dùng chung BE/FE (`layouts.json`, test so khớp); một renderer chung theo hàng/vùng (tone plain/tint/band, xếp dọc/ngang, biến thể timeline/compact), bỏ header cứng — tên/liên hệ/ảnh là section đặt theo vùng; PDF và ảnh catalogue in bằng Chromium (Playwright) từ trang `cv-print.html` của frontend, chặn mọi request ngoài origin; 4 font OFL tự host (Inter, Roboto, Be Vietnam Pro, Lora), font cũ map sang font mới; seed publish version mới cho 10 mẫu; migration đổi khóa layout cũ; danh tính minh họa chỉ cho ảnh catalogue và khách chưa đăng nhập | ✅ Gộp (PR #182, 2026-11-14). Thiết kế 8 layout đã duyệt. pytest 1161 passed (87,63%), vitest 1203/1203, E2E smoke 267 passed |
| CVT-3 | Trường riêng theo vị trí (`CvPositionField`, section `position_details` chụp định nghĩa vào CV), từ khóa vị trí; section `portfolio`, `publications`; matching: `education_level` từ `degree_level`, `position_level` chọn trong panel "Hồ sơ ứng tuyển" của editor, `CvSkill` đồng bộ theo taxonomy kỹ năng; sinh nội dung mẫu bằng AI qua runtime `ai_core` (queue `ai-generation`, ≤ 16 tổ hợp, chặn dữ liệu cá nhân, trạng thái chờ duyệt); một bản xuất bản mỗi tổ hợp; API admin vị trí/trường riêng/độ phủ/import-export JSON; seed trường riêng cho 9 vị trí | 🟨 Xong code trên nhánh `feat/cvt-3-positions` |
| CVT-4 | Cổng quản trị Mẫu CV: tổng quan, danh sách mẫu (kéo thả thứ tự, nhân bản, ẩn/hiện), **trang chỉnh sửa một màn hình** thay wizard 6 bước (thiết lập trái, xem trước phải, tự lưu, bản nháp tạo tự động; tạo mẫu chỉ cần tên VI/EN + bố cục, backend xếp sẵn mục theo `section_plans` và gán bảng màu khởi đầu), hộp xuất bản có checklist + PDF thử; vị trí & nội dung gợi ý (ma trận kinh nghiệm × ngôn ngữ, hàng đợi duyệt AI); thư viện; CV ứng viên có audit. Sửa: preview admin giật (vòng lặp thanh cuộn ↔ tỉ lệ thu phóng), lỗi "locale, experience_band must make a unique set" khi lưu nội dung gợi ý, lỗi "≤ 90" khi lưu độ rộng cột; kho mẫu công khai đổi sang `Cache-Control: public, no-cache` + ETag/304 (ẩn/xuất bản có hiệu lực ngay), ảnh mẫu cũ xóa trễ 30 phút và frontend thay ảnh lỗi bằng khung minh họa | 🟨 Xong code trên nhánh `feat/cvt-4-admin-portal` |
| CVT-5 | Trang chi tiết mẫu: lựa chọn (nguồn, vị trí, kinh nghiệm, ngôn ngữ, màu) có một nguồn sự thật là query string; `useCvSource` dùng TanStack Query (preview cũ giữ khi tải bản mới, màu áp phía client); vị trí mặc định không ghi lên URL, trang có query `noindex`; chưa đăng nhập → đăng nhập ngay tại trang rồi tự tạo CV một lần; `POST /api/v2/cvs/` nhận `Idempotency-Key`; mobile có thanh "Tạo CV" cố định + bottom sheet (nút nổi tự nâng qua `--page-bottom-bar-height`); kho mẫu `useInfiniteQuery` 24 mẫu/trang, lọc có ảnh / một-hai cột | 🟨 Xong code trên nhánh `feat/cvt-5-template-detail` |
| CVT-6…CVT-7 | Upload, hoàn thiện | ⬜ Planned |

## Gỡ xác thực hai bước (ADR-0016, 2026-11-13)

Quyết định: [`adr-0016-remove-two-factor-auth.md`](02-tong-quan/adr-0016-remove-two-factor-auth.md).
Gỡ 2FA/MFA ở cả ba cổng (backend, frontend, docs); `bootstrap_admin_mfa` thay
bằng `verify_admin_email`. Migration `accounts.0030` và `knowledgebase.0004` đã
chạy trên DB local (có bản `pg_dump` trước khi chạy). Cổng `check_all.sh` xanh:
pytest 1155 passed (87,48%), vitest 1190, E2E smoke 258 passed.

## Epic hậu kiểm tin, gỡ dịch vụ thương mại và dọn docs (PM, 2026-11-13)

Quyết định:
[`adr-0014-job-post-moderation.md`](02-tong-quan/adr-0014-job-post-moderation.md),
[`adr-0015-remove-commercial-services.md`](02-tong-quan/adr-0015-remove-commercial-services.md).

Các nhánh nối tiếp nhau, chưa push; gộp theo thứ tự:

| PR | Nhánh | Phase | Cổng kiểm tra |
| --- | --- | --- | --- |
| 1–2 | `refactor/remove-job-approval-workflow` | PM-1 → PM-3b | pytest 1268 passed (87,70%); vitest 1247, E2E 270 passed |
| 3 | `refactor/remove-commercial-services` | PM-4a | pytest 1175 passed (87,47%); vitest 1208, E2E 258 passed |
| 4 | `chore/drop-services-app` | PM-4b | pytest 1176 passed (87,47%) |
| 5 | `docs/restructure-docs` | PM-6 | link check |
| 6 | `docs/sync-progress-and-changelog` | PM-7 | link check |

PR 4 chỉ được triển khai ở môi trường đã chạy `services.0012` (PR 3). DB local
đã áp dụng `services.0012` trước khi kịp sao lưu, vì container backend chạy
`manage.py migrate` khi khởi động; bản sao lưu sau đó nằm ở
`~/Documents/ai-recruitment-platform-backups/`.

> Lưu ý khi chạy E2E local: nếu container frontend Docker đang giữ cổng 5173,
> Playwright sẽ dùng lại server đó và nhiều test lỗi giả. Chạy
> `PLAYWRIGHT_PORT=4317 PLAYWRIGHT_WEB_SERVER=preview npm run test:e2e:smoke`.

| Phase | Nội dung | Trạng thái |
| --- | --- | --- |
| PM-0 | Tag `pre-post-moderation`, nhánh làm việc | ✅ Hoàn tất |
| PM-1 | ADR-0014, ADR-0015, đánh dấu ADR-0012 thay thế một phần | ✅ Hoàn tất |
| PM-2 | Backend: đăng tin là công khai, gỡ duyệt tin, migration dữ liệu | ✅ Hoàn tất — đạt cổng backend |
| PM-3 | Frontend: cổng nhà tuyển dụng và quản trị theo hợp đồng API mới | ✅ Hoàn tất — đạt cổng frontend kể cả E2E |
| PM-3b | Lưu cam kết chịu trách nhiệm khi đăng và mở lại tin; nhà tuyển dụng thấy tin bị tạm ẩn kèm nhóm lý do | ✅ Hoàn tất — đạt cổng backend và frontend |
| PM-4a | Gỡ mọi chỗ dùng `services`, giao diện, quyền admin; migration xóa bảng | ✅ Hoàn tất — đạt cổng, migration đã chạy trên DB local |
| PM-4b | Xóa thư mục app `services` và cấu hình còn lại | ✅ Hoàn tất — pytest 1176 passed, coverage 87,47% |
| PM-5 | Kiểm thử tích hợp ba cổng | ⬜ Chưa bắt đầu |
| PM-6 | Dọn docs, xóa `99-tien-do`, dựng lại mục lục | ✅ Hoàn tất — 88 → 46 file, link check đạt |
| PM-7 | Bổ sung changelog còn thiếu, rút gọn tiến độ, đồng bộ phân tích yêu cầu với báo cáo ĐATN | 🟨 Changelog, tiến độ và sơ đồ use case tổng quát (2026-11-15) xong; chờ báo cáo ĐATN |

Đã chốt (2026-11-13): nhà tuyển dụng không sửa được tin đang bị tạm ẩn; muốn
khắc phục nội dung phải liên hệ quản trị viên.

## Epic tái cấu trúc ProCV (P0–P10, 2026-09)

Mục tiêu: tổ chức lại repo, CI, env và docs mà không đổi UI, URL, API, dữ liệu,
quyền hay lịch tác vụ. Baseline: `dev` tại `dddf4455` (23/09/2026).

| Giai đoạn | Đầu ra | Trạng thái |
| --- | --- | --- |
| P0 | Kiểm kê repo, hợp đồng hành vi, số đo CI | ✅ Verified |
| P1 | Chẩn đoán và sửa test lỗi hoặc treo | 🟨 Implemented |
| P2 | Dọn artifact, media test và ignore; đợt 2 (2026-11-13, `chore/repo-cleanup`): test media vào thư mục tạm, siết `backend/.dockerignore`, xóa code/asset/lệnh one-off chết | 🟨 Implemented |
| P3 | Bỏ cấu hình deploy production, giữ Compose local | 🟨 Implemented |
| P4 | Mỗi service một cặp `.env`/`.env.example` (backend, frontend), bỏ env root, gỡ biến chết, `sync_local_env.py` | 🟨 Implemented |
| P5 | Chuẩn hóa backend theo app | ⬜ Planned |
| P6 | Chuẩn hóa ownership frontend | ⬜ Planned |
| P7 | Hợp nhất docs và tiến độ | Thay bằng PM-6, PM-7 của epic hậu kiểm |
| P8–P9 | Tối ưu thời gian CI: pytest song song, shard unit/E2E | 🟨 Implemented — lượt đo thứ hai chưa có |
| P10 | Nghiệm thu và hồ sơ bàn giao | ⬜ Planned |

Việc còn mở:

- P1–P4, P8–P9 chỉ chuyển Verified sau khi gộp vào `dev` và full CI đạt trên
  cùng SHA.
- E2E CI còn lỗi không ổn định ở một viewport mỗi lượt, chưa rõ nguyên nhân gốc;
  CI cho phép một lần retry và báo `flaky`.
- `npm audit fix` cần chạy trên máy có kết nối npm registry.
- Env cá nhân còn key `SPEECH_*` của TTS đã gỡ và hai key lặp
  (`EMPLOYER_DOMAIN_DNS_TIMEOUT_SECONDS`, `EMPLOYER_DOMAIN_RECHECK_BATCH_SIZE`);
  chủ máy tự xóa, không xóa theo wildcard.

## Epic rà soát và hardening cổng Nhà tuyển dụng (ER, 2026-08-10)

Đặc tả canonical:
[`dac-ta-nha-tuyen-dung.md`](01-phan-tich/dac-ta-nha-tuyen-dung.md).
Decision log:
[`employer-remediation-decision-log.md`](02-tong-quan/employer-remediation-decision-log.md).

Code đã hoàn tất cho ER-0 đến ER-8. Còn lại là việc kích hoạt: upload strict
mode và Chrome QA (ER-3), DPA cần bản pháp lý chính xác, SMS cần gateway
production, staging và soak (ER-8). Lệnh kiểm tra chỉ đọc:
`audit_employer_workflow_rollout`.

| Phase | Nội dung | Trạng thái |
| --- | --- | --- |
| ER-0 | Audit baseline, permission/state matrix và khóa quyết định | ✅ Hoàn tất |
| ER-1 | Empty/error state, document IDOR và job approval guard | ✅ Hoàn tất |
| ER-2 | Readiness/permission contract và frontend guards | ✅ Hoàn tất |
| ER-3 | Upload session, quarantine, malware scan và retention | 🟨 Đang làm — Docker/ClamAV local đạt; còn Chrome + staging/strict rollout |
| ER-4 | Company update request V2, revision và conflict handling | ✅ Hoàn tất |
| ER-5 | Verification final decision, blockers và compliance holds | ✅ Hoàn tất |
| ER-6 | SMS provider adapter và DPA evidence/version/grace | ✅ Hoàn tất code — production SMS activation thuộc ER-8 |
| ER-7 | Company unlink, notification center và activity | ✅ Hoàn tất code |
| ER-8 | Rollout, reconciliation, compatibility cleanup và audit closure | 🟨 Code complete — chờ staging/production activation và soak |

## Các epic đã hoàn tất

| Epic | Thời gian | Kết quả chính | Tài liệu |
| --- | --- | --- | --- |
| FAQ và hướng dẫn sử dụng (KB-P0…P6) | 2026-08 | Trung tâm trợ giúp public, workspace quản trị có revision | [đặc tả](01-phan-tich/dac-ta-trung-tam-tro-giup.md) |
| Thông báo đa cổng (AN-P0…P5) và visual theme (AN-V0…V3) | 2026-07 → 08 | Dải thông báo ba cổng, targeting, analytics, theme và ảnh nền | [đặc tả](01-phan-tich/dac-ta-thong-bao-da-cong.md) |
| Hoàn thiện CV Builder (CVB-P0…P6, CVB-8) | 2026-07 | Canonical document, catalogue, import PDF/DOCX, editor WYSIWYG A4 | [kiến trúc](02-tong-quan/cv-builder-architecture-foundation.md) |
| Dọn dẹp frontend (FE-P1…P6) | 2026-07 | Enforcement FSD, TanStack Query, tách file lớn, tối ưu asset | [`frontend/ARCHITECTURE.md`](../frontend/ARCHITECTURE.md) |
| Audit và refactor toàn dự án (AR-P0…P8) | 2026-07 | Layout ADR-0010, import-linter, coverage gate 84%, xóa API v1 | [audit](02-tong-quan/flow-audit-2026-07.md) |
| Onboarding ứng viên dạng hội thoại | 2026-08 | Một trang hội thoại năm câu hỏi | [đặc tả](01-phan-tich/dac-ta-onboarding-ung-vien.md) |
| Account status enforcement, vá xác thực admin và OAuth | 2026-07 | Khóa, tạm khóa, hold tài nguyên; MFA admin | [database](03-database/thiet-ke-database.md) |
| Trang chủ, cổng marketing nhà tuyển dụng | 2026-07 | Trang chủ ứng viên, 4 trang marketing VI/EN | [tổng quan](02-tong-quan/tong-quan-he-thong.md) |

## Lộ trình theo PRD

| Giai đoạn | Trạng thái | Ghi chú |
| --- | --- | --- |
| 0 — Khởi tạo dự án | ✅ | |
| 1 — MVP lõi | ✅ | Ba cổng, việc làm, CV builder, ứng tuyển, workspace chiến dịch và tin |
| 2 — AI cơ bản | 🟨 | Đã có: import CV qua AI, đối sánh rule-based (`match_score`), runtime `ai_core` với `AiInvocation` và `AiUsageDaily`. Chưa có: bảng `cv_analysis`, `match_results`, `ai_suggestions`; trích xuất kỹ năng; mô hình phân loại kỹ năng |
| 3 — Tối ưu tìm kiếm / matching | 🟨 | Embedding (pgvector) và semantic matching CV–JD: nền tảng đã có, xem [đối sánh ngữ nghĩa CV–JD chạy local](#đối-sánh-ngữ-nghĩa-cvjd-chạy-local-2026-11-15) |
| 4 — CV nâng cao | 🟨 | Còn import LinkedIn, AI writer, review CV bằng AI |
| 5 — Tuyển dụng nâng cao | ✅ | Việc đã lưu, lịch sử trạng thái hồ sơ, notification center của nhà tuyển dụng |
| 6 — Thương mại & quản trị | ✅ | Quản trị (hai cấp superuser/admin theo ADR-0018), blog, marketing. Gói đăng ký và quota trả phí (6.1, 6.2) bỏ khỏi phạm vi theo ADR-0015 |
| 7 — Deployment | 🟨 | Docker Compose local có; cấu hình production đã bỏ ở P3, chưa triển khai |

## Việc còn mở

AI lõi của đồ án (phạm vi chốt 2026-11-15, xem
[sơ đồ use case](01-phan-tich/phan-tich-yeu-cau.md#sơ-đồ-use-case-tổng-quát-chốt-2026-11-15)):

- 🟨 Đối sánh ngữ nghĩa CV–JD chạy và fine-tune local (bi-encoder mã nguồn mở +
  pgvector, pipeline tự xây), không gọi API ngoài: xem
  [lộ trình 8 tuần](#đối-sánh-ngữ-nghĩa-cvjd-chạy-local-2026-11-15).
- ⬜ Ứng viên: Phân tích mức độ phù hợp CV–JD (điểm tổng và theo tiêu chí, kỹ
  năng khớp/thiếu, gợi ý cải thiện CV); chuyển Việc làm gợi ý sang module ngữ
  nghĩa.
- ⬜ Nhà tuyển dụng: Sàng lọc và xếp hạng hồ sơ ứng tuyển bằng AI; Tìm kiếm hồ
  sơ ứng viên xếp theo độ phù hợp với một tin (chỉ ứng viên đã bật
  `recruiter_visibility`).
- Giai đoạn 2–3: lưu kết quả phân tích CV và đối sánh, trích xuất kỹ năng
  ([thuật toán AI](07-algorithms/thuat-toan-ai.md)).
- Import CV gọi thẳng REST của Gemini, OpenAI hoặc Anthropic trong
  `apps/ai_core/services/cv_import.py`, không qua runtime `ai_core`: không bị
  `AI_RUNTIME_ENABLED` chặn, không ghi `AiInvocation`, không quota.
- Site setting `ai_cv_review_enabled`, `ai_job_match_enabled`,
  `ai_daily_request_limit` được seed nhưng không có chỗ nào đọc.

Dọn phần còn sót của ADR-0014 và ADR-0015:

- Site setting nhóm `payment` và `email_notify_job_approved` không còn consumer.
- `RecruitmentNeed.consultation_topics` còn lựa chọn `service_packages`.

Kích hoạt và rollout:

- ER-3, ER-8, DPA và SMS như mục ER ở trên; AN-P6 (xóa compatibility legacy sau
  một release ổn định); AN-V4 (runbook và seed ví dụ cho visual theme).
- P1–P4, P8–P9 chờ full CI trên `dev` để chuyển Verified.

Sản phẩm:

- Cảnh báo domain công ty ở `Register.jsx` hứa giới hạn mua hoặc đăng tin không
  tồn tại.
- `POST /api/jobs/mine/` bị chặn ở bước đăng vẫn giữ bản nháp vừa tạo.
