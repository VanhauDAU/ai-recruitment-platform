# Hợp đồng API & realtime — ProCV Connect (ADR-0032)

Mọi đường dẫn tương đối với `/api`. `{portal}` = `candidate` (ứng viên) hoặc `employer` (NTD).
ID luôn là `public_id` (`cnv_…`, `msg_…`, `itv_…`). Thời gian ISO 8601.

## Hội thoại

`ConversationSerializer`:

```json
{
  "public_id": "cnv_x",
  "my_role": "candidate | recruiter",
  "job": {"public_id": "job_x", "title": "…", "slug": "…", "salary_text": "10 - 15 triệu",
          "location_text": "Hà Nội, TP HCM", "stopped": false},
  "company": {"public_id": "cmp_x", "name": "…", "logo_url": "https://… | null"},
  "counterpart": {"name": "…", "avatar_url": "… | null"},
  "application": {"public_id": "app_x", "status": "submitted", "status_label": "Đã nộp hồ sơ"} ,
  "last_message": {"preview": "…", "kind": "text", "sender_role": "candidate|recruiter|system", "created_at": "…"},
  "last_message_at": "… | null",
  "last_seq": 12,
  "unread_count": 2,
  "peer_last_read_seq": 10,
  "can_send": true,
  "locked_reason": "",
  "candidate_limit_remaining": null,
  "created_at": "…"
}
```

- `counterpart`: với ứng viên là công ty (tên + logo); với NTD là ứng viên (họ tên + ảnh).
- `application`: hồ sơ hiện hành của ứng viên vào tin (null nếu hội thoại mở từ lời mời và chưa nộp).
  Ứng viên thấy trạng thái **đã công bố**; NTD thấy trạng thái thật.
- `locked_reason`: `""` (mở) · `"unavailable"` (ứng viên: bị chặn/không khả dụng — câu trung lập) ·
  `"blocked"` (NTD: ứng viên đang bị công ty chặn) · `"withdrawn"` (ứng viên đã rút hồ sơ) ·
  `"account"` (tài khoản bên kia không còn hoạt động) · `"disabled"` (admin tắt ProCV Connect).
- `candidate_limit_remaining`: chỉ với ứng viên khi NTD chưa trả lời lần nào (số tin còn được gửi), ngược lại `null`.
- `last_message.preview` của tin không phải chữ là chuỗi rỗng; giao diện tự hiển thị theo `kind`.

| Phương thức | Đường dẫn | Ghi chú |
| --- | --- | --- |
| GET | `/{portal}/conversations/?q=&page=` | Phân trang chuẩn `{count,next,previous,results}`, mới nhất trước, 20/trang |
| POST | `/candidate/conversations/` `{"job": "job_x"}` | 201 tạo mới, 200 đã có; 403 `{"detail": "…"}` khi không đủ điều kiện |
| POST | `/employer/conversations/` `{"application": "app_x"}` hoặc `{"invitation": "csi_x"}` | như trên |
| GET | `/{portal}/conversations/unread-count/` | `{"count": 3}` = số hội thoại có tin chưa đọc |
| GET | `/{portal}/conversations/{id}/` | `ConversationSerializer` |
| GET | `/{portal}/conversations/{id}/messages/?before=<seq>&after=<seq>&limit=30` | `{"results": [Message…] (seq tăng dần), "has_more": bool}`; `before` lấy trang cũ hơn, `after` bù tin |
| POST | `/{portal}/conversations/{id}/messages/` | JSON `{"client_id": uuid, "kind": "text", "body": "…"}` · `{"client_id", "kind": "job", "job": "job_x"}` (NTD) · `{"client_id", "kind": "cv", "cv": "cv_x"}` (ứng viên) · multipart `client_id`, `file` (PDF/DOCX/PNG/JPG/WEBP) → kind `file` hoặc `image`. 201 tin mới, 200 khi trùng `client_id` |
| POST | `/{portal}/conversations/{id}/read/` `{"seq": 12}` | 204 |
| GET | `/{portal}/conversations/{id}/messages/{msg}/file/?download=1` | Stream tệp/ảnh/CV tệp; `Cache-Control: private, no-store` |
| POST | `/employer/conversations/{id}/messages/{msg}/cv-export/` | CV dựng bằng trình tạo CV: yêu cầu PDF → `{"public_id","status":"pending|processing|completed|failed","download_url": str|null}` |
| GET | `/employer/conversations/{id}/messages/{msg}/cv-export/{export}/` | Trạng thái như trên |
| GET | `/candidate/conversations/applied-jobs/` | `[{"application_public_id","job":{public_id,title,slug},"company":{name,logo_url},"conversation_public_id": str|null,"can_start": bool}]` (cột phải) |
| GET | `/candidate/conversations/shareable-cvs/` | `[{"public_id","title","cv_type":"builder|uploaded"}]` |
| GET | `/employer/conversations/shareable-jobs/` | `[{"public_id","title","slug"}]` tin đang công khai của công ty |

## Tin nhắn

```json
{
  "public_id": "msg_x", "seq": 12, "client_id": "uuid | null",
  "kind": "text | job | cv | file | image | interview | system",
  "sender_role": "candidate | recruiter | system", "mine": true,
  "body": "…", "created_at": "…",
  "job": {"public_id","title","slug","salary_text","location_text","company_name","stopped": false} ,
  "cv": {"title": "…", "has_file": true, "cv_type": "builder|uploaded"},
  "file": {"name": "a.pdf", "content_type": "application/pdf", "size": 12345},
  "interview": {"public_id","starts_at","duration_minutes": 60,"mode": "onsite|online|phone",
                "location","meeting_url","note","status","candidate_note","responded_at",
                "ended": bool, "application_public_id": "app_x (chỉ NTD) | null",
                "actions": {"respond": bool, "cancel": bool, "reschedule": bool, "decide": bool}},
  "system": {"event": "started | interview_accepted | interview_declined | interview_reschedule_requested | interview_cancelled", "actor_role": "candidate|recruiter|system"}
}
```

Trường không thuộc `kind` là `null`. URL tệp/ảnh = `/{portal}/conversations/{id}/messages/{msg}/file/`.
`kind=cv` có `has_file` → mở bằng URL tệp; ngược lại NTD dùng `cv-export`.

## Lịch hẹn phỏng vấn

| Phương thức | Đường dẫn | Body |
| --- | --- | --- |
| POST | `/employer/conversations/{id}/interviews/` | `{"starts_at","duration_minutes","mode","location","meeting_url","note"}` → 201 Message (`kind=interview`) |
| POST | `/employer/interviews/{itv}/cancel/` | `{"note"?}` → 200 Message thẻ lịch hẹn đã cập nhật |
| POST | `/candidate/interviews/{itv}/respond/` | `{"action": "accept|decline|reschedule", "note"?}` → 200 |

Trạng thái: `proposed` · `accepted` · `declined` · `reschedule_requested` · `cancelled` · `superseded`.

- Gửi lịch khi hồ sơ chưa ở "Phỏng vấn" thì hồ sơ chuyển "Phỏng vấn" (lịch sử trạng thái, báo ứng
  viên ngay một thông báo trỏ vào hội thoại). Lịch mới thay lịch đang chờ/xin đổi giờ và lịch đã
  nhận chưa diễn ra.
- `actions.reschedule` (NTD): mở form đặt lịch điền sẵn từ thẻ cũ để chọn giờ mới.
- `ended`: đã qua giờ kết thúc. `actions.decide` (NTD, lịch đã nhận và đã diễn ra, hồ sơ còn
  "Phỏng vấn"): ra kết quả bằng `POST /employer/applications/{application_public_id}/status/`
  `{"status": "accepted" | "rejected"}` (cửa sổ hoàn tác như mọi quyết định).

## Realtime (socket chung `/ws/notifications/`, ADR-0028)

Server → client:

```json
{"type": "chat.message.created", "conversation": "cnv_x", "message": {Message theo góc nhìn người nhận}, "unread_count": 2}
{"type": "chat.message.updated", "conversation": "cnv_x", "message": {…}}
{"type": "chat.read", "conversation": "cnv_x", "role": "candidate|recruiter", "last_read_seq": 12}
{"type": "chat.typing", "conversation": "cnv_x", "role": "candidate|recruiter"}
```

Client → server: `{"type": "typing", "conversation": "cnv_x"}` (gửi tối đa 1 lần/3 giây khi đang gõ).

Hội thoại vừa mở mà chưa có tin nào không nằm trong danh sách và không tính chưa đọc; tin thật
đầu tiên (`chat.message.created` của một hội thoại chưa có trong danh sách) làm client tải lại danh sách.

Khi nhận `{"type": "connected"}` (socket mở lại), client tải lại danh sách hội thoại, badge và bù tin
(`after=<seq cuối>`) cho hội thoại đang mở.

## Cấu hình công khai (`useSiteSetting`)

- `connect_enabled` (bool): ẩn lối vào ProCV Connect khi tắt.
- `connect_attachment_max_mb` (số): giới hạn tệp kiểm trước ở trình duyệt.
