# Hướng dẫn quản trị thông báo đa cổng

Tài liệu này dành cho quản trị viên sử dụng route
`/admin/app/announcements`. Workspace quản trị là một phần của AN-P3 và dùng
trực tiếp contract revision/lifecycle của backend; không lưu bản nháp giả trong
trình duyệt.

## 1. Quyền truy cập

| Permission | Khả năng trong workspace |
| --- | --- |
| `announcement.view` | Mở route, lọc/sắp xếp, xem preview, revision và audit |
| `announcement.manage` | Tạo draft, tạo revision mới, đổi tên và nhân bản |
| `announcement.publish` | Publish/schedule, pause, resume và archive |

`announcement.manage` và `announcement.publish` phụ thuộc
`announcement.view`. Giao diện ẩn action không được cấp, nhưng backend vẫn là
nguồn kiểm quyền cuối; gọi mutation trực tiếp khi thiếu permission trả `403`.

## 2. Danh sách và bộ lọc

Danh sách dùng phân trang, lọc và sort phía server. URL là nguồn chuẩn cho:

- `q`: tên vận hành hoặc public ID;
- `lifecycle_state`: `draft`, `published`, `paused`, `archived`;
- `kind`: loại thông tin;
- `surface`: cổng hiển thị;
- `ordering`: field sort có whitelist;
- `page`: trang hiện tại.

Mọi cột dữ liệu đều có sorter. Khi đổi sort hoặc filter, workspace quay về
trang 1; bỏ sorter sẽ trở lại `-updated_at`. Không suy ra tổng số hoặc metric từ
`results` của trang hiện tại.

## 3. Tạo thông báo bằng editor năm bước

### Bước 1 — Nội dung

- Tên vận hành chỉ dành cho quản trị viên.
- Tiếng Việt bắt buộc.
- Tiếng Anh tùy chọn; khi trống runtime fallback về tiếng Việt.
- Nội dung là plain text, không nhận HTML.

### Bước 2 — Loại, icon và CTA

- Chọn loại để xác định priority tier.
- Icon chỉ được chọn từ allowlist.
- Chọn rõ **Không có CTA**, **Trang trong hệ thống** hoặc
  **Website bên ngoài**. Khi chọn trang trong hệ thống, tìm theo tên trang thay
  vì phải nhớ URL; danh mục được nhóm theo Ứng viên, Marketing NTD, Workspace
  NTD và Workspace quản trị.
- Nơi hiển thị thông báo và trang đích CTA là hai cấu hình độc lập. Ví dụ,
  thông báo chỉ hiện tại `/viec-lam` của Ứng viên vẫn có thể dẫn sang trang
  **Dịch vụ · Công khai** của Marketing NTD.
- Trang có nhãn **Công khai** mở được khi chưa đăng nhập. Trang có nhãn
  **Cần đăng nhập** sẽ đi qua guard của portal; editor cảnh báo nếu thông báo
  cho phép khách xem nhưng CTA yêu cầu đăng nhập.
- Danh mục tự tạo URL phù hợp cho local cùng host hoặc production dùng
  subdomain. Chế độ nâng cao vẫn cho gõ path nội bộ bắt đầu bằng `/`.
- URL ngoài chỉ dùng HTTPS và không chứa username/password.
- Critical bắt buộc `locked`, người dùng không thể đóng.

### Bước 3 — Target

- Chọn ít nhất một surface và một trạng thái đăng nhập.
- Role để trống nghĩa là mọi role phù hợp với surface.
- Route include/exclude dùng bộ chọn có tìm kiếm theo tên trang và tự lọc theo
  surface đã chọn. Có thể chọn nhiều hoặc gõ prefix tùy chỉnh rồi nhấn Enter.
- Include để trống nghĩa là mọi route trong surface. Prefix exclude được áp
  dụng sau include và luôn thắng khi cả hai cùng khớp.
- Prefix `/viec-lam` khớp cả trang danh sách và các route con như
  `/viec-lam/tai/ha-noi` hoặc `/viec-lam/<slug>`, nhưng không khớp một segment
  khác chỉ vô tình có cùng phần đầu.

### Bước 4 — Lịch và ưu tiên

- Giao diện nhập theo `Asia/Ho_Chi_Minh`; API lưu ISO UTC.
- `ends_at` phải sau `starts_at`.
- Critical bắt buộc có thời gian kết thúc.
- Priority từ 0–1000 chỉ so sánh trong cùng tier.
- Animation gồm `slide`, `fade`, `static`; thời lượng 4–15 giây.

### Bước 5 — Preview và simulator

Preview luôn dùng toàn bộ bản nháp đang giữ trong form, kể cả nội dung đã nhập
ở bước trước, và hỗ trợ desktop/mobile cùng Việt/Anh. Simulator hiển thị tier
hiện tại, surface đích, thông báo cùng/higher tier đang có và cảnh báo thứ tự
hệ thống:

1. Critical.
2. Xác thực email/bảo mật.
3. Pháp lý/tuân thủ.
4. Vận hành/bảo trì.
5. Nhu cầu công việc ứng viên.
6. Thông tin/sự kiện/tính năng/thành công.

Preview không thay thế dữ liệu thật: target và priority cuối cùng vẫn được
backend kiểm tra khi publish.

### Bảo trì danh mục route khi phát triển thêm trang

Danh mục CTA/prefix là metadata có kiểm soát, không tự quét JSX router vì hệ
thống không thể suy ra chính xác tên thân thiện, surface và yêu cầu đăng nhập.
Khi thêm một route có thể dùng trong thông báo, lập trình viên đăng ký route
đúng một lần tại
`frontend/src/widgets/admin-announcement-management/model/route-catalog.js`.
Test catalog bắt buộc mọi CTA an toàn, prefix hợp lệ và access chỉ thuộc
`public` hoặc `authenticated`.

Quản trị viên không phải sửa từng thông báo để “đăng ký” route mới: route mới
sẽ xuất hiện trong dropdown sau lần triển khai frontend tiếp theo. Nếu chưa có
trong catalog, ô CTA và route tag vẫn chấp nhận path tùy chỉnh hợp lệ.

Thông báo đã publish không tự đổi URL khi source code đổi route. Revision đã
phát hành là bất biến để giữ audit và tránh tự điều hướng sai; khi bỏ/đổi một
route đang được dùng, giữ redirect tương thích hoặc tạo revision thông báo mới
rồi publish theo quy trình bình thường.

## 4. Revision và lifecycle

- Create sinh announcement draft và revision 1.
- Sửa nội dung luôn tạo immutable revision mới; revision đã publish không bị
  ghi đè.
- Publish chọn revision mới nhất chưa active.
- `published → paused → published` dùng Pause/Resume.
- Archive là trạng thái cuối; muốn tái sử dụng phải Duplicate thành draft mới.
- Đổi tên vận hành không thay nội dung runtime.

Mọi mutation gửi `revision_token`. Nếu một tab hoặc quản trị viên khác đã thay
đổi dữ liệu, API trả `409 announcement_revision_stale`; workspace khóa luồng
hiện tại, hiển thị cảnh báo và yêu cầu tải bản mới nhất trước khi thao tác lại.
Không tự ghi đè hoặc retry mutation cũ.

## 5. Revision và audit history

Drawer chi tiết có hai lịch sử chỉ đọc:

- Revision: nội dung, loại, priority, surface, creator, thời gian và revision
  đang active.
- Audit: create/rename/revision/publish/pause/resume/archive/duplicate, actor,
  source, thời gian và metadata không nhạy cảm.

Audit được trả trong detail read-model cho người có `announcement.view`; không
cần mở quyền xem audit toàn hệ thống.

## 6. Hiệu quả và phạm vi số liệu

Tab **Hiệu quả** đọc aggregate phía server trên toàn bộ revision, không cộng
các dòng đang thấy trong trang danh sách. Quản trị viên có thể chọn 7, 30 hoặc
90 ngày và xem:

- lượt hiển thị và lượt click;
- CTR;
- số và tỷ lệ dismiss;
- chi tiết theo ngày và surface.

Ngày báo cáo dùng `Asia/Ho_Chi_Minh`. Số liệu chỉ bao gồm người dùng đã bật
Analytics, có Redis dedupe theo viewer–revision–event–ngày, nên không đại diện
toàn bộ người đã thấy strip. Redis lỗi làm rơi event để tránh đếm trùng và
không ảnh hưởng CTA/runtime. Không dùng dashboard này để suy ra traffic tổng
hoặc trạng thái functional dismiss.

## 7. Trạng thái lỗi và phục hồi

- Lỗi list/detail: hiển thị thông báo và nút retry; không làm hỏng admin shell.
- Submit lặp: mutation bị khóa trong lúc pending.
- `400`: giữ editor và hiển thị validation từ API.
- `403`: làm mới session permission theo cơ chế chung của admin.
- `409`: tải detail mới nhất trước khi sửa hoặc publish lại.
- Remote runtime feed lỗi không liên quan tới workspace và không làm mất các
  label bảo mật cục bộ.

## 8. Rollback

AN-P5 không thêm migration hoặc permission. Có thể revert application code và
OpenAPI diff mà không xóa announcement, revision, user state, daily metric,
permission hoặc audit. Runtime strip vẫn có
thể tắt độc lập bằng:

```env
VITE_ANNOUNCEMENT_ROLLOUT_SURFACES=none
```

Không archive hoặc xóa dữ liệu để rollback giao diện.

Trước khi rollout một surface, vận hành chạy read-only preflight:

```bash
python manage.py announcement_rollout_preflight \
  --require-live-surface candidate \
  --json
```

Kill switch runtime, failure injection, monitoring threshold và rollout tuần
tự phải theo [runbook AN-P5](../06-deployment/announcement-rollout-runbook.md).
