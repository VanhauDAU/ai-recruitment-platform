title Sơ đồ use case chức năng quản lý hồ sơ ứng tuyển
system Hệ thống ProCV
actor NTD left Nhà tuyển dụng
actor BEAT right Tác vụ định kỳ
usecase DS 1 Xem danh sách hồ sơ ứng tuyển
usecase CV 1 Xem CV ứng viên
usecase TT 1 Đổi trạng thái hồ sơ
usecase CHAN 1 Chặn ứng viên theo công ty
usecase GO 1 Gỡ chặn ứng viên
usecase TIM 1 Tìm kiếm hồ sơ ứng viên (dự kiến)
usecase XUAT 2 Xuất danh sách hồ sơ
usecase TAI 2 Tải CV ứng viên
usecase HT 2 Hoàn tác quyết định
usecase AI 2* Xếp hạng hồ sơ ứng tuyển bằng AI
usecase NH 3 Nhắc hồ sơ chờ phản hồi
usecase TU 3 Tự động từ chối hồ sơ quá hạn
usecase DSN 3* Đối sánh ngữ nghĩa CV–JD
NTD -- DS
NTD -- CV
NTD -- TT
NTD -- CHAN
NTD -- GO
NTD -- TIM
XUAT ..> DS : extend
TAI ..> CV : extend
HT ..> TT : extend
AI ..> DS : extend
AI ..> DSN : include
TIM ..> DSN : include
BEAT -- NH
BEAT -- TU
