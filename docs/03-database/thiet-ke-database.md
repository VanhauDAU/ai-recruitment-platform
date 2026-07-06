# 03 - Database

Phạm vi:
- ERD và mô tả chi tiết từng bảng
- Quy ước thiết kế (public_id, slug, soft-delete, JSONB, status)
- Thứ tự triển khai theo giai đoạn (mục 7 tài liệu database v1.4)

Nguồn: database_hoan_chinh_ai_recruitment_cv_builder v1.4.

## Bảng đã triển khai

| Bảng | App Django | Ghi chú |
|---|---|---|
| `users` | `backend/accounts` | Custom User kế thừa AbstractUser, role candidate/employer/admin |
| `skills` | `backend/skills` | Nguồn kỹ năng chuẩn duy nhất, seed 34 kỹ năng qua `seed_skills` |
| `candidate_profiles` | `backend/candidates` | Tự tạo rỗng khi candidate đăng ký (signal) |
| `employer_profiles` | `backend/employers` | Tạo qua API riêng (bắt buộc `company_name`) |

Trạng thái đầy đủ theo từng giai đoạn: xem [../TIEN-DO-DU-AN.md](../TIEN-DO-DU-AN.md).
