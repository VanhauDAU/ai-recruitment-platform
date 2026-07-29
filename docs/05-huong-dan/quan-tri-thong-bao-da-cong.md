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
- CTA tiếng Việt và URL phải cùng có hoặc cùng trống.
- URL nội bộ bắt đầu bằng `/` và không được bắt đầu bằng `//`.
- URL ngoài chỉ dùng HTTPS và không chứa username/password.
- Critical bắt buộc `locked`, người dùng không thể đóng.

### Bước 3 — Target

- Chọn ít nhất một surface và một trạng thái đăng nhập.
- Role để trống nghĩa là mọi role phù hợp với surface.
- Route prefix nhập mỗi dòng một path tuyệt đối.
- Prefix exclude được áp dụng sau include.

### Bước 4 — Lịch và ưu tiên

- Giao diện nhập theo `Asia/Ho_Chi_Minh`; API lưu ISO UTC.
- `ends_at` phải sau `starts_at`.
- Critical bắt buộc có thời gian kết thúc.
- Priority từ 0–1000 chỉ so sánh trong cùng tier.
- Animation gồm `slide`, `fade`, `static`; thời lượng 4–15 giây.

### Bước 5 — Preview và simulator

Preview hỗ trợ desktop/mobile và Việt/Anh. Simulator hiển thị tier hiện tại,
surface đích, thông báo cùng/higher tier đang có và cảnh báo thứ tự hệ thống:

1. Critical.
2. Xác thực email/bảo mật.
3. Pháp lý/tuân thủ.
4. Vận hành/bảo trì.
5. Nhu cầu công việc ứng viên.
6. Thông tin/sự kiện/tính năng/thành công.

Preview không thay thế dữ liệu thật: target và priority cuối cùng vẫn được
backend kiểm tra khi publish.

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

AN-P4 không thêm migration hoặc permission. Có thể revert application code và
OpenAPI diff mà không xóa announcement, revision, user state, daily metric,
permission hoặc audit. Runtime strip vẫn có
thể tắt độc lập bằng:

```env
VITE_ANNOUNCEMENT_ROLLOUT_SURFACES=none
```

Không archive hoặc xóa dữ liệu để rollback giao diện.
