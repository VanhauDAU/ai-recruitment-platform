title Sơ đồ use case chức năng công ty và thành viên
system Hệ thống ProCV
actor NTD left Nhà tuyển dụng
actor QL left Quản lý công ty
actor QTV right Quản trị viên
usecase TIM 1 Tìm kiếm công ty
usecase TAO 1 Tạo công ty
usecase TG 1 Gửi yêu cầu tham gia công ty
usecase CN 1 Cập nhật thông tin trang công ty
usecase DTG 1 Duyệt yêu cầu tham gia
usecase QBT 1 Cấp / thu quyền biên tập trang
usecase CQ 1 Chuyển quyền quản lý
usecase GO 1 Gỡ thành viên
usecase HUY 2 Hủy yêu cầu tham gia
usecase BG 2 Bàn giao tin và chiến dịch
usecase DCN 2 Duyệt yêu cầu cập nhật công ty
NTD -- TIM
NTD -- TAO
NTD -- TG
NTD -- CN
QL -- DTG
QL -- QBT
QL -- CQ
QL -- GO
QL -- CN
HUY ..> TG : extend
GO ..> BG : include
CN ..> DCN : include
QTV -- DCN
QTV -- DTG
