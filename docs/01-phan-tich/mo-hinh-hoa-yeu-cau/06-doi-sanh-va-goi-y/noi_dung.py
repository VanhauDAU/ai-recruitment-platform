TEN = "chức năng đối sánh CV–JD và gợi ý việc làm"
MO_TA = [
    ("Phân tích mức độ phù hợp CV–JD", "Ứng viên", "Biết CV phù hợp với tin tới mức nào và cần cải thiện gì", "Bật tính năng, CV đã lưu, tin đang công khai, dưới 20 lần/giờ", "Điểm tổng, điểm 6 tiêu chí, kỹ năng khớp/thiếu, gợi ý cải thiện"),
    ("Chọn CV để phân tích", "Ứng viên", "Chọn CV online đã lưu hoặc CV dạng tệp", "Có CV đã lưu", "CV được chọn thuộc ứng viên"),
    ("Đối sánh ngữ nghĩa CV–JD", "Hệ thống (ML Worker)", "Chấm mức phù hợp bằng mô hình e5-base chạy local và công thức hybrid-v1", "Có hồ sơ và vector của CV và tin", "Kết quả tất định, lưu theo khóa phiên bản để dùng lại"),
    ("Trích hồ sơ và tính vector CV, tin", "Hệ thống (ML Worker)", "Trích kỹ năng, kinh nghiệm, học vấn, cấp bậc, ngoại ngữ; mã hóa vector 768 chiều", "CV có phiên bản mới hoặc tin chuyển active", "MatchDocument và MatchChunk được lưu (pgvector)"),
    ("Phục hồi phân tích bị treo", "Tác vụ định kỳ", "Không để phân tích kẹt mãi", "Có phân tích quá thời gian", "Phân tích được gửi lại hoặc chuyển failed"),
    ("Xem việc làm gợi ý", "Ứng viên", "Xem tin phù hợp với nguyện vọng (hiện theo luật, dự kiến theo ngữ nghĩa)", "Đã khai báo nguyện vọng và đồng ý nhận gợi ý", "Danh sách tin kèm lý do phù hợp"),
    ("Ẩn tin gợi ý không quan tâm", "Ứng viên", "Loại một tin khỏi gợi ý", "Đang xem danh sách gợi ý", "Tin không còn được gợi ý"),
]
DONG_CHINH = [
    ("Phân tích mức độ phù hợp CV–JD", "Ứng viên", "Bấm Xem độ phù hợp trên tin >> chọn CV >> chờ kết quả"),
    ("Phân tích mức độ phù hợp CV–JD", "Hệ thống", "Kiểm tra cờ, giới hạn, quyền >> tìm kết quả theo khóa >> chưa có thì gửi việc cho ML Worker >> trả 202"),
    ("Đối sánh ngữ nghĩa CV–JD", "Hệ thống", "Lấy hoặc tính vector >> chấm 6 tiêu chí >> sinh giải thích, gợi ý theo luật >> lưu kết quả"),
    ("Phân tích mức độ phù hợp CV–JD", "Giao diện", "Thăm dò mỗi 800 ms >> hiển thị điểm, tiêu chí, kỹ năng, gợi ý, lưu ý"),
    ("Trích hồ sơ và tính vector CV, tin", "Hệ thống", "Khi lưu CV hoặc đăng tin >> trích hồ sơ >> chia đoạn >> mã hóa >> lưu vector"),
    ("Phục hồi phân tích bị treo", "Tác vụ định kỳ", "Mỗi 60 giây: gửi lại việc chờ lâu >> chuyển failed việc quá 10 phút"),
    ("Xem việc làm gợi ý", "Ứng viên", "Mở Việc làm phù hợp"),
    ("Xem việc làm gợi ý", "Hệ thống", "Kiểm tra nguyện vọng và đồng ý >> lọc trước tin >> chấm điểm >> sắp xếp >> trả lý do phù hợp"),
    ("Ẩn tin gợi ý không quan tâm", "Ứng viên", "Bấm Không quan tâm trên một tin"),
    ("Ẩn tin gợi ý không quan tâm", "Hệ thống", "Lưu tin bị ẩn >> loại khỏi các lần gợi ý sau"),
]
