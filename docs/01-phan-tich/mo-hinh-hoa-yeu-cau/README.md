# Mô hình hóa yêu cầu (mục 3.2 báo cáo ĐATN)

Bộ sơ đồ và bảng cho mục 3.2 của báo cáo, theo khung báo cáo mẫu: mỗi nhóm chức năng có
sơ đồ use case, bảng mô tả use case, bảng dòng chính, sơ đồ tuần tự và sơ đồ hoạt động.
Mọi hình là PNG nền trắng, nét đen. Luồng được đối chiếu với mã nguồn; chức năng ghi
“dự kiến” thuộc phạm vi đồ án nhưng chưa làm.

## Cấu trúc thư mục

```text
mo-hinh-hoa-yeu-cau/
  00-use-case-tong-quat/    sơ đồ use case tổng quát (lấy từ ../so-do-use-case.png, chuyển trắng đen)
  NN-ten-nhom/              một nhóm chức năng = một mục 3.2.NN
    use-case.uc             nguồn sơ đồ use case của nhóm
    noi_dung.py             bảng mô tả use case (MO_TA) và bảng dòng chính (DONG_CHINH)
    tuan-tu/*.seq           nguồn sơ đồ tuần tự, mỗi chức năng một tệp
    hoat-dong/*.act         nguồn sơ đồ hoạt động, cùng tên với sơ đồ tuần tự
    hinh/                   ảnh PNG sinh tự động (không đưa vào git)
  cong-cu/                  bộ vẽ (ucdraw, seqdraw, actdraw, bw) và script dựng Word
  Mo-hinh-hoa-yeu-cau.docx  file Word tổng hợp (sinh tự động, không đưa vào git)
```

## Danh sách nhóm

| Thư mục | Nhóm chức năng | Use case | Sơ đồ tuần tự | Sơ đồ hoạt động |
| --- | --- | --- | --- | --- |
| `01-xac-thuc-tai-khoan/` | Chức năng xác thực và tài khoản | 12 | 7 | 7 |
| `02-tim-kiem-viec-lam/` | Chức năng tìm kiếm việc làm và xem công ty | 10 | 1 | 1 |
| `03-ho-so-ca-nhan/` | Chức năng quản lý hồ sơ cá nhân và nguyện vọng việc làm | 9 | 1 | 1 |
| `04-quan-ly-cv/` | Chức năng quản lý CV | 11 | 3 | 3 |
| `05-ung-tuyen/` | Chức năng ứng tuyển và theo dõi hồ sơ | 8 | 2 | 2 |
| `06-doi-sanh-va-goi-y/` | Chức năng đối sánh CV–JD và gợi ý việc làm | 7 | 4 | 4 |
| `07-xac-thuc-nha-tuyen-dung/` | Chức năng xác thực tài khoản nhà tuyển dụng | 8 | 1 | 1 |
| `08-cong-ty-va-thanh-vien/` | Chức năng công ty và thành viên | 11 | 3 | 3 |
| `09-chien-dich-tuyen-dung/` | Chức năng quản lý chiến dịch tuyển dụng | 20 | 5 | 5 |
| `10-tin-tuyen-dung/` | Chức năng quản lý tin tuyển dụng | 11 | 3 | 3 |
| `11-ho-so-ung-tuyen/` | Chức năng quản lý hồ sơ ứng tuyển | 13 | 5 | 5 |
| `12-duyet-xac-thuc-va-doanh-nghiep/` | Chức năng duyệt xác thực và quản lý doanh nghiệp | 11 | 2 | 2 |
| `13-hau-kiem-tin-tuyen-dung/` | Chức năng hậu kiểm tin tuyển dụng và xử lý báo cáo | 12 | 2 | 2 |
| `14-quan-ly-tai-khoan/` | Chức năng quản lý tài khoản | 9 | 1 | 1 |
| `15-quan-ly-mau-cv/` | Chức năng quản lý mẫu CV | 10 | 1 | 1 |
| `16-thong-ke-he-thong/` | Chức năng xem thống kê | 5 | 1 | 1 |
| `17-procv-connect/` | Chức năng nhắn tin ProCV Connect | 12 | 5 | 5 |

## Dựng lại hình và file Word

Cần macOS có `swiftc` (Xcode Command Line Tools) và `python-docx` (có sẵn trong `ml/.venv`).
Chạy từ thư mục gốc repo:

```bash
sh docs/01-phan-tich/mo-hinh-hoa-yeu-cau/cong-cu/build.sh
```

Mở file Word, chọn Yes khi Word hỏi cập nhật trường để điền mục lục, danh mục bảng và hình.
Khi chép sang báo cáo, chọn toàn bộ rồi nhấn F9 để Word đánh lại số hình và bảng.

Cú pháp từng loại tệp nguồn ghi ở phần chú thích đầu mỗi bộ vẽ trong `cong-cu/`.
