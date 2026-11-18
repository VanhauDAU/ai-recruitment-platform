title Sơ đồ use case chức năng quản lý tin tuyển dụng
system Hệ thống ProCV
actor NTD left Nhà tuyển dụng
actor GM right Google Gemini
usecase NHAP 1 Lưu nháp tin
usecase DANG 1 Đăng tin tuyển dụng
usecase SUA 1 Chỉnh sửa tin
usecase NB 1 Nhân bản tin
usecase GH 1 Gia hạn hạn nộp
usecase DUNG 1 Dừng tuyển
usecase MO 1 Mở lại tin
usecase GL 1 Sửa và gửi lại tin bị yêu cầu sửa
usecase AI 2 Tạo nội dung tin bằng AI
usecase DK 2 Kiểm tra điều kiện đăng tin
usecase CK 2 Xác nhận cam kết trách nhiệm
NTD -- NHAP
NTD -- DANG
NTD -- SUA
NTD -- NB
NTD -- GH
NTD -- DUNG
NTD -- MO
NTD -- GL
AI ..> NHAP : extend
DANG ..> DK : include
DANG ..> CK : include
MO ..> DK : include
MO ..> CK : include
GM -- AI
