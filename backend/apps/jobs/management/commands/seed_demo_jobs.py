import random
from datetime import timedelta

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.utils import timezone
from django.utils.text import slugify

from apps.employers.models import EmployerProfile, Industry
from apps.jobs.models import Job, JobCategory
from apps.locations.models import Location

User = get_user_model()
DEMO_DOMAIN = '@demo.local'

COMPANIES = [
    ('FPT Software', '1000+ nhân viên', 'Công nghệ thông tin'),
    ('Viettel Solutions', '1000+ nhân viên', 'Công nghệ - Viễn thông'),
    ('VNG Corporation', '1000+ nhân viên', 'Công nghệ thông tin'),
    ('Ngân hàng Techcombank', '1000+ nhân viên', 'Tài chính - Ngân hàng'),
    ('Công ty CP MoMo', '500-1000 nhân viên', 'Fintech'),
    ('Shopee Việt Nam', '1000+ nhân viên', 'Thương mại điện tử'),
    ('Tập đoàn Vingroup', '1000+ nhân viên', 'Đa ngành'),
    ('Công ty TNHH Quanta', '1000+ nhân viên', 'Sản xuất - Điện tử'),
]

# top-level category name -> list of job titles
JOBS_BY_CATEGORY = {
    'Công nghệ thông tin': [
        'Lập trình viên Backend (Java/Python)', 'Lập trình viên Frontend ReactJS',
        'Kỹ sư DevOps', 'Kỹ sư AI/Machine Learning', 'Nhân viên kiểm thử phần mềm (Tester)',
        'Lập trình viên Mobile (Flutter)',
    ],
    'Kinh doanh/Bán hàng': [
        'Nhân viên kinh doanh B2B', 'Trưởng phòng kinh doanh', 'Nhân viên telesales',
        'Chuyên viên tư vấn bán hàng', 'Sales Executive',
    ],
    'Marketing/PR/Quảng cáo': [
        'Chuyên viên Digital Marketing', 'Content Marketing', 'Nhân viên SEO',
        'Trưởng nhóm truyền thông',
    ],
    'Kế toán/Kiểm toán/Thuế': [
        'Kế toán tổng hợp', 'Kế toán thuế', 'Chuyên viên kiểm toán nội bộ',
    ],
    'Nhân sự/Hành chính/Pháp chế': [
        'Chuyên viên tuyển dụng', 'Nhân viên hành chính nhân sự', 'HR Business Partner',
    ],
    'Chăm sóc khách hàng': [
        'Nhân viên chăm sóc khách hàng', 'Tổng đài viên', 'Chuyên viên vận hành dịch vụ',
    ],
    'Thiết kế/Sáng tạo': [
        'Thiết kế đồ hoạ (Graphic Designer)', 'UI/UX Designer', 'Nhân viên dựng phim',
    ],
    'Lao động phổ thông': [
        'Công nhân sản xuất', 'Nhân viên kho', 'Nhân viên giao hàng',
    ],
}

WORK_TYPES = ['onsite', 'hybrid', 'remote']
EMP_TYPES = ['full_time', 'full_time', 'full_time', 'part_time', 'internship']
EXP_LEVELS = ['fresher', 'junior', 'junior', 'middle', 'senior']
EDU_LEVELS = ['none', 'high_school', 'college', 'university', 'university']


class Command(BaseCommand):
    help = 'Seed demo companies + active jobs (spread over recent days) for the homepage dashboard/demo. Re-runnable.'

    def add_arguments(self, parser):
        parser.add_argument('--clear', action='store_true', help='Only remove demo data, do not reseed.')

    def handle(self, *args, **options):
        removed = User.objects.filter(email__endswith=DEMO_DOMAIN).delete()[0]
        self.stdout.write(f'Removed old demo data ({removed} rows).')
        if options['clear']:
            self.stdout.write(self.style.SUCCESS('Demo data cleared.'))
            return

        provinces = list(Location.objects.filter(level='province', name__in=[
            'Thành phố Hà Nội', 'Thành phố Hồ Chí Minh', 'Thành phố Đà Nẵng',
            'Thành phố Hải Phòng', 'Tỉnh Bắc Ninh', 'Tỉnh Hưng Yên',
        ]))
        if not provinces:
            provinces = list(Location.objects.filter(level='province')[:6])

        top_cats = {c.name: c for c in JobCategory.objects.filter(parent__isnull=True)}
        children_of = {}
        for name, cat in top_cats.items():
            children_of[name] = list(JobCategory.objects.filter(parent=cat, status='active')) or [cat]

        now = timezone.now()
        rnd = random.Random(42)
        companies = []
        for i, (cname, size, industry) in enumerate(COMPANIES):
            user = User.objects.create_user(
                email=f'company{i + 1}{DEMO_DOMAIN}', password='demo12345',
                role=User.Role.EMPLOYER, full_name=cname, status=User.Status.ACTIVE,
            )
            profile = EmployerProfile.objects.create(
                user=user, company_name=cname, slug=f'{slugify(cname)}-demo-{i + 1}',
                company_size=size,
                status=EmployerProfile.Status.APPROVED, verified_at=now,
            )
            # industries là M2M (1.14e) nên set sau khi tạo profile.
            industry_obj, _ = Industry.objects.get_or_create(name=industry)
            profile.industries.set([industry_obj])
            companies.append((user, profile))

        job_count = 0
        day_slots = list(range(0, 12))  # spread published_at over last 12 days
        for cat_name, titles in JOBS_BY_CATEGORY.items():
            for title in titles:
                user, profile = rnd.choice(companies)
                category = rnd.choice(children_of.get(cat_name, [None]))
                smin = rnd.choice([8, 10, 12, 15, 18, 20]) * 1_000_000
                smax = smin + rnd.choice([5, 8, 10, 15]) * 1_000_000
                days_ago = rnd.choice(day_slots)
                published = now - timedelta(days=days_ago, hours=rnd.randint(0, 23))
                # Hạng tin + nhãn demo: tỉ lệ mô phỏng danh sách thật (đa số tin thường,
                # một ít nổi bật/TOP) để trang danh sách thể hiện đủ các biến thể card.
                tier = rnd.choices(
                    [Job.Tier.STANDARD, Job.Tier.FEATURED, Job.Tier.TOP],
                    weights=[65, 25, 10],
                )[0]
                job = Job.objects.create(
                    employer=user, employer_profile=profile, category=category,
                    title=title,
                    short_description=f'{title} tại {profile.company_name}.',
                    description=(
                        f'{profile.company_name} đang tuyển {title}.\n\n'
                        'Mô tả công việc: tham gia trực tiếp vào các dự án của công ty, '
                        'phối hợp cùng đội nhóm để hoàn thành mục tiêu chung.'
                    ),
                    requirements='Tốt nghiệp đúng chuyên ngành, có tinh thần trách nhiệm và ham học hỏi.',
                    benefits='Lương thưởng hấp dẫn, review lương định kỳ, môi trường trẻ trung năng động.',
                    work_type=rnd.choice(WORK_TYPES),
                    employment_type=rnd.choice(EMP_TYPES),
                    experience_level=rnd.choice(EXP_LEVELS),
                    education_level=rnd.choice(EDU_LEVELS),
                    number_of_vacancies=rnd.choice([1, 2, 3, 5, 10]),
                    salary_min=smin, salary_max=smax,
                    tier=tier,
                    is_hot=rnd.random() < 0.18,
                    is_urgent=rnd.random() < 0.18,
                    has_flash_badge=rnd.random() < 0.3,
                    deadline=(published + timedelta(days=rnd.choice([7, 15, 30, 45]))).date(),
                    status=Job.Status.ACTIVE, published_at=published,
                )
                job.locations.set(rnd.sample(provinces, rnd.randint(1, min(3, len(provinces)))))
                job_count += 1

        self.stdout.write(self.style.SUCCESS(
            f'Seeded {len(companies)} demo companies and {job_count} active jobs.'
        ))
