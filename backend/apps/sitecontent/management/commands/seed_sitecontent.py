from django.core.management.base import BaseCommand

from apps.sitecontent.models import Banner, LinkGroup, LinkItem, SiteSetting

# Cấu hình mẫu để trang chạy ngay; admin chỉnh/thêm sau qua trang quản trị.
SETTINGS = [
    ('site_name', 'Tên site', SiteSetting.Group.GENERAL, 'AI Career Coach'),
    ('hotline', 'Hotline hỗ trợ', SiteSetting.Group.CONTACT, '1900 1234'),
    ('support_email', 'Email hỗ trợ', SiteSetting.Group.CONTACT, 'support@aicareercoach.vn'),
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
        for key, label, group, value in SETTINGS:
            _, created = SiteSetting.objects.get_or_create(
                key=key, defaults={'label': label, 'group': group, 'value': value}
            )
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
