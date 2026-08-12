from django.core.management.base import BaseCommand
from django.db import transaction

from apps.services.models import ServiceCapability, ServiceCategory, ServicePackage
from apps.services.services import create_package_version_draft

PILOT_PRODUCTS = (
    {
        'category': ('job-promotion', 'Gói tăng hiệu quả'),
        'slug': 'priority-14-days',
        'name': 'Ưu tiên',
        'tagline': 'Tiếp cận tốt hơn trong các vị trí tài trợ phù hợp',
        'price': 299_000,
        'items': (
            ('sponsored_placement', 1, 14, {'placement': 'search_sponsored'}),
            ('card_tone', 1, 14, {'tone': 'orange'}),
            ('job_refresh', 2, None, {}),
        ),
    },
    {
        'category': ('job-promotion', 'Gói tăng hiệu quả'),
        'slug': 'featured-14-days',
        'name': 'Nổi bật',
        'tagline': 'Nền xanh và đủ điều kiện tham gia Việc làm tốt nhất',
        'price': 799_000,
        'items': (
            ('sponsored_placement', 1, 14, {'placement': 'best_jobs_eligible'}),
            ('card_tone', 1, 14, {'tone': 'green'}),
            ('job_refresh', 4, None, {}),
            ('job_alert', 1, None, {}),
        ),
    },
    {
        'category': ('job-promotion', 'Gói tăng hiệu quả'),
        'slug': 'accelerate-28-days',
        'name': 'Tăng tốc',
        'tagline': 'Chiến dịch 28 ngày cho vị trí cần độ phủ cao',
        'price': 1_690_000,
        'items': (
            ('sponsored_placement', 1, 28, {'placement': 'best_jobs_eligible'}),
            ('card_tone', 1, 28, {'tone': 'green_strong'}),
            ('job_refresh', 12, None, {}),
            ('job_alert', 2, None, {}),
        ),
    },
    {
        'category': ('job-add-ons', 'Dịch vụ bổ trợ'),
        'slug': 'urgent-label-7-days',
        'name': 'Nhãn GẤP',
        'tagline': 'Cho biết doanh nghiệp đang chủ động tuyển gấp',
        'price': 99_000,
        'items': (('urgent_label', 1, 7, {}),),
    },
    {
        'category': ('job-add-ons', 'Dịch vụ bổ trợ'),
        'slug': 'job-refresh-once',
        'name': 'Làm mới tin',
        'tagline': 'Một lượt làm mới không thay đổi ngày đăng gốc',
        'price': 49_000,
        'items': (('job_refresh', 1, None, {}),),
    },
    {
        'category': ('job-add-ons', 'Dịch vụ bổ trợ'),
        'slug': 'saved-remarketing-14-days',
        'name': 'Remarketing tin đã lưu',
        'tagline': 'Hiển thị lại có kiểm soát cho ứng viên đã lưu tin',
        'price': 299_000,
        'items': (('saved_remarketing', 1, 14, {}),),
    },
)


class Command(BaseCommand):
    help = 'Tạo catalog pilot và phiên bản nháp có cấu trúc; không tự phát hành.'

    @transaction.atomic
    def handle(self, *args, **options):
        categories = {}
        for order, (key, name) in enumerate(
            dict(product['category'] for product in PILOT_PRODUCTS).items()
        ):
            category, _ = ServiceCategory.objects.update_or_create(
                key=key,
                defaults={
                    'name_vi': name,
                    'order': order,
                    'is_active': True,
                },
            )
            categories[key] = category

        created_versions = 0
        for order, product in enumerate(PILOT_PRODUCTS):
            package, _ = ServicePackage.objects.update_or_create(
                slug=product['slug'],
                defaults={
                    'category': categories[product['category'][0]],
                    'name_vi': product['name'],
                    'tagline_vi': product['tagline'],
                    'price': product['price'],
                    'currency': 'VND',
                    'cta_type': ServicePackage.CtaType.CONTACT,
                    'order': order,
                    'is_active': True,
                },
            )
            if package.versions.exists():
                continue
            items = [
                {
                    'capability': ServiceCapability.objects.get(code=code),
                    'quantity': quantity,
                    'duration_days': duration_days,
                    'configuration': configuration,
                    'order': item_order,
                }
                for item_order, (code, quantity, duration_days, configuration) in enumerate(
                    product['items']
                )
            ]
            create_package_version_draft(
                package=package,
                values={
                    'price': product['price'],
                    'currency': 'VND',
                    'activate_within_days': 90,
                    'terms_vi': 'Mỗi lượt áp dụng cho một tin; phải bắt đầu dùng trong 90 ngày.',
                },
                items=items,
            )
            created_versions += 1

        self.stdout.write(
            self.style.SUCCESS(
                f'Đã đồng bộ {len(PILOT_PRODUCTS)} sản phẩm; tạo {created_versions} bản nháp.'
            )
        )
