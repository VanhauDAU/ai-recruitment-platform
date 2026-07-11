import random
from datetime import timedelta

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.utils import timezone
from django.utils.text import slugify

from apps.employers.models import Company, Industry, RecruiterProfile
from apps.jobs.models import (
    Benefit,
    Job,
    JobBenefit,
    JobCategory,
    JobCategoryAssignment,
    JobLanguageRequirement,
    JobLocation,
    JobSkill,
    JobWorkSchedule,
    Language,
)
from apps.locations.models import Location
from apps.skills.models import Skill

User = get_user_model()
DEMO_DOMAIN = '@demo.local'

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

# Chỉ số công ty (trong COMPANIES) được bật trang thương hiệu: FPT, VNG, Shopee.
BRAND_COMPANY_INDEXES = {0, 2, 5}

WORK_TYPES = ['onsite', 'hybrid', 'remote']
EMP_TYPES = ['full_time', 'full_time', 'full_time', 'part_time', 'internship']
EXP_YEARS = ['none', 'under_1', '1', '2', '3', '5']
EDU_LEVELS = ['none', 'high_school', 'college', 'university', 'university']
# Chứng chỉ demo cho yêu cầu ngoại ngữ theo mã ngôn ngữ.
LANGUAGE_CERTIFICATES = {'en': 'TOEIC 600+', 'ko': 'TOPIK 2', 'ja': 'JLPT N3', 'zh': 'HSK 4'}


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

        benefits = list(Benefit.objects.filter(is_active=True))
        languages = list(Language.objects.filter(is_active=True))
        skills = list(Skill.objects.all())

        provinces = list(Location.objects.filter(level='province', name__in=[
            'Thành phố Hà Nội', 'Thành phố Hồ Chí Minh', 'Thành phố Đà Nẵng',
            'Thành phố Hải Phòng', 'Tỉnh Bắc Ninh', 'Tỉnh Hưng Yên',
        ]))
        if not provinces:
            provinces = list(Location.objects.filter(level='province')[:6])
        wards = list(Location.objects.filter(level='ward', parent__in=provinces).select_related('parent'))

        top_cats = {c.name: c for c in JobCategory.objects.filter(parent__isnull=True)}
        children_of = {}
        for name, cat in top_cats.items():
            domains = list(JobCategory.objects.filter(parent=cat, status='active'))
            specializations = list(JobCategory.objects.filter(parent__in=domains, status='active'))
            children_of[name] = specializations or domains or [cat]

        now = timezone.now()
        rnd = random.Random(42)
        companies = []
        for i, (cname, size, industry) in enumerate(COMPANIES):
            user = User.objects.create_user(
                email=f'company{i + 1}{DEMO_DOMAIN}', password='demo12345',
                role=User.Role.EMPLOYER, full_name=cname, status=User.Status.ACTIVE,
            )
            company = Company.objects.create(
                company_name=cname, slug=f'{slugify(cname)}-demo-{i + 1}',
                company_size=size,
                # Vài công ty lớn bật trang thương hiệu để demo luồng URL /brand/...
                has_brand_page=i in BRAND_COMPANY_INDEXES,
                verification_status=Company.VerificationStatus.VERIFIED, verified_at=now,
                created_by=user,
            )
            industry_obj, _ = Industry.objects.get_or_create(name=industry)
            company.company_industries.create(industry=industry_obj, is_primary=True)
            RecruiterProfile.objects.create(
                user=user, company=company,
                company_role=RecruiterProfile.CompanyRole.OWNER,
                membership_status=RecruiterProfile.MembershipStatus.APPROVED,
            )
            companies.append((user, company))

        job_count = 0
        day_slots = list(range(0, 12))  # spread published_at over last 12 days
        for cat_name, titles in JOBS_BY_CATEGORY.items():
            for title in titles:
                user, company = rnd.choice(companies)
                category = rnd.choice(children_of.get(cat_name, [None]))
                # ~20% tin lương thỏa thuận để trang chi tiết thể hiện đủ biến thể lương.
                if rnd.random() < 0.2:
                    salary_type, smin, smax = Job.SalaryType.NEGOTIABLE, None, None
                else:
                    salary_type = Job.SalaryType.RANGE
                    smin = rnd.choice([8, 10, 12, 15, 18, 20]) * 1_000_000
                    smax = smin + rnd.choice([5, 8, 10, 15]) * 1_000_000
                if rnd.random() < 0.3:
                    age_min, age_max = rnd.choice([18, 20, 22]), rnd.choice([30, 35, 40])
                else:
                    age_min = age_max = None
                gender = rnd.choice(['male', 'female']) if rnd.random() < 0.2 else 'any'
                work_type = rnd.choice(WORK_TYPES)
                days_ago = rnd.choice(day_slots)
                published = now - timedelta(days=days_ago, hours=rnd.randint(0, 23))
                # Hạng tin + nhãn demo: tỉ lệ mô phỏng danh sách thật (đa số tin thường,
                # một ít nổi bật/TOP) để trang danh sách thể hiện đủ các biến thể card.
                tier = rnd.choices(
                    [Job.Tier.STANDARD, Job.Tier.FEATURED, Job.Tier.TOP],
                    weights=[65, 25, 10],
                )[0]
                job = Job.objects.create(
                    posted_by=user, company=company,
                    title=title,
                    description=(
                        f'{company.company_name} đang tuyển {title}.\n\n'
                        'Mô tả công việc: tham gia trực tiếp vào các dự án của công ty, '
                        'phối hợp cùng đội nhóm để hoàn thành mục tiêu chung.'
                    ),
                    requirements='Tốt nghiệp đúng chuyên ngành, có tinh thần trách nhiệm và ham học hỏi.',
                    benefits='Lương thưởng hấp dẫn, review lương định kỳ, môi trường trẻ trung năng động.',
                    work_type=work_type,
                    employment_type=rnd.choice(EMP_TYPES),
                    experience_years=rnd.choice(EXP_YEARS),
                    education_level=rnd.choice(EDU_LEVELS),
                    gender_requirement=gender,
                    age_min=age_min, age_max=age_max,
                    number_of_vacancies=rnd.choice([1, 2, 3, 5, 10]),
                    salary_type=salary_type, salary_min=smin, salary_max=smax,
                    tier=tier,
                    is_hot=rnd.random() < 0.18,
                    is_urgent=rnd.random() < 0.18,
                    has_flash_badge=rnd.random() < 0.3,
                    deadline=(published + timedelta(days=rnd.choice([7, 15, 30, 45]))).date(),
                    status=Job.Status.ACTIVE, published_at=published,
                )
                if category:
                    JobCategoryAssignment.objects.create(
                        job=job,
                        category=category,
                        role=JobCategoryAssignment.Role.PRIMARY_SPECIALIZATION,
                    )
                    # Chuyên môn thuộc một "kiến thức chuyên ngành" -> gắn thêm tag domain.
                    if category.parent and category.parent.category_type == JobCategory.CategoryType.DOMAIN:
                        JobCategoryAssignment.objects.create(
                            job=job,
                            category=category.parent,
                            role=JobCategoryAssignment.Role.DOMAIN_KNOWLEDGE,
                        )

                # Tin remote demo tối đa 1 văn phòng; tin thường 1-3 địa điểm.
                max_locations = 1 if work_type == 'remote' else min(3, len(wards))
                location_count = rnd.randint(0, max_locations) if work_type == 'remote' else rnd.randint(1, max_locations)
                selected_wards = rnd.sample(wards, location_count) if wards else []
                JobLocation.objects.bulk_create([
                    JobLocation(job=job, location=ward, address_detail=f'Tầng {rnd.randint(2, 15)}, tòa nhà số {rnd.randint(1, 200)} đường Trung Tâm')
                    for ward in selected_wards
                ])

                # 40% tin làm 2 ca để trang chi tiết render nhiều khung giờ.
                if rnd.random() < 0.4:
                    JobWorkSchedule.objects.create(
                        job=job, weekday_from=1, weekday_to=5,
                        start_time='06:00', end_time='14:00', note='Ca sáng', sort_order=0,
                    )
                    JobWorkSchedule.objects.create(
                        job=job, weekday_from=1, weekday_to=6,
                        start_time='14:00', end_time='22:00', note='Ca chiều', sort_order=1,
                    )
                else:
                    JobWorkSchedule.objects.create(
                        job=job, weekday_from=1, weekday_to=5,
                        start_time='08:00', end_time='17:30',
                    )
                if rnd.random() < 0.3:
                    job.work_schedule_note = 'Nghỉ trưa 1 tiếng; có thể đăng ký OT theo dự án.'
                    job.save(update_fields=['work_schedule_note'])

                JobBenefit.objects.bulk_create([
                    JobBenefit(job=job, benefit=benefit, sort_order=index)
                    for index, benefit in enumerate(rnd.sample(benefits, min(rnd.randint(3, 5), len(benefits))))
                ])
                # ~35% tin yêu cầu 1-2 ngoại ngữ (có chứng chỉ + mức ưu tiên) để test render.
                if languages and rnd.random() < 0.35:
                    for index, language in enumerate(rnd.sample(languages, rnd.randint(1, min(2, len(languages))))):
                        JobLanguageRequirement.objects.create(
                            job=job, language=language,
                            proficiency_level=rnd.choice(['basic', 'conversational', 'working', 'professional']),
                            certificate=LANGUAGE_CERTIFICATES.get(language.code, ''),
                            is_required=rnd.random() < 0.7,
                            sort_order=index,
                        )
                if skills:
                    JobSkill.objects.bulk_create([
                        JobSkill(
                            job=job, skill=skill,
                            importance=JobSkill.Importance.REQUIRED if rnd.random() < 0.7 else JobSkill.Importance.PREFERRED,
                        )
                        for skill in rnd.sample(skills, min(rnd.randint(2, 4), len(skills)))
                    ])
                job_count += 1

        self.stdout.write(self.style.SUCCESS(
            f'Seeded {len(companies)} demo companies and {job_count} active jobs.'
        ))
