# Lưu trữ

Thư mục này giữ tài liệu **đã hết vai trò nguồn sự thật**. Chúng được giữ lại làm
dẫn chứng quá trình (kế hoạch đã thực hiện, audit theo thời điểm, biên bản quyết
định) và không được cập nhật theo code. Muốn biết hệ thống đang chạy thế nào, đọc
tài liệu trong các thư mục đánh số và [ADR](../adr/README.md).

| Thư mục | Nội dung | Nguồn hiện hành |
| --- | --- | --- |
| [ke-hoach/](ke-hoach/) | Kế hoạch đã triển khai xong: cấu hình hệ thống, CV template v3, quản lý danh mục, trang công ty, chuẩn bị deploy | ADR tương ứng, đặc tả `01-phan-tich/`, [go-live](../06-deployment/go-live.md) |
| [audit/](audit/) | Audit luồng nghiệp vụ (07/2026) và bảo mật cổng NTD (08/2026) | Đặc tả và [tổng quan hệ thống](../02-tong-quan/tong-quan-he-thong.md) |
| [decision-log/](decision-log/) | Biên bản quyết định của đợt hardening NTD và chatbot local | [ADR](../adr/README.md), đặc tả |
| [snapshot/](snapshot/) | Bản đồ URL tại thời điểm 11/2026 | [Tài liệu API](../04-api/tai-lieu-api.md), [`openapi.yaml`](../04-api/openapi.yaml) |

Thêm vào đây khi một tài liệu kế hoạch hoặc audit đã xong việc: `git mv` vào thư
mục con phù hợp, giữ nguyên nội dung, cập nhật bảng trên. Không xóa, vì báo cáo
đồ án có thể dẫn chiếu.
