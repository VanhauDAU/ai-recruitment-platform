title Sơ đồ use case chức năng quản lý hồ sơ cá nhân và nguyện vọng
system Hệ thống ProCV
actor UV left Ứng viên
actor EM right Dịch vụ email
usecase TT 1 Cập nhật thông tin cá nhân
usecase NV 1 Khai báo nguyện vọng việc làm
usecase QR 1 Quản lý quyền riêng tư
usecase TB 1 Đăng ký thông báo việc làm
usecase CE 1 Cài đặt email thông báo
usecase DG 2 Đồng ý nhận gợi ý việc làm
usecase CP 2 Cho phép NTD tìm thấy hồ sơ
usecase CV 2 Bật tìm kiếm cho từng CV
usecase GE 2 Gửi email tổng hợp việc làm
UV -- TT
UV -- NV
UV -- QR
UV -- TB
UV -- CE
DG ..> QR : extend
CP ..> QR : extend
CV ..> CP : include
TB ..> GE : include
EM -- GE
