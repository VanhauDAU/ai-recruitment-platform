title Sơ đồ use case chức năng nhắn tin ProCV Connect
system Hệ thống ProCV
actor ND left Người dùng\n(UV, NTD)
actor UV left Ứng viên
actor NTD right Nhà tuyển dụng
actor BEAT right Tác vụ định kỳ
usecase MO 1 Mở cuộc trò chuyện
usecase GUI 1 Gửi và nhận tin nhắn
usecase DOC 1 Xem lịch sử và đánh dấu đã đọc
usecase PH 1 Phản hồi lịch hẹn
usecase EMO 2 Gửi emoji
usecase CV 2 Gửi CV
usecase TIN 2 Gửi tin tuyển dụng
usecase TEP 2 Gửi tệp đính kèm
usecase DL 2 Đề nghị đổi giờ hẹn
usecase LH 3 Hẹn lịch phỏng vấn
usecase NHAC 3 Nhắc tin chưa đọc qua email
usecase NLH 3 Nhắc lịch hẹn sắp tới
ND -- MO
ND -- GUI
ND -- DOC
UV -- PH
NTD -- LH
EMO ..> GUI : extend
CV ..> GUI : extend
TIN ..> GUI : extend
TEP ..> GUI : extend
DL ..> PH : extend
BEAT -- NHAC
BEAT -- NLH
