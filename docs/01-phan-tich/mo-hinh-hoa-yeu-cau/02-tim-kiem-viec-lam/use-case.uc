title Sơ đồ use case chức năng tìm kiếm việc làm và xem công ty
system Hệ thống ProCV
actor K left Khách
actor UV left Ứng viên
usecase TK 1 Tìm kiếm việc làm
usecase CT 1 Xem chi tiết việc làm
usecase SS 1 So sánh việc làm
usecase TC 1 Xem trang công ty
usecase LT 1 Lưu việc làm
usecase TD 1 Theo dõi công ty
usecase LOC 2 Lọc và sắp xếp kết quả
usecase GY 2 Gợi ý từ khóa khi gõ
usecase LX 2 Ghi nhận lượt xem
usecase BC 2 Báo cáo tin tuyển dụng
K -- TK
K -- CT
K -- SS
K -- TC
UV -- TK
UV -- CT
UV -- LT
UV -- TD
UV -- TC
LOC ..> TK : extend
TK ..> GY : include
LX ..> CT : extend
BC ..> CT : extend
