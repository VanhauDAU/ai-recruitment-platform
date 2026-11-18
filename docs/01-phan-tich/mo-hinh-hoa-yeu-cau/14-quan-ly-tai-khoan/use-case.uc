title Sơ đồ use case chức năng quản lý tài khoản
system Hệ thống ProCV
actor QTV left Quản trị viên
actor ND right Người dùng bị xử lý
usecase TIM 1 Tìm kiếm và xem tài khoản
usecase KHOA 1 Tạm khóa tài khoản
usecase CAM 1 Cấm tài khoản
usecase MO 1 Mở lại tài khoản
usecase PHIEN 1 Thu hồi phiên đăng nhập
usecase GUI 1 Gửi lại email xác minh / đặt lại mật khẩu
usecase AH 2 Xem trước ảnh hưởng
usecase GTG 2 Gỡ tạm giữ tài nguyên
usecase TB 2 Gửi email thông báo trạng thái
QTV -- TIM
QTV -- KHOA
QTV -- CAM
QTV -- MO
QTV -- PHIEN
QTV -- GUI
KHOA ..> AH : include
CAM ..> AH : include
MO ..> AH : include
GTG ..> MO : extend
KHOA ..> TB : include
CAM ..> TB : include
ND -- TB
