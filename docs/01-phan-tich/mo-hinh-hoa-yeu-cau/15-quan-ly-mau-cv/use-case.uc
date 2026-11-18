title Sơ đồ use case chức năng quản lý mẫu CV
system Hệ thống ProCV
actor QTV left Quản trị viên
actor GM right Google Gemini
usecase TAO 1 Tạo mẫu CV
usecase CH 1 Cấu hình phiên bản mẫu
usecase XB 1 Xuất bản phiên bản
usecase ND 1 Ngừng dùng phiên bản
usecase AH 1 Ẩn / hiện mẫu
usecase NB 1 Nhân bản mẫu
usecase NDM 1 Quản lý nội dung CV mẫu
usecase PDF 2 Xuất PDF thử
usecase KT 2 Kiểm tra danh sách điều kiện
usecase AI 2 Sinh nội dung mẫu bằng AI
QTV -- TAO
QTV -- CH
QTV -- XB
QTV -- ND
QTV -- AH
QTV -- NB
QTV -- NDM
XB ..> KT : include
KT ..> PDF : include
AI ..> NDM : extend
GM -- AI
