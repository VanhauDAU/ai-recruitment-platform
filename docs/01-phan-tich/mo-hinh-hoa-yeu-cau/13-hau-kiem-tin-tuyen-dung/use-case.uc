title Sơ đồ use case chức năng hậu kiểm tin tuyển dụng và xử lý báo cáo
system Hệ thống ProCV
actor UV left Ứng viên
actor QTV left Quản trị viên
actor NTD right Nhà tuyển dụng
usecase BCT 1 Báo cáo tin tuyển dụng
usecase BCC 1 Báo cáo công ty
usecase DS 1 Xem danh sách tin cần hậu kiểm
usecase AN 1 Ẩn tin vi phạm
usecase YC 1 Yêu cầu sửa tin
usecase KP 1 Khôi phục tin
usecase XLT 1 Xử lý báo cáo tin
usecase XLC 1 Xử lý báo cáo công ty
usecase SS 2 So sánh với bản đã đăng
usecase GL 2 Sửa và gửi lại tin
usecase HT 2 Hoàn tác xử lý báo cáo
usecase TG 2 Tạm giữ trang công ty
UV -- BCT
UV -- BCC
QTV -- DS
QTV -- AN
QTV -- YC
QTV -- KP
QTV -- XLT
QTV -- XLC
DS ..> SS : include
GL ..> YC : extend
HT ..> XLT : extend
TG ..> XLC : extend
NTD -- GL
