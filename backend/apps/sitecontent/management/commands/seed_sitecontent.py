from django.core.management.base import BaseCommand

from apps.sitecontent.models import Banner, LinkGroup, LinkItem, SiteSetting

# Cấu hình mẫu để trang chạy ngay; admin chỉnh/thêm sau qua trang quản trị.
PROCV_LOGO_URL = '/images/logo/logo_proCV_2000_2000.png'
LEGACY_BRAND_VALUES = {'', '/images/logo/aicareer-logo.svg', '/favicon.svg', '/images/logo/logo_proCV_2000_600.png'}
BRAND_ASSET_KEYS = {'brand_logo_url', 'brand_logo_mark_url', 'brand_favicon_url'}

SETTINGS = [
    (
        'site_name',
        'Tên site',
        SiteSetting.Group.GENERAL,
        'ProCV',
        'Tên thương hiệu hiển thị ở header, footer và các màn đăng nhập/đăng ký.',
    ),
    (
        'brand_logo_url',
        'Logo đầy đủ',
        SiteSetting.Group.APPEARANCE,
        PROCV_LOGO_URL,
        'URL logo dạng ngang/wordmark dùng ở header. Có thể dùng static asset hoặc media URL nội bộ.',
    ),
    (
        'brand_logo_mark_url',
        'Logo biểu tượng',
        SiteSetting.Group.APPEARANCE,
        PROCV_LOGO_URL,
        'URL logo vuông/icon dùng ở màn đăng nhập, favicon fallback hoặc nơi thiếu diện tích.',
    ),
    (
        'brand_favicon_url',
        'Favicon',
        SiteSetting.Group.APPEARANCE,
        PROCV_LOGO_URL,
        'URL favicon cho tab trình duyệt.',
    ),
    (
        'brand_primary_color',
        'Màu thương hiệu chính',
        SiteSetting.Group.APPEARANCE,
        '#00b14f',
        'Mã màu hex dùng làm biến --brand-primary cho giao diện.',
    ),
    ('hotline', 'Hotline hỗ trợ', SiteSetting.Group.CONTACT, '1900 1234', ''),
    ('support_email', 'Email hỗ trợ', SiteSetting.Group.CONTACT, 'support@aicareercoach.vn', ''),
]

# (key, title, source, order, [items]) — items chỉ dùng cho source=manual.
# url rỗng => frontend hiển thị "Sắp ra mắt" (tính năng chưa có).
LINK_GROUPS = [
    ('footer-locations', 'Việc làm theo khu vực', LinkGroup.Source.LOCATIONS, 1, []),
    ('footer-categories', 'Việc làm theo ngành nghề', LinkGroup.Source.CATEGORIES, 2, []),
    ('footer-cv', 'Mẫu CV & Cẩm nang', LinkGroup.Source.MANUAL, 3, [
        'Mẫu CV', 'Mẫu CV tiếng Anh', 'Mẫu CV IT', 'Mẫu CV Kế toán',
        'Mẫu CV Marketing', 'CV là gì?', 'Cách viết CV xin việc', 'Mẫu Cover Letter',
    ]),
    ('footer-tools', 'Công cụ & Tra cứu', LinkGroup.Source.MANUAL, 4, [
        'Tính lương Gross - Net', 'Tính thuế thu nhập cá nhân', 'Trắc nghiệm tính cách MBTI',
        'Tra cứu mức lương', 'Cẩm nang ngành CNTT', 'Cẩm nang ngành Logistics', 'Cẩm nang ngành Du lịch',
    ]),
]

# (title, eyebrow, subtitle, theme, cta_label, cta_url, order)
BANNERS = [
    (
        'Lập trình viên & Kỹ sư AI', 'TUYỂN DỤNG GẤP',
        'Mức lương hấp dẫn, môi trường năng động, cơ hội thăng tiến nhanh.',
        Banner.Theme.BLUE, 'Xem việc làm IT', '/viec-lam?search=IT', 1,
    ),
    (
        'Tạo CV chuyên nghiệp cùng AI', 'MIỄN PHÍ',
        'Chỉ mất 5 phút để có CV ấn tượng, sẵn sàng ứng tuyển.',
        Banner.Theme.ORANGE, '', '', 2,
    ),
]


class Command(BaseCommand):
    help = 'Tạo dữ liệu cấu hình & cụm link mặc định (idempotent).'

    def handle(self, *args, **options):
        for key, label, group, value, description in SETTINGS:
            setting, created = SiteSetting.objects.get_or_create(
                key=key,
                defaults={'label': label, 'group': group, 'value': value, 'description': description},
            )
            if not created:
                changed = False
                for field, next_value in {'label': label, 'group': group, 'description': description}.items():
                    if getattr(setting, field) != next_value:
                        setattr(setting, field, next_value)
                        changed = True
                if key in BRAND_ASSET_KEYS and setting.value in LEGACY_BRAND_VALUES:
                    setting.value = value
                    changed = True
                if changed:
                    setting.save(update_fields=['label', 'group', 'value', 'description', 'updated_at'])
            self.stdout.write(f'{"+ " if created else "= "}setting {key}')

        for key, title, source, order, items in LINK_GROUPS:
            grp, created = LinkGroup.objects.get_or_create(
                key=key, defaults={'title': title, 'source': source, 'order': order}
            )
            self.stdout.write(f'{"+ " if created else "= "}group {key}')
            if created and source == LinkGroup.Source.MANUAL:
                LinkItem.objects.bulk_create(
                    [LinkItem(group=grp, label=label, url='', order=i) for i, label in enumerate(items)]
                )

        for title, eyebrow, subtitle, theme, cta_label, cta_url, order in BANNERS:
            _, created = Banner.objects.get_or_create(
                title=title,
                defaults={'eyebrow': eyebrow, 'subtitle': subtitle, 'theme': theme, 'cta_label': cta_label, 'cta_url': cta_url, 'order': order},
            )
            self.stdout.write(f'{"+ " if created else "= "}banner {title}')

        self.stdout.write(self.style.SUCCESS('Seed sitecontent xong.'))
