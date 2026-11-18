TEN = "chức năng quản lý mẫu CV"
MO_TA = [
    ("Tạo mẫu CV", "Quản trị viên", "Thêm mẫu CV mới", "Đăng nhập cổng quản trị", "Mẫu nháp kèm phiên bản nháp"),
    ("Cấu hình phiên bản mẫu", "Quản trị viên", "Thiết lập bố cục, mục, màu, phông chữ theo từng bước", "Phiên bản đang ở trạng thái nháp", "Cấu hình được lưu"),
    ("Xuất PDF thử", "Quản trị viên", "Kiểm tra mẫu khi in ra PDF", "Có cấu hình phiên bản", "Tệp PDF thử do worker kết xuất"),
    ("Kiểm tra danh sách điều kiện", "Hệ thống", "Đảm bảo mẫu đủ tên, màu, mục bắt buộc, đã xuất PDF thử", "Quản trị viên chọn xuất bản", "Danh sách mục đạt / chưa đạt"),
    ("Xuất bản phiên bản", "Quản trị viên", "Đưa mẫu tới ứng viên", "Danh sách điều kiện đạt, phiên bản là nháp", "Phiên bản mới dùng được, phiên bản cũ ngừng, tạo ảnh xem trước theo màu"),
    ("Ngừng dùng phiên bản", "Quản trị viên", "Ngừng một phiên bản cũ", "Không phải phiên bản hiện hành", "Phiên bản chuyển retired"),
    ("Ẩn / hiện mẫu", "Quản trị viên", "Ẩn mẫu khỏi thư viện hoặc hiện lại", "Hiện lại cần có phiên bản đã xuất bản", "Mẫu đổi trạng thái hiển thị; mẫu đang dùng không xóa được"),
    ("Nhân bản mẫu", "Quản trị viên", "Tạo mẫu mới từ mẫu có sẵn", "Mẫu tồn tại", "Mẫu nháp mới"),
    ("Quản lý nội dung CV mẫu", "Quản trị viên", "Quản lý nội dung gợi ý theo vị trí và kinh nghiệm", "Đăng nhập cổng quản trị", "Nội dung mẫu được duyệt và xuất bản"),
    ("Sinh nội dung mẫu bằng AI", "Quản trị viên, Google Gemini", "Sinh nháp nội dung mẫu theo vị trí, ngôn ngữ", "AI đang bật, không có lượt sinh đang chạy", "Nội dung ở trạng thái chờ duyệt"),
]
DONG_CHINH = [
    ("Tạo mẫu CV", "Quản trị viên", "Nhập tên, danh mục, bộ dựng giao diện >> Tạo"),
    ("Tạo mẫu CV", "Hệ thống", "Tạo mẫu và phiên bản nháp"),
    ("Cấu hình phiên bản mẫu", "Quản trị viên", "Thiết lập từng bước >> Lưu"),
    ("Cấu hình phiên bản mẫu", "Hệ thống", "Lưu cấu hình phiên bản"),
    ("Xuất PDF thử", "Quản trị viên", "Bấm Xuất PDF thử >> chờ >> xem tệp"),
    ("Xuất PDF thử", "Hệ thống", "Đưa việc vào hàng đợi cv-export >> trả token >> giao diện thăm dò mỗi 1,5 giây"),
    ("Xuất bản phiên bản", "Quản trị viên", "Bấm Xuất bản"),
    ("Xuất bản phiên bản", "Hệ thống", "Kiểm tra danh sách điều kiện >> xuất bản >> ngừng phiên bản cũ >> tạo ảnh xem trước"),
    ("Sinh nội dung mẫu bằng AI", "Quản trị viên", "Chọn vị trí, ngôn ngữ, mức kinh nghiệm >> bấm Sinh"),
    ("Sinh nội dung mẫu bằng AI", "Hệ thống", "Kiểm tra cấu hình AI >> AI Worker gọi Gemini >> lưu nội dung chờ duyệt"),
]
