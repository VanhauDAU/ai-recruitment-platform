from django.core.management.base import BaseCommand

from apps.services.models import ServiceCategory, ServicePackage

# Dữ liệu mẫu để trang báo giá chạy ngay; admin chỉnh giá/quyền lợi sau qua
# trang quản trị. Seed idempotent: chỉ tạo khi chưa có, KHÔNG ghi đè bản ghi
# admin đã chỉnh (get_or_create theo key/slug).

# (key, name_vi, name_en, description_vi, description_en, icon)
CATEGORIES = [
    (
        'featured-jobs',
        'Tin tuyển dụng nổi bật',
        'Featured job postings',
        'Đưa tin tuyển dụng lên các vị trí nổi bật, tiếp cận nhiều ứng viên phù hợp hơn.',
        'Boost your job postings to premium placements and reach more relevant candidates.',
        'ThunderboltOutlined',
    ),
    (
        'combo',
        'Combo tiết kiệm',
        'Saver combos',
        'Gói kết hợp nhiều tin đăng với chi phí tối ưu cho nhu cầu tuyển dụng thường xuyên.',
        'Bundled job postings at optimized cost for regular hiring needs.',
        'AppstoreOutlined',
    ),
    (
        'ai-credits',
        'AI & Credits',
        'AI & Credits',
        'Ứng dụng AI sàng lọc hồ sơ, gợi ý ứng viên phù hợp và chấm điểm CV tự động.',
        'AI-powered CV screening, candidate matching and automatic resume scoring.',
        'RobotOutlined',
    ),
    (
        'branding',
        'Employer Branding',
        'Employer Branding',
        'Xây dựng thương hiệu tuyển dụng uy tín, tăng độ nhận diện với ứng viên tiềm năng.',
        'Build a trusted employer brand and increase visibility with potential candidates.',
        'StarOutlined',
    ),
    (
        'addons',
        'Dịch vụ bổ trợ',
        'Add-on services',
        'Các tiện ích cộng thêm giúp tin tuyển dụng nổi bật hơn với ứng viên.',
        'Extra options that make your job postings stand out to candidates.',
        'PlusCircleOutlined',
    ),
]

# (category_key, slug, name_vi, name_en, tagline_vi, tagline_en, price, unit_vi, unit_en,
#  benefits_vi, benefits_en, badge_vi, badge_en, is_highlight, cta_type)
PACKAGES = [
    (
        'featured-jobs',
        'top-max',
        'TOP MAX',
        'TOP MAX',
        'Đăng tin hiệu suất cao, phủ sóng tối đa',
        'High-performance posting with maximum reach',
        7500000,
        '/ tin 30 ngày',
        '/ posting, 30 days',
        [
            'Hiển thị trong khối Việc làm tốt nhất trang chủ',
            'Ưu tiên hiển thị trong mọi danh sách việc làm',
            '7 lần đẩy TOP khung giờ vàng',
            'AI đề xuất tin tới ứng viên phù hợp',
            'Thông báo việc làm tới ứng viên đang tìm việc',
            'Bảo hành dịch vụ với quyền lợi ưu tiên',
        ],
        [
            'Featured in the Best Jobs box on the homepage',
            'Priority placement in all job listings',
            '7 golden-hour boosts to the top',
            'AI recommends your posting to matching candidates',
            'Job alerts sent to active job seekers',
            'Service warranty with priority benefits',
        ],
        'Hiệu quả nhất',
        'Best value',
        True,
        ServicePackage.CtaType.CONTACT,
    ),
    (
        'featured-jobs',
        'top-max-plus',
        'TOP MAX PLUS',
        'TOP MAX PLUS',
        'Phiên bản mở rộng với số lần đẩy TOP gấp đôi',
        'Extended version with double top boosts',
        9650000,
        '/ tin 30 ngày',
        '/ posting, 30 days',
        [
            'Toàn bộ quyền lợi của TOP MAX',
            '14 lần đẩy TOP khung giờ vàng',
            'Ưu tiên hiển thị trong kết quả tìm kiếm',
            'Báo cáo hiệu quả tin đăng chi tiết',
        ],
        [
            'All TOP MAX benefits',
            '14 golden-hour boosts to the top',
            'Priority placement in search results',
            'Detailed posting performance report',
        ],
        '',
        '',
        False,
        ServicePackage.CtaType.CONTACT,
    ),
    (
        'featured-jobs',
        'top-eco-plus',
        'TOP ECO PLUS',
        'TOP ECO PLUS',
        'Lựa chọn tiết kiệm cho tin cần độ phủ vừa phải',
        'Economical choice for moderate reach',
        4400000,
        '/ tin 30 ngày',
        '/ posting, 30 days',
        [
            'Ưu tiên hiển thị trong Top việc làm liên quan',
            '1 lần đẩy TOP khung giờ vàng',
            'AI đề xuất tin tới ứng viên phù hợp',
            'Bảo hành dịch vụ',
        ],
        [
            'Priority placement in related jobs',
            '1 golden-hour boost to the top',
            'AI recommends your posting to matching candidates',
            'Service warranty',
        ],
        '',
        '',
        False,
        ServicePackage.CtaType.CONTACT,
    ),
    (
        'combo',
        'combo-starter',
        'Combo Starter',
        'Starter Combo',
        'Gói 3 tin tiêu chuẩn cho doanh nghiệp mới bắt đầu',
        'Three standard postings for new businesses',
        2550000,
        '/ 3 tin',
        '/ 3 postings',
        [
            '3 tin đăng tiêu chuẩn hiển thị ưu tiên',
            '2 lần đẩy TOP khung giờ thường',
            'AI đề xuất tin tới ứng viên phù hợp',
        ],
        [
            '3 standard postings with priority display',
            '2 regular-hour boosts to the top',
            'AI recommends your postings to matching candidates',
        ],
        '',
        '',
        False,
        ServicePackage.CtaType.CONTACT,
    ),
    (
        'combo',
        'combo-growth',
        'Combo Growth',
        'Growth Combo',
        'Giải pháp trọn gói cho nhu cầu tuyển dụng liên tục',
        'All-in bundle for continuous hiring',
        None,
        '',
        '',
        [
            'Số lượng tin linh hoạt theo nhu cầu',
            'Tư vấn chiến lược đăng tin theo ngành',
            'Ưu đãi giá theo cam kết dài hạn',
            'Chuyên viên hỗ trợ riêng',
        ],
        [
            'Flexible number of postings',
            'Industry-specific posting strategy consulting',
            'Discounts for long-term commitment',
            'Dedicated account support',
        ],
        '',
        '',
        False,
        ServicePackage.CtaType.CONTACT,
    ),
    (
        'ai-credits',
        'ai-cv-screening',
        'AI sàng lọc CV',
        'AI CV Screening',
        'Tự động chấm điểm và xếp hạng hồ sơ ứng tuyển',
        'Automatically score and rank applications',
        3000000,
        '/ tháng',
        '/ month',
        [
            'AI chấm điểm mức độ phù hợp từng hồ sơ',
            'Xếp hạng ứng viên theo yêu cầu tin đăng',
            'Tóm tắt điểm mạnh/yếu của từng CV',
            'Tiết kiệm 80% thời gian sàng lọc',
        ],
        [
            'AI scores each application for fit',
            'Ranks candidates against job requirements',
            "Summarizes each CV's strengths and gaps",
            'Cuts screening time by 80%',
        ],
        'AI',
        'AI',
        True,
        ServicePackage.CtaType.CONTACT,
    ),
    (
        'ai-credits',
        'ai-matching-credits',
        'Credit gợi ý ứng viên',
        'Candidate Matching Credits',
        'Chủ động tiếp cận ứng viên phù hợp từ kho hồ sơ',
        'Proactively reach matching candidates',
        5000000,
        '/ 100 credits',
        '/ 100 credits',
        [
            'AI gợi ý ứng viên phù hợp với tin đăng',
            'Xem hồ sơ chi tiết bằng credit',
            'Credit linh hoạt, dùng cho mọi tin đăng',
            'Ứng viên được xác thực thông tin liên hệ',
        ],
        [
            'AI suggests candidates matching your posting',
            'Unlock full profiles with credits',
            'Flexible credits usable on any posting',
            'Candidates with verified contact info',
        ],
        '',
        '',
        False,
        ServicePackage.CtaType.CONTACT,
    ),
    (
        'branding',
        'branding-banner',
        'Banner trang chủ',
        'Homepage Banner',
        'Banner thương hiệu trên trang chủ và trang tìm việc',
        'Brand banner on homepage and job search',
        8000000,
        '/ 4 tuần',
        '/ 4 weeks',
        [
            'Banner hiển thị trên trang chủ ứng viên',
            'Tiếp cận toàn bộ ứng viên truy cập nền tảng',
            'Hỗ trợ thiết kế banner chuyên nghiệp',
            'Báo cáo lượt hiển thị và lượt click',
        ],
        [
            'Banner shown on the candidate homepage',
            'Reach every candidate visiting the platform',
            'Professional banner design support',
            'Impression and click reporting',
        ],
        '',
        '',
        False,
        ServicePackage.CtaType.CONTACT,
    ),
    (
        'branding',
        'branding-top-employer',
        'Trang tuyển dụng thương hiệu',
        'Branded Career Page',
        'Chuyên trang tuyển dụng riêng với giao diện khác biệt',
        'Dedicated career page with custom look',
        None,
        '',
        '',
        [
            'Trang thương hiệu riêng trên nền tảng',
            'Giới thiệu văn hoá và môi trường làm việc',
            'Tổng hợp mọi tin đăng của doanh nghiệp',
            'Logo nổi bật tại trang chủ việc làm',
        ],
        [
            'Dedicated brand page on the platform',
            'Showcase culture and work environment',
            'All your postings in one place',
            'Featured logo on the jobs homepage',
        ],
        '',
        '',
        False,
        ServicePackage.CtaType.CONTACT,
    ),
    (
        'addons',
        'job-refresh',
        'Làm mới tin đăng',
        'Job Refresh',
        'Đẩy tin lên đầu danh sách như tin mới đăng',
        'Push your posting back to the top',
        500000,
        '/ lần',
        '/ refresh',
        ['Tin hiển thị như mới đăng', 'Tăng lượt xem trong 24h đầu', 'Kích hoạt ngay khi cần'],
        [
            'Posting appears as newly published',
            'More views within the first 24h',
            'Activate instantly whenever needed',
        ],
        '',
        '',
        False,
        ServicePackage.CtaType.CONTACT,
    ),
    (
        'addons',
        'urgent-tag',
        'Nhãn TUYỂN GẤP',
        'URGENT Label',
        'Gắn nhãn nổi bật vào tiêu đề tin tuyển dụng',
        'Add an eye-catching label to your posting title',
        1000000,
        '/ tin',
        '/ posting',
        [
            'Nhãn TUYỂN GẤP nổi bật trên tiêu đề',
            'Thu hút ứng viên đang cần việc ngay',
            'Áp dụng cho mọi loại tin đăng',
        ],
        [
            'Prominent URGENT label on the title',
            'Attracts candidates ready to start now',
            'Applicable to any posting type',
        ],
        '',
        '',
        False,
        ServicePackage.CtaType.CONTACT,
    ),
]


class Command(BaseCommand):
    help = 'Seed nhóm dịch vụ và gói báo giá mẫu cho trang NTD (idempotent).'

    def handle(self, *args, **options):
        created_categories = created_packages = 0

        categories = {}
        for order, (key, name_vi, name_en, desc_vi, desc_en, icon) in enumerate(
            CATEGORIES, start=1
        ):
            category, created = ServiceCategory.objects.get_or_create(
                key=key,
                defaults={
                    'name_vi': name_vi,
                    'name_en': name_en,
                    'description_vi': desc_vi,
                    'description_en': desc_en,
                    'icon': icon,
                    'order': order,
                },
            )
            categories[key] = category
            created_categories += created

        for order, (
            category_key,
            slug,
            name_vi,
            name_en,
            tagline_vi,
            tagline_en,
            price,
            unit_vi,
            unit_en,
            benefits_vi,
            benefits_en,
            badge_vi,
            badge_en,
            is_highlight,
            cta_type,
        ) in enumerate(PACKAGES, start=1):
            _, created = ServicePackage.objects.get_or_create(
                slug=slug,
                defaults={
                    'category': categories[category_key],
                    'name_vi': name_vi,
                    'name_en': name_en,
                    'tagline_vi': tagline_vi,
                    'tagline_en': tagline_en,
                    'price': price,
                    'unit_vi': unit_vi,
                    'unit_en': unit_en,
                    'benefits_vi': benefits_vi,
                    'benefits_en': benefits_en,
                    'badge_vi': badge_vi,
                    'badge_en': badge_en,
                    'is_highlight': is_highlight,
                    'cta_type': cta_type,
                    'order': order,
                },
            )
            created_packages += created

        self.stdout.write(
            self.style.SUCCESS(
                f'Seed services xong: +{created_categories} nhóm, +{created_packages} gói '
                f'(đã có {ServiceCategory.objects.count()} nhóm, {ServicePackage.objects.count()} gói).'
            )
        )
