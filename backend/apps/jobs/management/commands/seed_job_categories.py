from django.core.management.base import BaseCommand

from apps.jobs.models import JobCategory, JobCategoryLocalization

# 3-level taxonomy: nhóm nghề -> nghề -> vị trí chuyên môn
SEED_CATEGORIES = {
    'Kinh doanh/Bán hàng': {
        'Sales Xuất nhập khẩu/Logistics': ['Sales Logistics', 'Sales Xuất nhập khẩu khác'],
        'Sales Bất động sản': ['Môi giới bất động sản', 'Sales Bất động sản khác'],
        'Sales Xây dựng': [
            'Kinh doanh thiết bị/vật liệu xây dựng',
            'Kinh doanh nội thất',
            'Tư vấn thiết kế xây dựng',
        ],
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

# Baseline editorial data for the four CV preview languages. Production
# changes are managed in Django admin; get_or_create below never overwrites an
# administrator's reviewed wording.
POSITION_LOCALIZATIONS = {
    'AI/Machine Learning Engineer': {
        'en-US': 'AI/Machine Learning Engineer',
    },
    'Android Developer': {
        'en-US': 'Android Developer',
    },
    'Automation Tester': {
        'en-US': 'Automation Tester',
    },
    'Backend Developer': {
        'en-US': 'Backend Developer',
    },
    'Bảo vệ': {'en-US': 'Security Guard'},
    'C&B': {
        'en-US': 'Compensation & Benefits Specialist',
    },
    'Chuyên viên thuế': {
        'en-US': 'Tax Specialist',
    },
    'Cloud Engineer': {
        'en-US': 'Cloud Engineer',
    },
    'Công nhân sản xuất': {
        'en-US': 'Production Worker',
    },
    'Content Marketing': {
        'en-US': 'Content Marketing Specialist',
    },
    'Copywriter': {'en-US': 'Copywriter'},
    'Đào tạo': {'en-US': 'Training Specialist'},
    'Data Analyst': {'en-US': 'Data Analyst'},
    'Data Engineer': {'en-US': 'Data Engineer'},
    'DevOps Engineer': {
        'en-US': 'DevOps Engineer',
    },
    'Đóng gói': {'en-US': 'Packing Worker'},
    'Frontend Developer': {
        'en-US': 'Frontend Developer',
    },
    'Fullstack Developer': {
        'en-US': 'Fullstack Developer',
    },
    'Graphic Designer': {
        'en-US': 'Graphic Designer',
    },
    'Hành chính văn phòng': {
        'en-US': 'Office Administrator',
    },
    'iOS Developer': {'en-US': 'iOS Developer'},
    'IT Helpdesk': {
        'en-US': 'IT Helpdesk Specialist',
    },
    'IT phần cứng/mạng': {
        'en-US': 'IT Hardware/Network Specialist',
    },
    'Kế toán công nợ': {
        'en-US': 'Accounts Receivable/Payable Accountant',
    },
    'Kế toán nội bộ': {
        'en-US': 'Internal Accountant',
    },
    'Kế toán tổng hợp': {
        'en-US': 'General Accountant',
    },
    'Kiểm toán nội bộ': {
        'en-US': 'Internal Auditor',
    },
    'Kinh doanh nội thất': {
        'en-US': 'Interior Sales Specialist',
    },
    'Kinh doanh thiết bị/vật liệu xây dựng': {
        'en-US': 'Construction Equipment/Materials Sales',
    },
    'Lái xe/Giao hàng': {
        'en-US': 'Driver/Delivery Staff',
    },
    'Lễ tân': {'en-US': 'Receptionist'},
    'Luật sư': {'en-US': 'Lawyer'},
    'Manual Tester': {'en-US': 'Manual Tester'},
    'Môi giới bất động sản': {
        'en-US': 'Real Estate Broker',
    },
    'Nhân viên CSKH': {
        'en-US': 'Customer Service Representative',
    },
    'Nhân viên kho': {'en-US': 'Warehouse Staff'},
    'Pháp chế doanh nghiệp': {
        'en-US': 'Corporate Legal Specialist',
    },
    'Photographer': {'en-US': 'Photographer'},
    'Quan hệ công chúng': {
        'en-US': 'Public Relations Specialist',
    },
    'Quảng cáo Facebook/Google': {
        'en-US': 'Facebook/Google Ads Specialist',
    },
    'React Native/Flutter': {
        'en-US': 'React Native/Flutter Developer',
    },
    'Sales Admin': {'en-US': 'Sales Administrator'},
    'Sales Bất động sản khác': {
        'en-US': 'Other Real Estate Sales',
    },
    'Sales Logistics': {
        'en-US': 'Logistics Sales Specialist',
    },
    'Sales Online': {
        'en-US': 'Online Sales Specialist',
    },
    'Sales Xuất nhập khẩu khác': {
        'en-US': 'Other Import-Export Sales',
    },
    'SEO/SEM': {'en-US': 'SEO/SEM Specialist'},
    'System Admin': {
        'en-US': 'System Administrator',
    },
    'Tạp vụ': {'en-US': 'Cleaner'},
    'Telesales': {
        'en-US': 'Telesales Representative',
    },
    'Thiết kế nội thất': {
        'en-US': 'Interior Designer',
    },
    'Thư ký/Trợ lý': {
        'en-US': 'Secretary/Assistant',
    },
    'Tổ chức sự kiện': {
        'en-US': 'Event Coordinator',
    },
    'Tổng đài viên': {
        'en-US': 'Call Center Agent',
    },
    'Trực page': {
        'en-US': 'Social Media Page Operator',
    },
    'Tư vấn du học/định cư': {
        'en-US': 'Study Abroad/Immigration Consultant',
    },
    'Tư vấn thiết kế xây dựng': {
        'en-US': 'Construction Design Consultant',
    },
    'Tư vấn tuyển sinh/khoá học': {
        'en-US': 'Admissions/Course Consultant',
    },
    'Tuyển dụng': {'en-US': 'Recruitment Specialist'},
    'UI/UX Designer': {
        'en-US': 'UI/UX Designer',
    },
    'Video Editor': {'en-US': 'Video Editor'},
}


class Command(BaseCommand):
    help = 'Seed job_categories with a 3-level taxonomy (nhóm nghề -> nghề -> vị trí chuyên môn).'

    def handle(self, *args, **options):
        count = 0
        seen = []
        for group_name, jobs in SEED_CATEGORIES.items():
            group, created = JobCategory.objects.update_or_create(
                name=group_name,
                defaults={
                    'parent': None,
                    'category_type': JobCategory.CategoryType.OCCUPATION_GROUP,
                    'status': JobCategory.Status.ACTIVE,
                },
            )
            count += created
            seen.append(group_name)
            for job_name, positions in jobs.items():
                job, created = JobCategory.objects.update_or_create(
                    name=job_name,
                    defaults={
                        'parent': group,
                        'category_type': JobCategory.CategoryType.DOMAIN,
                        'status': JobCategory.Status.ACTIVE,
                    },
                )
                count += created
                seen.append(job_name)
                for pos_name in positions:
                    position, created = JobCategory.objects.update_or_create(
                        name=pos_name,
                        defaults={
                            'parent': job,
                            'category_type': JobCategory.CategoryType.SPECIALIZATION,
                            'status': JobCategory.Status.ACTIVE,
                        },
                    )
                    count += created
                    seen.append(pos_name)
                    JobCategoryLocalization.objects.get_or_create(
                        category=position,
                        locale=JobCategoryLocalization.Locale.VI,
                        defaults={'display_name': pos_name, 'is_active': True},
                    )
                    for locale, display_name in POSITION_LOCALIZATIONS[pos_name].items():
                        JobCategoryLocalization.objects.get_or_create(
                            category=position,
                            locale=locale,
                            defaults={'display_name': display_name, 'is_active': True},
                        )
        # Retire leftovers from older seeds so the public tree stays clean.
        retired = JobCategory.objects.exclude(name__in=seen).update(
            status=JobCategory.Status.INACTIVE
        )
        self.stdout.write(self.style.SUCCESS(f'Seeded: {count} created, {retired} retired.'))
