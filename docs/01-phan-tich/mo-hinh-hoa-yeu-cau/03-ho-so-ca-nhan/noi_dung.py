TEN = "chức năng quản lý hồ sơ cá nhân và nguyện vọng việc làm"
MO_TA = [
    ("Cập nhật thông tin cá nhân", "Ứng viên", "Sửa họ tên, số điện thoại, ảnh đại diện, thông tin hồ sơ", "Đã đăng nhập ứng viên", "Thông tin mới được lưu"),
    ("Khai báo nguyện vọng việc làm", "Ứng viên", "Chọn chuyên môn, vị trí, tỉnh/thành, kỹ năng mong muốn", "Đã đăng nhập ứng viên", "Nguyện vọng được thay mới trong một giao dịch"),
    ("Quản lý quyền riêng tư", "Ứng viên", "Bật/tắt các quyền đồng ý xử lý dữ liệu", "Đã đăng nhập ứng viên", "Trạng thái đồng ý và lịch sử thay đổi được lưu"),
    ("Đồng ý nhận gợi ý việc làm", "Ứng viên", "Cho phép hệ thống dùng hồ sơ để gợi ý việc làm", "Đã khai báo nguyện vọng", "Mục Việc làm phù hợp hiển thị gợi ý"),
    ("Cho phép NTD tìm thấy hồ sơ", "Ứng viên", "Cho phép NTD tìm thấy hồ sơ khi tìm ứng viên", "Đã đọc và xác nhận chính sách", "Đồng ý được lưu; khi tắt, mọi CV bị gỡ khỏi tìm kiếm"),
    ("Bật tìm kiếm cho từng CV", "Ứng viên", "Chọn CV nào được NTD tìm thấy", "Đã đồng ý cho NTD tìm thấy hồ sơ", "CV có cờ recruiter_searchable"),
    ("Đăng ký thông báo việc làm", "Ứng viên", "Nhận email khi có tin mới khớp tiêu chí", "Email đã xác minh, dưới 5 thông báo", "JobAlert được tạo với tần suất ngày hoặc tuần"),
    ("Gửi email tổng hợp việc làm", "Hệ thống, Dịch vụ email", "Định kỳ chọn tin mới phù hợp và gửi email", "Có thông báo việc làm tới hạn", "Ứng viên nhận email tổng hợp"),
    ("Cài đặt email thông báo", "Ứng viên", "Chọn loại email muốn nhận (kết quả ứng tuyển, NTD xem CV...)", "Đã đăng nhập ứng viên", "Tùy chọn email được lưu"),
]
DONG_CHINH = [
    ("Cập nhật thông tin cá nhân", "Ứng viên", "Mở Thông tin cá nhân >> sửa thông tin >> bấm Lưu"),
    ("Cập nhật thông tin cá nhân", "Hệ thống", "Kiểm tra dữ liệu >> cập nhật User và CandidateProfile"),
    ("Khai báo nguyện vọng việc làm", "Ứng viên", "Chọn tối đa 5 chuyên môn, vị trí, tỉnh/thành, kỹ năng >> bật/tắt các quyền >> Lưu"),
    ("Khai báo nguyện vọng việc làm", "Hệ thống", "Kiểm tra danh mục >> thay toàn bộ nguyện vọng >> lưu đồng ý và lịch sử"),
    ("Cho phép NTD tìm thấy hồ sơ", "Ứng viên", "Bật quyền >> đọc và xác nhận chính sách"),
    ("Cho phép NTD tìm thấy hồ sơ", "Hệ thống", "Lưu đồng ý kèm phiên bản chính sách >> khi tắt: gỡ mọi CV khỏi tìm kiếm"),
    ("Bật tìm kiếm cho từng CV", "Ứng viên", "Bật Cho NTD tìm thấy CV này"),
    ("Bật tìm kiếm cho từng CV", "Hệ thống", "Kiểm tra đồng ý (thiếu thì 409) >> cập nhật cờ của CV"),
    ("Đăng ký thông báo việc làm", "Ứng viên", "Nhập từ khóa, địa điểm, tần suất >> Lưu"),
    ("Đăng ký thông báo việc làm", "Hệ thống", "Kiểm tra email đã xác minh, giới hạn 5, trùng lặp >> tạo JobAlert"),
    ("Gửi email tổng hợp việc làm", "Hệ thống", "Mỗi 5 phút lấy thông báo tới hạn >> chọn tin mới phù hợp >> gửi email"),
]
