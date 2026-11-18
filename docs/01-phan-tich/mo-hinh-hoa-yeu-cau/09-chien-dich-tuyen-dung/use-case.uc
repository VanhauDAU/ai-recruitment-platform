title Sơ đồ use case chức năng quản lý chiến dịch tuyển dụng
system Hệ thống ProCV
actor NTD left Nhà tuyển dụng
actor LL right Bộ lập lịch
actor FB right Facebook
actor UV right Ứng viên
usecase TL 1 Thiết lập chiến dịch
usecase KH 1 Kích hoạt hoặc lên lịch chiến dịch
usecase TD 1 Tạm dừng / tiếp tục chiến dịch
usecase KT 1 Kết thúc / hủy chiến dịch
usecase PP 1 Phân phối đa kênh
usecase DF 1 Đăng bài lên Fanpage
usecase SK 1 Theo dõi sức khỏe chiến dịch
usecase BC 1 Xuất báo cáo chiến dịch
usecase NK 1 Xem lịch sử hoạt động
usecase KD 2 Kiểm tra điều kiện kích hoạt
usecase AH 2 Xem trước ảnh hưởng tới tin
usecase DT 2 Đóng tin của chiến dịch
usecase LK 2 Tạo link theo dõi và mã QR
usecase AI 2 Soạn nội dung bài bằng AI
usecase CP 2 Ghi chi phí kênh
usecase KN 2 Kết nối Fanpage
usecase LH 3 Chạy chiến dịch theo lịch
usecase CB 3 Gửi cảnh báo và báo cáo tuần
usecase DB 3 Đăng bài đến hạn
usecase GN 3 Ứng tuyển qua link của kênh
NTD -- TL
NTD -- KH
NTD -- TD
NTD -- KT
NTD -- PP
NTD -- DF
NTD -- SK
NTD -- BC
NTD -- NK
LL -- LH
LL -- CB
LL -- DB
FB -- DB
UV -- GN
KH ..> KD : include
TD ..> AH : include
KT ..> DT : include
LH ..> KD : include
LH ..> DT : include
PP ..> LK : include
AI ..> PP : extend
CP ..> PP : extend
DF ..> KN : include
GN ..> LK : include
