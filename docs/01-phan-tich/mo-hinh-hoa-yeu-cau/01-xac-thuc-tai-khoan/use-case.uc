title Sơ đồ use case chức năng xác thực và tài khoản
system Hệ thống ProCV
actor K left Khách
actor ND left Người dùng
actor GG right Google
actor EM right Dịch vụ email
usecase DKUV 1 Đăng ký tài khoản ứng viên
usecase DKNTD 1 Đăng ký tài khoản nhà tuyển dụng
usecase DN 1 Đăng nhập
usecase KP 1 Khôi phục mật khẩu
usecase DX 1 Đăng xuất
usecase QLP 1 Quản lý phiên đăng nhập
usecase DMK 1 Đổi mật khẩu
usecase XME 2 Xác minh email
usecase CAP 2 Kiểm tra reCAPTCHA
usecase GGL 2 Đăng nhập bằng Google
usecase LM 2 Làm mới phiên đăng nhập
usecase XTL 2 Xác thực lại bằng Google
K -- DKUV
K -- DKNTD
K -- DN
K -- KP
ND -- DX
ND -- QLP
ND -- DMK
DKUV ..> XME : include
DKNTD ..> XME : include
DKUV ..> CAP : include
DKNTD ..> CAP : include
DN ..> CAP : include
KP ..> CAP : include
GGL ..> DN : extend
LM ..> DN : extend
XTL ..> DMK : extend
GG -- GGL
GG -- CAP
EM -- XME
GG -- XTL
