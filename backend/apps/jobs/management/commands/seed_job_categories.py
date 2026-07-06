from django.core.management.base import BaseCommand

from apps.jobs.models import JobCategory

# parent name -> list of child category names
SEED_CATEGORIES = {
    'Kinh doanh/Bán hàng': [
        'Nhân viên kinh doanh',
        'Nhân viên bán hàng',
        'Nhân viên tư vấn',
        'Telesales',
        'Sales Admin',
        'Bất động sản/Môi giới',
    ],
    'Marketing/PR/Quảng cáo': [
        'Digital Marketing',
        'SEO/SEM',
        'Content Marketing',
        'PR/Truyền thông',
        'Brand Marketing',
    ],
    'Chăm sóc khách hàng': [
        'Nhân viên chăm sóc khách hàng',
        'Tổng đài viên',
        'Quản lý dịch vụ khách hàng',
    ],
    'Nhân sự/Hành chính/Pháp chế': [
        'Nhân sự tổng hợp',
        'Tuyển dụng',
        'Hành chính văn phòng',
        'Pháp chế/Luật',
    ],
    'Công nghệ thông tin': [
        'Lập trình Web (Frontend/Backend)',
        'Lập trình Mobile',
        'Data/AI/Machine Learning',
        'DevOps/Cloud',
        'Tester/QA',
        'IT Support/Helpdesk',
    ],
    'Kế toán/Kiểm toán/Thuế': [
        'Kế toán',
        'Kiểm toán',
        'Thuế',
    ],
    'Thiết kế/Sáng tạo': [
        'Thiết kế UI/UX',
        'Thiết kế đồ họa',
        'Dựng phim/Video',
    ],
    'Lao động phổ thông': [
        'Công nhân sản xuất',
        'Lái xe/Giao hàng',
        'Bảo vệ',
        'Tạp vụ',
    ],
}


class Command(BaseCommand):
    help = 'Seed the job_categories table with a 2-level taxonomy (parent industries + child roles).'

    def handle(self, *args, **options):
        created, updated = 0, 0
        for parent_name, children in SEED_CATEGORIES.items():
            parent, was_created = JobCategory.objects.update_or_create(
                name=parent_name,
                defaults={'parent': None, 'status': JobCategory.Status.ACTIVE},
            )
            created += was_created
            updated += not was_created
            for child_name in children:
                _, child_created = JobCategory.objects.update_or_create(
                    name=child_name,
                    defaults={'parent': parent, 'status': JobCategory.Status.ACTIVE},
                )
                created += child_created
                updated += not child_created
        self.stdout.write(self.style.SUCCESS(f'Job categories seeded: {created} created, {updated} updated.'))
