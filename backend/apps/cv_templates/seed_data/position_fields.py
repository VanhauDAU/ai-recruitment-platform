"""Trường riêng và từ khóa mặc định của các vị trí có nội dung mẫu (CVT-3).

Đây là đề xuất khởi tạo; admin sửa tiếp ở cổng quản trị. Trường thẻ đánh dấu
`maps_to=skills` được đối chiếu với taxonomy kỹ năng khi lưu CV (matching).
"""


def _field(key, label_vi, label_en, field_type, *, placeholder=('', ''), options=(), skills=False):
    return {
        'key': key,
        'label_vi': label_vi,
        'label_en': label_en,
        'placeholder_vi': placeholder[0],
        'placeholder_en': placeholder[1],
        'field_type': field_type,
        'options': [{'vi': vi, 'en': en} for vi, en in options],
        'maps_to': 'skills' if skills else 'none',
    }


_GITHUB = _field('github_url', 'GitHub', 'GitHub', 'url', placeholder=('https://github.com/…',) * 2)
_PORTFOLIO = _field(
    'portfolio_url', 'Portfolio', 'Portfolio', 'url', placeholder=('https://…',) * 2
)

POSITION_SETUP = {
    'Backend Developer': {
        'keywords': ['Python', 'Django', 'PostgreSQL', 'REST API', 'Docker', 'Redis', 'Git'],
        'fields': [
            _GITHUB,
            _field('tech_stack', 'Công nghệ chính', 'Main tech stack', 'tags', skills=True),
            _field(
                'system_scale',
                'Quy mô hệ thống từng vận hành',
                'Largest system operated',
                'text',
                placeholder=('VD: 1 triệu người dùng/tháng', 'e.g. 1M monthly users'),
            ),
        ],
    },
    'Frontend Developer': {
        'keywords': ['JavaScript', 'TypeScript', 'React', 'HTML', 'CSS', 'Next.js', 'Git'],
        'fields': [
            _GITHUB,
            _PORTFOLIO,
            _field('tech_stack', 'Công nghệ chính', 'Main tech stack', 'tags', skills=True),
        ],
    },
    'AI/Machine Learning Engineer': {
        'keywords': ['Python', 'PyTorch', 'TensorFlow', 'Machine Learning', 'SQL', 'Docker'],
        'fields': [
            _GITHUB,
            _field(
                'research_areas',
                'Mảng chuyên sâu',
                'Focus areas',
                'multi_select',
                options=[
                    ('Xử lý ngôn ngữ tự nhiên', 'Natural language processing'),
                    ('Thị giác máy tính', 'Computer vision'),
                    ('Hệ gợi ý', 'Recommender systems'),
                    ('MLOps', 'MLOps'),
                    ('AI tạo sinh', 'Generative AI'),
                ],
            ),
            _field('frameworks', 'Framework', 'Frameworks', 'tags', skills=True),
        ],
    },
    'Automation Tester': {
        'keywords': ['Selenium', 'Playwright', 'API Testing', 'Python', 'Java', 'CI/CD', 'Jira'],
        'fields': [
            _field('test_tools', 'Công cụ kiểm thử', 'Testing tools', 'tags', skills=True),
            _field(
                'istqb',
                'Chứng chỉ ISTQB',
                'ISTQB certification',
                'select',
                options=[
                    ('Foundation', 'Foundation'),
                    ('Advanced', 'Advanced'),
                    ('Expert', 'Expert'),
                ],
            ),
        ],
    },
    'Content Marketing': {
        'keywords': ['SEO', 'Copywriting', 'Content Strategy', 'Google Analytics', 'Canva'],
        'fields': [
            _PORTFOLIO,
            _field(
                'content_channels',
                'Kênh nội dung',
                'Content channels',
                'multi_select',
                options=[
                    ('Website/Blog', 'Website/Blog'),
                    ('Facebook', 'Facebook'),
                    ('TikTok', 'TikTok'),
                    ('YouTube', 'YouTube'),
                    ('Email', 'Email'),
                    ('LinkedIn', 'LinkedIn'),
                ],
            ),
            _field(
                'best_result',
                'Kết quả nổi bật',
                'Key result',
                'text',
                placeholder=(
                    'VD: tăng 40% lượt truy cập tự nhiên sau 6 tháng',
                    'e.g. +40% organic traffic in 6 months',
                ),
            ),
        ],
    },
    'Nhân viên CSKH': {
        'keywords': ['Giao tiếp', 'Xử lý khiếu nại', 'CRM', 'Tin học văn phòng'],
        'fields': [
            _field(
                'support_channels',
                'Kênh hỗ trợ',
                'Support channels',
                'multi_select',
                options=[
                    ('Điện thoại', 'Phone'),
                    ('Email', 'Email'),
                    ('Chat', 'Live chat'),
                    ('Mạng xã hội', 'Social media'),
                    ('Tại quầy', 'In person'),
                ],
            ),
            _field(
                'csat',
                'Chỉ số hài lòng (CSAT)',
                'Satisfaction score (CSAT)',
                'text',
                placeholder=('VD: 95%', 'e.g. 95%'),
            ),
            _field('crm_tools', 'Phần mềm CRM', 'CRM tools', 'tags', skills=True),
        ],
    },
    'Sales Online': {
        'keywords': ['Bán hàng', 'Đàm phán', 'Chăm sóc khách hàng', 'Facebook Ads', 'CRM'],
        'fields': [
            _field(
                'sales_channels',
                'Kênh bán hàng',
                'Sales channels',
                'multi_select',
                options=[
                    ('Shopee', 'Shopee'),
                    ('Lazada', 'Lazada'),
                    ('TikTok Shop', 'TikTok Shop'),
                    ('Facebook', 'Facebook'),
                    ('Website', 'Website'),
                    ('Zalo', 'Zalo'),
                ],
            ),
            _field(
                'customer_segment',
                'Nhóm khách hàng',
                'Customer segment',
                'select',
                options=[
                    ('Khách lẻ (B2C)', 'Consumers (B2C)'),
                    ('Doanh nghiệp (B2B)', 'Businesses (B2B)'),
                ],
            ),
            _field(
                'best_revenue',
                'Doanh số nổi bật',
                'Top sales result',
                'text',
                placeholder=('VD: 2 tỷ đồng/năm, vượt 120% chỉ tiêu', 'e.g. 120% of annual target'),
            ),
        ],
    },
    'Kế toán tổng hợp': {
        'keywords': ['Kế toán', 'Thuế', 'MISA', 'Excel', 'Báo cáo tài chính'],
        'fields': [
            _field(
                'accounting_software',
                'Phần mềm kế toán',
                'Accounting software',
                'tags',
                skills=True,
            ),
            _field(
                'certificates',
                'Chứng chỉ nghề',
                'Professional certificates',
                'multi_select',
                options=[
                    ('Kế toán trưởng', 'Chief accountant'),
                    ('CPA', 'CPA'),
                    ('ACCA', 'ACCA'),
                    ('Đại lý thuế', 'Tax agent'),
                ],
            ),
            _field('industries', 'Lĩnh vực đã làm', 'Industries', 'tags'),
        ],
    },
    'Tuyển dụng': {
        'keywords': ['Tuyển dụng', 'Phỏng vấn', 'Employer Branding', 'Sourcing'],
        'fields': [
            _field(
                'hiring_volume',
                'Số lượng tuyển mỗi năm',
                'Hires per year',
                'text',
                placeholder=('VD: 150 nhân sự/năm', 'e.g. 150 hires/year'),
            ),
            _field(
                'recruiting_channels',
                'Kênh tuyển dụng',
                'Recruiting channels',
                'multi_select',
                options=[
                    ('LinkedIn', 'LinkedIn'),
                    ('Trang tuyển dụng', 'Job boards'),
                    ('Mạng xã hội', 'Social media'),
                    ('Giới thiệu nội bộ', 'Referrals'),
                    ('Headhunt', 'Headhunting'),
                ],
            ),
            _field('hiring_domains', 'Mảng tuyển chính', 'Hiring domains', 'tags'),
        ],
    },
}
