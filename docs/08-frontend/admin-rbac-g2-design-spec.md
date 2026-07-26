# RBAC Admin G2 — UI/UX design specification

## Phạm vi và nguyên tắc

Trang `/admin/app/access-control` là công cụ vận hành nội bộ cho superuser và
admin có `admin_access.view`. Thiết kế giữ nguyên Ant Design 6, Tailwind, Inter,
brand token từ `ConfigProvider` và cấu trúc sidebar hiện tại. Permission contract
và phạm vi G3 không thay đổi; contract membership được cập nhật thành một chức
danh hiệu lực cho mỗi nhân viên.

UI/UX Pro Max được chạy với hướng `enterprise admin user access reassignment
single role permission management`, density 7. Các khuyến nghị phù hợp
được áp dụng: bố cục dashboard dày vừa phải, tương phản rõ, focus keyboard,
touch target tối thiểu 44px, chuyển động nhẹ 150–250ms và không dùng màu làm tín
hiệu duy nhất.

## Ba concept đã cân nhắc

1. **Operational Console — chọn**
   - Một tiêu đề ngắn, ba tab ổn định, toolbar theo ngữ cảnh và bảng dữ liệu.
   - Mỗi thao tác nguy hiểm mở impact modal có số liệu, diff và đường phục hồi.
   - Khớp nhất với admin portal hiện tại và tối ưu cho tác vụ lặp lại.
2. **Directory Split View**
   - Danh sách bên trái, chi tiết bên phải; phù hợp màn hình lớn nhưng gây nested
     scroll và khó dùng trên mobile/tablet.
3. **Card Command Center**
   - Nhiều summary card và action card; dễ tiếp cận nhưng mật độ thấp, khó quét
     hàng chục role/membership và làm bundle/UI phức tạp hơn cần thiết.

Concept 1 được chọn. Hai concept còn lại không tạo deviation khỏi design system.

## Information architecture

```text
Phân quyền quản trị
├── Phòng ban
│   ├── Danh sách + trạng thái + số chức danh/nhân viên
│   ├── Tạo / sửa
│   ├── Đổi trạng thái qua impact modal
│   └── Khôi phục mặc định qua impact modal
├── Chức danh
│   ├── Bộ lọc phòng ban
│   ├── Danh sách + quyền + số nhân viên
│   ├── Tạo / sửa
│   ├── Sửa quyền qua permission picker + impact modal
│   ├── Đổi trạng thái qua impact modal
│   └── Khôi phục mặc định qua impact modal
└── Nhân viên (chỉ superuser)
    ├── Tìm tài khoản admin theo email
    ├── Gán hoặc đổi một chức danh qua assignment impact modal
    ├── Danh sách một chức danh hiệu lực/người + MFA
    ├── Thu hồi qua impact modal
    └── Xem quyền được thêm/mất trước khi xác nhận
```

## Wireframe

### Desktop ≥ 1024px

```text
┌ Phân quyền quản trị ───────────────────────────────────────────────┐
│ Quản lý cơ cấu, quyền và membership. Mọi thay đổi được ghi audit. │
├ [Phòng ban] [Chức danh] [Nhân viên] ──────────────────────────────┤
│ [Bộ lọc/tìm kiếm........................]        [Thêm ...]        │
│ ┌ Tên/Mã ┬ Trạng thái ┬ Quản lý ┬ Số liệu ┬ Thao tác ─────────┐  │
│ │ ...    │ ...        │ ...     │ ...     │ [Sửa] [Thêm]     │  │
│ └──────────────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────────────┘
```

### Tablet 768–1023px

- Toolbar wrap thành hai hàng; CTA vẫn ở cuối theo thứ tự đọc.
- Cột mô tả dài được ẩn, thông tin trạng thái/quản lý giữ lại.
- Table có vùng cuộn ngang riêng, không làm document tràn ngang.
- Modal rộng tối đa `calc(100vw - 32px)`.

### Mobile 375–767px

```text
┌ Phân quyền quản trị ─────────────┐
│ [Phòng ban][Chức danh][Nhân viên]│
│ [Tìm kiếm / bộ lọc.............] │
│ [Thêm ...                       ] │
│ ┌ Tên + mã                       │
│ │ badge trạng thái · badge nguồn │
│ │ số liệu                        │
│ │ [Sửa] [Thao tác khác]          │
│ └─────────────────────────────────│
└───────────────────────────────────┘
```

Table được giữ về mặt semantic nhưng cho phép cuộn ngang có chủ đích; action
wrap và nút chính full-width. Không tạo fixed width làm tràn viewport.

## Component hierarchy

```text
AccessControlPage
├── PageHeader
├── Tabs
│   ├── DepartmentsPanel
│   │   ├── ResourceToolbar
│   │   ├── ResourceTable
│   │   └── DepartmentEditorModal
│   ├── RolesPanel
│   │   ├── ResourceToolbar
│   │   ├── ResourceTable
│   │   ├── RoleEditorModal
│   │   └── PermissionPicker
│   └── MembershipsPanel
│       ├── StaffSearch
│       ├── ResourceTable
│       └── AssignmentForm
└── ImpactModal
    ├── ImpactSummary
    ├── PermissionDiff
    ├── AffectedUsersPreview
    └── StalePreviewAlert
```

Domain HTTP contract và picker thuộc `entities/admin-access`; orchestration của
trang/modal chỉ dùng ở route này nên đặt cạnh page.

## Trạng thái bắt buộc

| Bề mặt | Loading | Empty | Error | Disabled |
| --- | --- | --- | --- | --- |
| Phòng ban | Table skeleton/spinner có chiều cao ổn định | Giải thích chưa có phòng ban + CTA tạo cho superuser | Alert có nút tải lại | Nút ghi không render cho non-superuser |
| Chức danh | Loading theo tab/filter | Giải thích bộ lọc hiện không có chức danh | Alert có nút tải lại | CTA bị khoá nếu chưa chọn phòng ban |
| Nhân viên | Table/search loading độc lập | Hướng dẫn tạo admin bằng command rồi gán | Alert có nút tải lại | Không render toàn tab cho non-superuser |
| Form | `confirmLoading`, chặn submit lặp | Không áp dụng | Lỗi field ở cạnh input; lỗi chung bằng toast | Semantic `disabled`, không chỉ giảm opacity |
| Impact modal | Skeleton trong body, OK disabled | “Không có thay đổi hiệu dụng” nhưng vẫn mô tả thao tác | Alert + nút tải lại preview | `can_apply=false` khoá OK và hiện `blocking_reason` |

## Modal impact cho thao tác nguy hiểm

Mọi modal có tiêu đề nêu rõ đối tượng, câu tóm tắt hành động, số người bị ảnh
hưởng, tối đa 20 tài khoản preview, trạng thái `has_more`, cảnh báo MFA, và diff
permission/metadata khi có. Khi đổi chức danh, modal khoá sẵn nhân viên, nêu rõ
chức danh hiện tại và quyền được thêm/mất. Nút xác nhận dùng nhãn hành động cụ
thể (`Khoá phòng ban`, `Xác nhận thay đổi`, `Lưu thay đổi quyền`), không dùng
“OK”.

Khi API trả `409 admin_resource_changed`, modal giữ mở, tải lại impact, thay
token và hiển thị alert “Dữ liệu đã thay đổi, vui lòng xem lại”; không tự gửi
lại action. Mọi thay đổi payload đóng preview cũ và buộc tạo preview mới.

## Accessibility checklist

- Heading theo thứ tự `h1` → section title; tab có tên rõ.
- Form có label thật, helper/error ở gần field; focus lỗi đầu tiên do Ant Form.
- Icon-only action phải có `aria-label`; ưu tiên nút có text.
- Focus ring mặc định của Ant Design không bị xoá; thứ tự tab theo thứ tự nhìn.
- Trạng thái luôn gồm text/icon/badge, không chỉ khác màu.
- Nút và input cao tối thiểu 44px ở mobile; khoảng cách thao tác ≥ 8px.
- Modal có cancel/close rõ, Escape hoạt động, focus được trả về trigger.
- Loading/error/success thông báo qua semantic Alert/toast; không chiếm focus.
- Chuyển động chỉ dùng opacity/transform 150–250ms và tôn trọng
  `prefers-reduced-motion`.
- Kiểm tra 375px, 768px, 1024px, 1440px; light/dark contrast được kiểm độc lập.
