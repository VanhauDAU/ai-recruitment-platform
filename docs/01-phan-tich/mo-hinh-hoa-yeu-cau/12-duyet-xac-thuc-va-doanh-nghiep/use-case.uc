title Sơ đồ use case chức năng duyệt xác thực và quản lý doanh nghiệp
system Hệ thống ProCV
actor QTV left Quản trị viên
actor NTD right Nhà tuyển dụng
usecase HC 1 Xem hàng chờ xác thực
usecase DGT 1 Duyệt giấy tờ xác thực
usecase QD 1 Ra quyết định xác thực
usecase TH 1 Thu hồi / cho hết hạn xác thực
usecase MK 1 Mở khóa nộp lại hồ sơ
usecase DTG 1 Duyệt yêu cầu tham gia thay quản lý
usecase CD 1 Chỉ định quản lý công ty
usecase TG 1 Tạm giữ / gỡ tạm giữ trang công ty
usecase AH 2 Xem trước ảnh hưởng quyết định
usecase MST 2 Tra cứu lại mã số thuế
usecase TB 2 Thông báo kết quả cho NTD
QTV -- HC
QTV -- DGT
QTV -- QD
QTV -- TH
QTV -- MK
QTV -- DTG
QTV -- CD
QTV -- TG
QD ..> AH : include
TH ..> AH : include
MST ..> DGT : extend
QD ..> TB : include
NTD -- TB
