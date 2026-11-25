"""Nội dung mẫu cho cẩm nang nghề nghiệp, dùng bởi lệnh ``seed_blog_posts``.

Mỗi bài là một dict: ``slug`` (khóa idempotent), ``category`` (slug danh mục của
``seed_blog``), ``title``, ``summary``, ``seo_title``, ``seo_description``,
``tags`` (slug trong ``TAGS``), ``days_ago`` (ngày đăng lùi so với lần seed đầu),
``job_category`` (slug ``jobs.JobCategory``, tùy chọn) và ``content`` (HTML theo
allowlist của ``common.html.content``).
"""

from .posts_dinh_huong_bi_kip import POSTS as _DINH_HUONG_BI_KIP
from .posts_hanh_trang_thi_truong import POSTS as _HANH_TRANG_THI_TRUONG
from .posts_luong_chuyen_nganh import POSTS as _LUONG_CHUYEN_NGANH

TAGS = {
    'cv': 'CV',
    'phong-van': 'Phỏng vấn',
    'thu-xin-viec': 'Thư xin việc',
    'luong-thuong': 'Lương thưởng',
    'dam-phan-luong': 'Đàm phán lương',
    'bao-hiem-phuc-loi': 'Bảo hiểm và phúc lợi',
    'ky-nang-mem': 'Kỹ năng mềm',
    'sinh-vien-moi-ra-truong': 'Sinh viên mới ra trường',
    'chuyen-nganh-cntt': 'Công nghệ thông tin',
    'marketing': 'Marketing',
    'ke-toan-tai-chinh': 'Kế toán tài chính',
    'kinh-doanh-ban-hang': 'Kinh doanh',
    'nhan-su': 'Nhân sự',
    'thiet-ke': 'Thiết kế',
    'xu-huong-tuyen-dung': 'Xu hướng tuyển dụng',
    'ai-trong-tuyen-dung': 'AI trong tuyển dụng',
    'lam-viec-tu-xa': 'Làm việc từ xa',
    'phat-trien-ban-than': 'Phát triển bản thân',
    'chuyen-viec': 'Chuyển việc',
    'an-toan-tim-viec': 'Tìm việc an toàn',
    'luat-lao-dong': 'Luật lao động',
}

POSTS = [*_DINH_HUONG_BI_KIP, *_LUONG_CHUYEN_NGANH, *_HANH_TRANG_THI_TRUONG]

# Bài ghim ở khối "Tài liệu hỗ trợ tìm việc" (sidebar bài viết), theo thứ tự.
PINNED_SLUGS = [
    'cach-viet-cv-xin-viec-chuan',
    'cau-hoi-phong-van-thuong-gap',
    'cach-deal-luong-khi-phong-van',
    'dau-hieu-tin-tuyen-dung-lua-dao',
]
