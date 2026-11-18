title Sơ đồ use case chức năng ứng tuyển và theo dõi hồ sơ
system Hệ thống ProCV
actor UV left Ứng viên
actor NTD right Nhà tuyển dụng
usecase UT 1 Ứng tuyển việc làm
usecase TD 1 Theo dõi hồ sơ ứng tuyển
usecase RUT 1 Rút hồ sơ ứng tuyển
usecase NHAC 1 Nhắc nhà tuyển dụng phản hồi
usecase CCV 2 Chọn CV ứng tuyển
usecase TCV 2 Tải CV mới khi ứng tuyển
usecase NL 2 Nộp lại hồ sơ
usecase TBM 2 Thông báo hồ sơ mới cho NTD
UV -- UT
UV -- TD
UV -- RUT
UV -- NHAC
UT ..> CCV : include
TCV ..> CCV : extend
NL ..> UT : extend
UT ..> TBM : include
NTD -- TBM
NTD -- NHAC
