TEN = "chức năng xác thực tài khoản nhà tuyển dụng"
MO_TA = [
    ("Xác minh số điện thoại", "Nhà tuyển dụng", "Chứng minh sở hữu số điện thoại liên hệ", "Đã đăng ký, nhập đúng mật khẩu", "Số điện thoại được đánh dấu đã xác minh"),
    ("Nhận mã OTP qua SMS", "Hệ thống, Dịch vụ SMS", "Gửi mã một lần tới số điện thoại", "Đã qua thời gian chờ gửi lại", "NTD nhận mã; nhập sai quá 5 lần bị khóa thử thách"),
    ("Đồng ý cam kết bảo vệ dữ liệu", "Nhà tuyển dụng", "Cam kết xử lý dữ liệu ứng viên đúng chính sách (DPA)", "Đang đọc đúng phiên bản chính sách", "Lần đồng ý được lưu, các tạm giữ do DPA được gỡ"),
    ("Nộp giấy tờ xác thực", "Nhà tuyển dụng", "Nộp giấy phép kinh doanh hoặc ủy quyền kèm giấy tờ tùy thân", "Đã liên kết công ty, chưa bị khóa nộp lại", "Hồ sơ xác thực chuyển chờ duyệt"),
    ("Tra cứu mã số thuế", "Hệ thống, VietQR", "Lấy tên và trạng thái doanh nghiệp để đối chiếu", "Đã nộp giấy tờ có mã số thuế", "Bằng chứng tra cứu cho quản trị viên"),
    ("Nộp lại giấy tờ khi được yêu cầu sửa", "Nhà tuyển dụng", "Thay giấy tờ bị yêu cầu sửa hoặc bị từ chối", "Hồ sơ đang ở trạng thái cần sửa, bị từ chối dưới 3 lần", "Hồ sơ chuyển chờ duyệt với số lần nộp tăng"),
    ("Quét virus giấy tờ tải lên", "Hệ thống, ClamAV", "Chặn tệp có mã độc", "Bật chế độ cách ly tệp", "Chỉ tệp sạch được lưu"),
    ("Theo dõi trạng thái xác thực", "Nhà tuyển dụng", "Biết hồ sơ đang ở bước nào và còn thiếu gì", "Đã đăng nhập cổng NTD", "Danh sách điều kiện đã đạt / còn thiếu"),
]
DONG_CHINH = [
    ("Xác minh số điện thoại", "Nhà tuyển dụng", "Nhập số điện thoại và mật khẩu >> nhận mã >> nhập mã OTP"),
    ("Xác minh số điện thoại", "Hệ thống", "Kiểm tra mật khẩu, thời gian chờ >> tạo thử thách >> gửi SMS qua worker >> kiểm tra mã >> đánh dấu đã xác minh"),
    ("Đồng ý cam kết bảo vệ dữ liệu", "Nhà tuyển dụng", "Đọc cam kết >> bấm Đồng ý"),
    ("Đồng ý cam kết bảo vệ dữ liệu", "Hệ thống", "So khớp phiên bản và mã băm tài liệu >> lưu lần đồng ý >> gỡ tạm giữ, bù thời gian hiển thị tin"),
    ("Nộp giấy tờ xác thực", "Nhà tuyển dụng", "Chọn phương thức >> tải giấy tờ lên"),
    ("Nộp giấy tờ xác thực", "Hệ thống", "Kiểm tra loại giấy tờ >> lưu tài liệu >> hồ sơ chuyển chờ duyệt >> tra cứu mã số thuế"),
    ("Theo dõi trạng thái xác thực", "Nhà tuyển dụng", "Mở trang Xác thực tài khoản"),
    ("Theo dõi trạng thái xác thực", "Hệ thống", "Trả các điều kiện: email, số điện thoại, công ty, giấy tờ, DPA, quyết định duyệt"),
]
