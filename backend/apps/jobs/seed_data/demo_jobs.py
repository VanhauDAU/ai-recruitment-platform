"""Dữ liệu mẫu cho lệnh ``seed_demo_jobs`` (công ty, chức danh, thuộc tính tin)."""

DEMO_DOMAIN = '@demo.local'
DEMO_MEDIA_DIRECTORY = 'employers/demo'
DEMO_BRAND_COLOURS = ['#0369a1', '#4338ca', '#6d28d9', '#be123c', '#c2410c', '#0f766e', '#334155']

COMPANIES = [
    ('FPT Software', '1000+', 'Công nghệ thông tin'),
    ('Viettel Solutions', '1000+', 'Công nghệ - Viễn thông'),
    ('VNG Corporation', '1000+', 'Công nghệ thông tin'),
    ('Ngân hàng Techcombank', '1000+', 'Tài chính - Ngân hàng'),
    ('Công ty CP MoMo', '500-1000', 'Fintech'),
    ('Shopee Việt Nam', '1000+', 'Thương mại điện tử'),
    ('Tập đoàn Vingroup', '1000+', 'Đa ngành'),
    ('Công ty TNHH Quanta', '1000+', 'Sản xuất - Điện tử'),
]

# top-level category name -> list of job titles
JOBS_BY_CATEGORY = {
    'Công nghệ thông tin': [
        'Lập trình viên Backend (Java/Python)',
        'Lập trình viên Frontend ReactJS',
        'Kỹ sư DevOps',
        'Kỹ sư AI/Machine Learning',
        'Nhân viên kiểm thử phần mềm (Tester)',
        'Lập trình viên Mobile (Flutter)',
    ],
    'Kinh doanh/Bán hàng': [
        'Nhân viên kinh doanh B2B',
        'Trưởng phòng kinh doanh',
        'Nhân viên telesales',
        'Chuyên viên tư vấn bán hàng',
        'Sales Executive',
    ],
    'Marketing/PR/Quảng cáo': [
        'Chuyên viên Digital Marketing',
        'Content Marketing',
        'Nhân viên SEO',
        'Trưởng nhóm truyền thông',
    ],
    'Kế toán/Kiểm toán/Thuế': [
        'Kế toán tổng hợp',
        'Kế toán thuế',
        'Chuyên viên kiểm toán nội bộ',
    ],
    'Nhân sự/Hành chính/Pháp chế': [
        'Chuyên viên tuyển dụng',
        'Nhân viên hành chính nhân sự',
        'HR Business Partner',
    ],
    'Chăm sóc khách hàng': [
        'Nhân viên chăm sóc khách hàng',
        'Tổng đài viên',
        'Chuyên viên vận hành dịch vụ',
    ],
    'Thiết kế/Sáng tạo': [
        'Thiết kế đồ hoạ (Graphic Designer)',
        'UI/UX Designer',
        'Nhân viên dựng phim',
    ],
    'Lao động phổ thông': [
        'Công nhân sản xuất',
        'Nhân viên kho',
        'Nhân viên giao hàng',
    ],
}

# Chỉ số công ty (trong COMPANIES) được bật trang thương hiệu: FPT, VNG, Shopee.
BRAND_COMPANY_INDEXES = {0, 2, 5}

WORK_TYPES = ['onsite', 'hybrid', 'remote']
EMP_TYPES = ['full_time', 'full_time', 'full_time', 'part_time', 'internship']
EXP_YEARS = ['none', 'under_1', '1', '2', '3', '5']
EDU_LEVELS = ['none', 'high_school', 'college', 'university', 'university']
# Chứng chỉ demo cho yêu cầu ngoại ngữ theo mã ngôn ngữ.
LANGUAGE_CERTIFICATES = {'en': 'TOEIC 600+', 'ko': 'TOPIK 2', 'ja': 'JLPT N3', 'zh': 'HSK 4'}
DEMO_VISIBILITY_DAYS = 60
