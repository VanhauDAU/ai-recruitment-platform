"""Nội dung mẫu cho Trung tâm trợ giúp, dùng bởi lệnh ``seed_knowledgebase``.

``EXISTING_CATEGORY_SLUGS`` là các chuyên mục do migration ``0002``/``0005`` tạo;
lệnh chỉ thêm bài vào đó, không sửa tên/thứ tự quản trị viên đã chỉnh.
``CATEGORIES`` là chuyên mục mới (tạo nếu chưa có). Mỗi bài trong ``ARTICLES``
khóa theo cặp ``(category, slug)``.

Help center hiện không có trường đối tượng (ứng viên/NTD), nên chuyên mục cho
nhà tuyển dụng được phân biệt bằng tiền tố tên "Nhà tuyển dụng:" và slug ``ntd-``.
"""

from .candidate import ARTICLES as _CANDIDATE
from .employer import ARTICLES as _EMPLOYER

EXISTING_CATEGORY_SLUGS = {
    'tai-khoan-va-dang-nhap',
    'bao-mat-va-quyen-rieng',
    'tim-viec-va-goi-y-viec-lam',
    'ung-tuyen-va-theo-doi-ho-so',
    'cv-va-mau-cv',
    'tim-viec-an-toan',
    'lien-he-ho-tro',
    'dieu-khoan-va-chinh-sach',
}

CATEGORIES = [
    {
        'slug': 'goi-y-viec-lam-va-phan-tich-ai',
        'name': 'Gợi ý việc làm và phân tích AI',
        'description': 'Bật gợi ý việc làm, khai nhu cầu, xem độ phù hợp CV với tin và cách AI tính điểm.',
        'order': 9,
        'review_interval_days': 90,
    },
    {
        'slug': 'thong-bao-email-va-tin-nhan',
        'name': 'Thông báo, email và tin nhắn',
        'description': 'Cài đặt thông báo, thông báo việc làm theo tiêu chí, nhắn tin và lịch hẹn qua ProCV Connect.',
        'order': 10,
        'review_interval_days': 180,
    },
    {
        'slug': 'ntd-dang-ky-va-xac-thuc',
        'name': 'Nhà tuyển dụng: Đăng ký và xác thực',
        'description': 'Tạo tài khoản nhà tuyển dụng, liên kết công ty, xác minh số điện thoại, giấy tờ và dấu xác thực.',
        'order': 20,
        'review_interval_days': 90,
    },
    {
        'slug': 'ntd-dang-tin-tuyen-dung',
        'name': 'Nhà tuyển dụng: Đăng tin và hậu kiểm',
        'description': 'Điều kiện đăng tin, viết tin bằng AI, hạn nộp, gia hạn và các trường hợp tin bị tạm ẩn.',
        'order': 21,
        'review_interval_days': 90,
    },
    {
        'slug': 'ntd-chien-dich-va-mang-xa-hoi',
        'name': 'Nhà tuyển dụng: Chiến dịch và mạng xã hội',
        'description': 'Thiết lập chiến dịch tuyển dụng, kênh phân phối, link theo dõi nguồn và tự đăng lên mạng xã hội.',
        'order': 22,
        'review_interval_days': 180,
    },
    {
        'slug': 'ntd-ho-so-ung-vien-va-ai',
        'name': 'Nhà tuyển dụng: Hồ sơ ứng viên và AI xếp hạng',
        'description': 'Xử lý hồ sơ, hoàn tác quyết định, xếp hạng theo mức phù hợp, Tìm CV, kho ứng viên và danh sách đen.',
        'order': 23,
        'review_interval_days': 90,
    },
    {
        'slug': 'ntd-procv-connect',
        'name': 'Nhà tuyển dụng: ProCV Connect',
        'description': 'Nhắn tin với ứng viên, gửi tệp và đặt lịch phỏng vấn ngay trên ProCV.',
        'order': 24,
        'review_interval_days': 180,
    },
    {
        'slug': 'ntd-du-lieu-ca-nhan-va-dpa',
        'name': 'Nhà tuyển dụng: DPA và Nghị định 13',
        'description': 'Thỏa thuận xử lý dữ liệu cá nhân ứng viên, DPA với nền tảng và ảnh hưởng tới quyền truy cập.',
        'order': 25,
        'review_interval_days': 90,
    },
]

ARTICLES = [*_CANDIDATE, *_EMPLOYER]
