TEN = "chức năng quản lý tài khoản"
MO_TA = [
    ("Tìm kiếm và xem tài khoản", "Quản trị viên", "Tra cứu tài khoản ứng viên, NTD", "Đăng nhập cổng quản trị", "Thông tin tài khoản, tin, chiến dịch liên quan"),
    ("Tạm khóa tài khoản", "Quản trị viên", "Tạm ngừng tài khoản vi phạm", "Không tự khóa chính mình, chuyển trạng thái hợp lệ", "Phiên bị thu hồi, tin và chiến dịch tạm giữ"),
    ("Cấm tài khoản", "Quản trị viên (superuser)", "Cấm tài khoản vi phạm nghiêm trọng", "Là superuser, có bằng chứng và nhóm vi phạm", "Tài khoản bị cấm, tài nguyên chờ xét"),
    ("Mở lại tài khoản", "Quản trị viên", "Cho tài khoản hoạt động trở lại", "Đã gỡ các tạm giữ do cấm (nếu có)", "Tài khoản hoạt động, tin được bù thời gian hiển thị"),
    ("Xem trước ảnh hưởng", "Hệ thống", "Cho biết số tin, chiến dịch bị ảnh hưởng trước khi xác nhận", "Quản trị viên chọn trạng thái mới", "Ảnh hưởng và impact_token 10 phút"),
    ("Gỡ tạm giữ tài nguyên", "Quản trị viên (superuser)", "Gỡ tạm giữ tin, chiến dịch của tài khoản từng bị cấm", "Tài khoản đang tạm khóa", "Tài nguyên được gỡ tạm giữ, bù thời gian"),
    ("Gửi email thông báo trạng thái", "Hệ thống, Người dùng bị xử lý", "Báo người dùng về thay đổi trạng thái", "Trạng thái tài khoản vừa đổi", "Email được gửi qua hàng đợi"),
    ("Thu hồi phiên đăng nhập", "Quản trị viên", "Đăng xuất người dùng khỏi mọi thiết bị", "Tài khoản tồn tại", "Mọi phiên bị thu hồi"),
    ("Gửi lại email xác minh / đặt lại mật khẩu", "Quản trị viên", "Hỗ trợ người dùng không nhận được email", "Tài khoản tồn tại", "Email được gửi lại"),
]
DONG_CHINH = [
    ("Tìm kiếm và xem tài khoản", "Quản trị viên", "Nhập email hoặc tên >> mở chi tiết"),
    ("Tìm kiếm và xem tài khoản", "Hệ thống", "Trả thông tin tài khoản và tài nguyên liên quan"),
    ("Tạm khóa tài khoản", "Quản trị viên", "Chọn Tạm khóa >> nhập lý do >> xem ảnh hưởng >> xác nhận"),
    ("Tạm khóa tài khoản", "Hệ thống", "Kiểm tra bước chuyển >> trả ảnh hưởng >> đổi trạng thái >> thu hồi phiên >> tạm giữ tài nguyên >> gửi email"),
    ("Cấm tài khoản", "Quản trị viên", "Chọn Cấm >> nhập bằng chứng, nhóm vi phạm >> xác nhận"),
    ("Cấm tài khoản", "Hệ thống", "Kiểm tra quyền superuser >> đổi trạng thái >> giữ tài nguyên chờ xét >> gửi email"),
    ("Mở lại tài khoản", "Quản trị viên", "Gỡ tạm giữ tài nguyên (nếu cần) >> chọn Mở lại >> xác nhận"),
    ("Mở lại tài khoản", "Hệ thống", "Kiểm tra tạm giữ còn lại >> đổi trạng thái >> bù thời gian hiển thị >> gửi email"),
    ("Thu hồi phiên đăng nhập", "Quản trị viên", "Chọn Thu hồi phiên >> xác nhận"),
    ("Thu hồi phiên đăng nhập", "Hệ thống", "Thu hồi mọi phiên và refresh token >> ghi nhật ký quản trị"),
]
