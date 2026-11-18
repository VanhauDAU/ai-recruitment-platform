TEN = "chức năng ứng tuyển và theo dõi hồ sơ"
MO_TA = [
    ("Ứng tuyển việc làm", "Ứng viên", "Nộp hồ sơ vào một tin", "Đăng nhập ứng viên, email đã xác minh, tin còn nhận hồ sơ, không bị công ty chặn", "Hồ sơ ở trạng thái Đã nộp, NTD được thông báo"),
    ("Chọn CV ứng tuyển", "Ứng viên", "Chọn CV online đã lưu hoặc CV dạng tệp", "Có ít nhất một CV đã lưu", "Bản chụp CV được tạo, không đổi theo các lần sửa sau"),
    ("Tải CV mới khi ứng tuyển", "Ứng viên", "Tải tệp CV ngay trong hộp thoại ứng tuyển", "Tệp PDF/DOCX ≤ 5 MB", "CV dạng tệp mới được dùng để nộp"),
    ("Nộp lại hồ sơ", "Ứng viên", "Nộp lại vào cùng tin sau khi bị từ chối hoặc đã rút", "Chưa quá 3 lần nộp, đã qua 5 phút từ lần nộp trước", "Hồ sơ mới thành hồ sơ hiện hành"),
    ("Thông báo hồ sơ mới cho NTD", "Hệ thống, Nhà tuyển dụng", "Báo NTD có hồ sơ mới", "Hồ sơ vừa được nộp", "Thông báo trong ứng dụng và email tới email liên hệ của tin"),
    ("Theo dõi hồ sơ ứng tuyển", "Ứng viên", "Xem trạng thái đã công bố và dòng thời gian hồ sơ", "Đã nộp ít nhất một hồ sơ", "Danh sách hồ sơ và thao tác hợp lệ"),
    ("Rút hồ sơ ứng tuyển", "Ứng viên", "Rút hồ sơ chưa có kết quả", "Hồ sơ hiện hành chưa có kết quả được công bố", "Hồ sơ ở trạng thái Đã rút; quyết định chưa công bố bị hủy"),
    ("Nhắc nhà tuyển dụng phản hồi", "Ứng viên, Nhà tuyển dụng", "Nhắc NTD xem hồ sơ chờ lâu", "Hồ sơ chưa được phản hồi, đã qua 3 ngày, tối đa 2 lần", "NTD nhận thông báo trong ứng dụng"),
]
DONG_CHINH = [
    ("Ứng tuyển việc làm", "Ứng viên", "Bấm Ứng tuyển >> chọn CV, điền liên hệ, thư giới thiệu >> đồng ý xử lý dữ liệu >> Nộp"),
    ("Ứng tuyển việc làm", "Hệ thống", "Kiểm tra dữ liệu và luật nộp lại >> kiểm tra chặn >> tạo bản chụp CV >> tạo hồ sơ >> thông báo NTD"),
    ("Tải CV mới khi ứng tuyển", "Ứng viên", "Chọn Tải CV từ máy >> chọn tệp"),
    ("Tải CV mới khi ứng tuyển", "Hệ thống", "Lưu CV dạng tệp >> dùng làm CV nộp"),
    ("Nộp lại hồ sơ", "Ứng viên", "Bấm Ứng tuyển lại trên tin"),
    ("Nộp lại hồ sơ", "Hệ thống", "Kiểm tra số lần nộp và thời gian chờ >> hạ hồ sơ cũ >> tạo hồ sơ mới"),
    ("Theo dõi hồ sơ ứng tuyển", "Ứng viên", "Mở Việc làm đã ứng tuyển"),
    ("Theo dõi hồ sơ ứng tuyển", "Hệ thống", "Tính trạng thái ứng viên được thấy >> trả dòng thời gian và thao tác hợp lệ"),
    ("Rút hồ sơ ứng tuyển", "Ứng viên", "Bấm Rút hồ sơ >> xác nhận"),
    ("Rút hồ sơ ứng tuyển", "Hệ thống", "Kiểm tra chưa có kết quả >> hủy quyết định chưa công bố >> chuyển Đã rút >> báo NTD"),
    ("Nhắc nhà tuyển dụng phản hồi", "Ứng viên", "Bấm Nhắc NTD"),
    ("Nhắc nhà tuyển dụng phản hồi", "Hệ thống", "Kiểm tra thời điểm và số lần nhắc >> ghi lượt nhắc >> thông báo người đăng tin"),
]
