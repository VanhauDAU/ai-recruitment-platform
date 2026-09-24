from django.core.management.base import BaseCommand
from django.db import transaction

from apps.services.models import ServiceCapability, ServiceCategory, ServicePackage
from apps.services.services import create_package_version_draft

LEGACY_PACKAGE_SLUGS = (
    'top-max',
    'top-max-plus',
    'top-eco-plus',
    'combo-starter',
    'combo-growth',
    'ai-cv-screening',
    'ai-matching-credits',
    'branding-banner',
    'branding-top-employer',
    'job-refresh',
    'urgent-tag',
)
LEGACY_CATEGORY_KEYS = ('featured-jobs', 'combo', 'ai-credits', 'branding', 'addons')

PILOT_PRODUCTS = (
    {
        'category': ('job-promotion', 'Gói tăng hiệu quả'),
        'slug': 'priority-14-days',
        'name': 'Ưu tiên',
        'tagline': 'Tiếp cận tốt hơn trong các vị trí tài trợ phù hợp',
        'price': 299_000,
        'unit': '/ 1 tin · 14 ngày',
        'benefits': [
            'Hiển thị tại vị trí tài trợ khi phù hợp',
            'Nền cam nhạt và nhãn Tài trợ minh bạch',
            '2 lượt làm mới không đổi ngày đăng gốc',
        ],
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
        'unit': '/ 1 tin · 14 ngày',
        'benefits': [
            'Nền xanh và nhãn Tài trợ minh bạch',
            'Đủ điều kiện tham gia Việc làm tốt nhất',
            '4 lượt làm mới và tối đa 1 Job Alert',
        ],
        'badge': 'Phổ biến',
        'highlight': True,
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
        'unit': '/ 1 tin · 28 ngày',
        'benefits': [
            'Phân phối tài trợ có kiểm soát theo độ phù hợp',
            'Nền xanh nổi bật và 12 lượt làm mới',
            'Tối đa 2 Job Alert tới ứng viên đã đăng ký nhận',
        ],
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
        'unit': '/ 1 tin · 7 ngày',
        'benefits': [
            'Nhãn GẤP có thời hạn rõ ràng',
            'Chỉ dùng cho tin đang chủ động tuyển',
        ],
        'items': (('urgent_label', 1, 7, {}),),
    },
    {
        'category': ('job-add-ons', 'Dịch vụ bổ trợ'),
        'slug': 'job-refresh-once',
        'name': 'Làm mới tin',
        'tagline': 'Một lượt làm mới không thay đổi ngày đăng gốc',
        'price': 49_000,
        'unit': '/ 1 lượt',
        'benefits': [
            'Ghi nhận lượt làm mới riêng',
            'Không reset vòng đời hoặc ngày đăng gốc',
        ],
        'items': (('job_refresh', 1, None, {}),),
    },
    {
        'category': ('job-add-ons', 'Dịch vụ bổ trợ'),
        'slug': 'saved-remarketing-14-days',
        'name': 'Remarketing tin đã lưu',
        'tagline': 'Hiển thị lại có kiểm soát cho ứng viên đã lưu tin',
        'price': 299_000,
        'unit': '/ 1 tin · 14 ngày',
        'benefits': [
            'Hiển thị lại trong lane Việc bạn đã quan tâm',
            'Có giới hạn tần suất và tuân thủ consent',
        ],
        'items': (('saved_remarketing', 1, 14, {}),),
    },
)


class Command(BaseCommand):
    help = 'Đồng bộ catalog pilot, dọn mẫu cũ; không tự phát hành phiên bản.'

    def _cleanup_legacy_catalog(self):
        deleted_packages = archived_packages = deleted_categories = 0
        for package in ServicePackage.objects.filter(slug__in=LEGACY_PACKAGE_SLUGS):
            if package.versions.exists():
                if package.is_active:
                    package.is_active = False
                    package.save(update_fields=['is_active', 'updated_at'])
                archived_packages += 1
            else:
                package.delete()
                deleted_packages += 1
        for category in ServiceCategory.objects.filter(key__in=LEGACY_CATEGORY_KEYS):
            if category.packages.exists():
                if category.is_active:
                    category.is_active = False
                    category.save(update_fields=['is_active'])
            else:
                category.delete()
                deleted_categories += 1
        return deleted_packages, archived_packages, deleted_categories

    @transaction.atomic
    def handle(self, *args, **options):
        deleted_packages, archived_packages, deleted_categories = self._cleanup_legacy_catalog()
        categories = {}
        category_metadata = {
            'job-promotion': {
                'description_vi': (
                    'Các gói tăng khả năng tiếp cận nhưng vẫn ưu tiên độ phù hợp ứng viên.'
                ),
                'icon': 'ThunderboltOutlined',
            },
            'job-add-ons': {
                'description_vi': 'Quyền lợi bổ trợ có số lượt và thời hạn minh bạch.',
                'icon': 'PlusCircleOutlined',
            },
        }
        for order, (key, name) in enumerate(
            dict(product['category'] for product in PILOT_PRODUCTS).items()
        ):
            category, _ = ServiceCategory.objects.get_or_create(
                key=key,
                defaults={
                    'name_vi': name,
                    **category_metadata[key],
                    'order': order,
                    'is_active': True,
                },
            )
            category_updates = []
            for field, value in category_metadata[key].items():
                if not getattr(category, field):
                    setattr(category, field, value)
                    category_updates.append(field)
            if category_updates:
                category.save(update_fields=category_updates)
            categories[key] = category

        created_versions = 0
        for order, product in enumerate(PILOT_PRODUCTS):
            package, created = ServicePackage.objects.get_or_create(
                slug=product['slug'],
                defaults={
                    'category': categories[product['category'][0]],
                    'name_vi': product['name'],
                    'tagline_vi': product['tagline'],
                    'price': product['price'],
                    'currency': 'VND',
                    'unit_vi': product['unit'],
                    'benefits_vi': product['benefits'],
                    'badge_vi': product.get('badge', ''),
                    'is_highlight': product.get('highlight', False),
                    'cta_type': ServicePackage.CtaType.CONTACT,
                    'order': order,
                    'is_active': True,
                },
            )
            if not created:
                package_updates = []
                blank_defaults = {
                    'unit_vi': product['unit'],
                    'benefits_vi': product['benefits'],
                    'badge_vi': product.get('badge', ''),
                }
                for field, value in blank_defaults.items():
                    if value and not getattr(package, field):
                        setattr(package, field, value)
                        package_updates.append(field)
                if package_updates:
                    package.save(update_fields=[*package_updates, 'updated_at'])
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
                f'Đã đồng bộ {len(PILOT_PRODUCTS)} sản phẩm; tạo {created_versions} bản nháp; '
                f'xóa {deleted_packages} gói mẫu và {deleted_categories} danh mục mẫu; '
                f'lưu trữ {archived_packages} gói đã có lịch sử.'
            )
        )
