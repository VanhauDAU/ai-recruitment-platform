title Sơ đồ use case chức năng quản lý CV
system Hệ thống ProCV
actor UV left Ứng viên
actor AI right Dịch vụ AI ngoài
actor AV right ClamAV
actor NX right Người xem liên kết
usecase TAO 1 Tạo CV từ mẫu
usecase SUA 1 Chỉnh sửa và lưu CV
usecase PDF 1 Tải CV dạng PDF
usecase CS 1 Chia sẻ CV bằng liên kết
usecase TL 1 Tải CV lên
usecase XOA 1 Xóa CV
usecase MAU 2 Chọn mẫu CV
usecase NHAP 2 Nhập CV từ tệp PDF/DOCX
usecase QUET 2 Quét virus tệp tải lên
usecase XEM 2 Xem CV qua liên kết
usecase CTRUC 3 Cấu trúc nội dung CV bằng AI
UV -- TAO
UV -- SUA
UV -- PDF
UV -- CS
UV -- TL
UV -- XOA
TAO ..> MAU : include
NHAP ..> TAO : extend
NHAP ..> QUET : include
TL ..> QUET : include
NHAP ..> CTRUC : include
AI -- CTRUC
AV -- QUET
NX -- XEM
