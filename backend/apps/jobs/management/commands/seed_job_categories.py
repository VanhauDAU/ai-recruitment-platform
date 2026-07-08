from django.core.management.base import BaseCommand

from apps.jobs.models import JobCategory

# 3-level taxonomy: nhóm nghề -> nghề -> vị trí chuyên môn
SEED_CATEGORIES = {
    'Kinh doanh/Bán hàng': {
        'Sales Xuất nhập khẩu/Logistics': ['Sales Logistics', 'Sales Xuất nhập khẩu khác'],
        'Sales Bất động sản': ['Môi giới bất động sản', 'Sales Bất động sản khác'],
        'Sales Xây dựng': ['Kinh doanh thiết bị/vật liệu xây dựng', 'Kinh doanh nội thất', 'Tư vấn thiết kế xây dựng'],
        'Sales Giáo dục/Khoá học': ['Tư vấn tuyển sinh/khoá học', 'Tư vấn du học/định cư'],
        'Nhân viên kinh doanh': ['Telesales', 'Sales Admin', 'Sales Online'],
    },
    'Marketing/PR/Quảng cáo': {
        'Digital Marketing': ['SEO/SEM', 'Quảng cáo Facebook/Google'],
        'Content': ['Content Marketing', 'Copywriter'],
        'PR/Truyền thông': ['Quan hệ công chúng', 'Tổ chức sự kiện'],
    },
    'Chăm sóc khách hàng': {
        'CSKH/Vận hành': ['Nhân viên CSKH', 'Tổng đài viên', 'Trực page'],
    },
    'Nhân sự/Hành chính/Pháp chế': {
        'Nhân sự': ['Tuyển dụng', 'C&B', 'Đào tạo'],
        'Hành chính': ['Hành chính văn phòng', 'Lễ tân', 'Thư ký/Trợ lý'],
        'Pháp chế': ['Pháp chế doanh nghiệp', 'Luật sư'],
    },
    'Công nghệ thông tin': {
        'Lập trình Web': ['Frontend Developer', 'Backend Developer', 'Fullstack Developer'],
        'Lập trình Mobile': ['Android Developer', 'iOS Developer', 'React Native/Flutter'],
        'Data/AI': ['Data Analyst', 'Data Engineer', 'AI/Machine Learning Engineer'],
        'DevOps/System': ['DevOps Engineer', 'System Admin', 'Cloud Engineer'],
        'Kiểm thử/QA': ['Manual Tester', 'Automation Tester'],
        'IT Support': ['IT Helpdesk', 'IT phần cứng/mạng'],
    },
    'Kế toán/Kiểm toán/Thuế': {
        'Kế toán': ['Kế toán tổng hợp', 'Kế toán nội bộ', 'Kế toán công nợ'],
        'Kiểm toán/Thuế': ['Kiểm toán nội bộ', 'Chuyên viên thuế'],
    },
    'Thiết kế/Sáng tạo': {
        'Thiết kế': ['UI/UX Designer', 'Graphic Designer', 'Thiết kế nội thất'],
        'Media': ['Video Editor', 'Photographer'],
    },
    'Lao động phổ thông': {
        'Sản xuất/Kho vận': ['Công nhân sản xuất', 'Nhân viên kho', 'Đóng gói'],
        'Dịch vụ': ['Lái xe/Giao hàng', 'Bảo vệ', 'Tạp vụ'],
    },
}


class Command(BaseCommand):
    help = 'Seed job_categories with a 3-level taxonomy (nhóm nghề -> nghề -> vị trí chuyên môn).'

    def handle(self, *args, **options):
        count = 0
        seen = []
        for group_name, jobs in SEED_CATEGORIES.items():
            group, created = JobCategory.objects.update_or_create(
                name=group_name, defaults={'parent': None, 'status': JobCategory.Status.ACTIVE},
            )
            count += created
            seen.append(group_name)
            for job_name, positions in jobs.items():
                job, created = JobCategory.objects.update_or_create(
                    name=job_name, defaults={'parent': group, 'status': JobCategory.Status.ACTIVE},
                )
                count += created
                seen.append(job_name)
                for pos_name in positions:
                    _, created = JobCategory.objects.update_or_create(
                        name=pos_name, defaults={'parent': job, 'status': JobCategory.Status.ACTIVE},
                    )
                    count += created
                    seen.append(pos_name)
        # Retire leftovers from older seeds so the public tree stays clean.
        retired = JobCategory.objects.exclude(name__in=seen).update(status=JobCategory.Status.INACTIVE)
        self.stdout.write(self.style.SUCCESS(f'Seeded: {count} created, {retired} retired.'))
