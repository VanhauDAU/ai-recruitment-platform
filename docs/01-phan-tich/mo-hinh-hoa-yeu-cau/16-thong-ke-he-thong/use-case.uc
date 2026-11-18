title Sơ đồ use case chức năng xem thống kê
system Hệ thống ProCV
actor QTV left Quản trị viên
actor NTD left Nhà tuyển dụng
usecase TK 1 Xem thống kê hệ thống
usecase HC 1 Xem hàng chờ cần xử lý
usecase TQ 1 Xem tổng quan tuyển dụng
usecase KY 2 Chọn kỳ thống kê
usecase CT 2 Chuyển tới màn hình xử lý
QTV -- TK
QTV -- HC
NTD -- TQ
KY ..> TK : extend
CT ..> HC : extend
