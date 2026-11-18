title Sơ đồ use case chức năng quản lý chiến dịch tuyển dụng
system Hệ thống ProCV
actor NTD left Nhà tuyển dụng
usecase TAO 1 Tạo chiến dịch
usecase SUA 1 Cập nhật chiến dịch
usecase BC 1 Xem báo cáo chiến dịch
usecase TD 1 Tạm dừng / tiếp tục chiến dịch
usecase KT 1 Kết thúc / hủy chiến dịch
usecase AH 2 Xem trước ảnh hưởng tới tin
usecase HQ 2 Thống kê hiệu quả theo tin
usecase NK 2 Xem nhật ký hoạt động
NTD -- TAO
NTD -- SUA
NTD -- BC
NTD -- TD
NTD -- KT
TD ..> AH : include
BC ..> HQ : include
NK ..> BC : extend
