title Sơ đồ use case chức năng đối sánh CV–JD và gợi ý việc làm
system Hệ thống ProCV
actor UV left Ứng viên
actor BEAT right Tác vụ định kỳ
usecase PT 1* Phân tích mức độ phù hợp CV–JD
usecase GY 1 Xem việc làm gợi ý
usecase AN 1 Ẩn tin gợi ý không quan tâm
usecase CCV 2 Chọn CV để phân tích
usecase DS 2* Đối sánh ngữ nghĩa CV–JD
usecase VEC 3* Trích hồ sơ và tính vector CV, tin
usecase PH 3 Phục hồi phân tích bị treo
UV -- PT
UV -- GY
UV -- AN
PT ..> CCV : include
PT ..> DS : include
GY ..> DS : include
DS ..> VEC : include
BEAT -- PH
