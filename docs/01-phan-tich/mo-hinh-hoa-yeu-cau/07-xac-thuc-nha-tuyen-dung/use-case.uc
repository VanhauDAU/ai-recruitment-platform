title Sơ đồ use case chức năng xác thực tài khoản nhà tuyển dụng
system Hệ thống ProCV
actor NTD left Nhà tuyển dụng
actor SMS right Dịch vụ SMS
actor TAX right VietQR
usecase SDT 1 Xác minh số điện thoại
usecase DPA 1 Đồng ý cam kết bảo vệ dữ liệu
usecase GT 1 Nộp giấy tờ xác thực
usecase TT 1 Theo dõi trạng thái xác thực
usecase OTP 2 Nhận mã OTP qua SMS
usecase MST 2 Tra cứu mã số thuế
usecase NL 2 Nộp lại giấy tờ khi được yêu cầu sửa
usecase QUET 2 Quét virus giấy tờ tải lên
NTD -- SDT
NTD -- DPA
NTD -- GT
NTD -- TT
SDT ..> OTP : include
GT ..> MST : include
NL ..> GT : extend
QUET ..> GT : extend
SMS -- OTP
TAX -- MST
