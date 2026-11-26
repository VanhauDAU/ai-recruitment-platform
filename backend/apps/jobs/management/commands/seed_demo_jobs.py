import random
from datetime import timedelta
from io import BytesIO

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.files.base import ContentFile
from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone
from django.utils.html import escape
from django.utils.text import slugify
from PIL import Image, ImageDraw, ImageFont

from apps.employers.models import (
    Company,
    CompanyDocument,
    EmployerVerificationCase,
    Industry,
    RecruiterProfile,
)
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
from common.storage.r2 import public_media_storage

from ...seed_data.demo_job_catalog import CATALOG_JOBS, CATALOG_SCHEDULES, COMPANY_PERKS
from ...seed_data.demo_jobs import (
    BRAND_COMPANY_INDEXES,
    COMPANIES,
    DEMO_BRAND_COLOURS,
    DEMO_DOMAIN,
    DEMO_MEDIA_DIRECTORY,
    DEMO_VISIBILITY_DAYS,
    EDU_LEVELS,
    EMP_TYPES,
    EXP_YEARS,
    JOBS_BY_CATEGORY,
    LANGUAGE_CERTIFICATES,
    WORK_TYPES,
)

User = get_user_model()


def save_demo_image(name, size, colour, text=''):
    """Store a flat placeholder; the featured directory requires a logo and a cover."""
    image = Image.new('RGB', size, colour)
    if text:
        ImageDraw.Draw(image).text(
            (size[0] / 2, size[1] / 2),
            text,
            fill='white',
            font=ImageFont.load_default(size=size[1] // 2),
            anchor='mm',
        )
    buffer = BytesIO()
    image.save(buffer, format='PNG')
    storage = public_media_storage()
    path = f'{DEMO_MEDIA_DIRECTORY}/{name}.png'
    if storage.exists(path):
        storage.delete(path)
    return storage.save(path, ContentFile(buffer.getvalue()))


def accept_current_dpa(recruiter, now):
    """Đổi phiên bản DPA làm tin đã seed bị ẩn; ký lại bản hiện hành để tin hiện lại."""
    recruiter.dpa_accepted_at = now
    recruiter.dpa_policy_version = settings.EMPLOYER_DPA_POLICY_VERSION
    recruiter.dpa_document_sha256 = settings.EMPLOYER_DPA_DOCUMENT_SHA256
    recruiter.save(
        update_fields=['dpa_accepted_at', 'dpa_policy_version', 'dpa_document_sha256', 'updated_at']
    )


def approve_demo_representative(recruiter, now):
    """Give the owner the evidence of legal representation.

    Featured companies, indexable company pages and the page workspace all
    require an approved case with a current approved business registration;
    public jobs also require the current candidate-data DPA.
    """
    company = recruiter.company
    accept_current_dpa(recruiter, now)
    verification_case = EmployerVerificationCase.objects.create(
        recruiter=recruiter,
        company=company,
        verification_method=EmployerVerificationCase.VerificationMethod.BUSINESS_REGISTRATION,
        status=EmployerVerificationCase.Status.APPROVED,
        submitted_at=now,
        decided_at=now,
        decision_source=EmployerVerificationCase.DecisionSource.EXPLICIT_ADMIN,
        decision_reason='Dữ liệu demo.',
    )
    CompanyDocument.objects.create(
        company=company,
        recruiter=recruiter,
        uploaded_by=recruiter.user,
        verification_case=verification_case,
        doc_type=CompanyDocument.DocType.BUSINESS_REGISTRATION,
        # Metadata only: demo data has no real legal file behind it.
        file_url=f'{DEMO_MEDIA_DIRECTORY}/{company.slug}-business-registration.pdf',
        file_name='giay-dang-ky-doanh-nghiep.pdf',
        mime_type='application/pdf',
        status=CompanyDocument.Status.APPROVED,
        reviewed_at=now,
    )


def _demo_pin(ward, jitter):
    """Ghim giả quanh tâm phường (≤ ~800 m) để bản đồ "Việc làm gần bạn" có dữ liệu."""
    if ward.latitude is None:
        return {'coordinate_precision': JobLocation.Precision.PROVINCE}
    return {
        'latitude': round(ward.latitude + jitter.uniform(-0.007, 0.007), 6),
        'longitude': round(ward.longitude + jitter.uniform(-0.007, 0.007), 6),
        'coordinate_precision': JobLocation.Precision.EXACT,
        'coordinate_source': JobLocation.CoordinateSource.EMPLOYER_PIN,
    }


def _assign_category(job, category):
    JobCategoryAssignment.objects.create(
        job=job, category=category, role=JobCategoryAssignment.Role.PRIMARY_SPECIALIZATION
    )
    # Chuyên môn thuộc một "kiến thức chuyên ngành" -> gắn thêm tag domain.
    if category.parent and category.parent.category_type == JobCategory.CategoryType.DOMAIN:
        JobCategoryAssignment.objects.create(
            job=job, category=category.parent, role=JobCategoryAssignment.Role.DOMAIN_KNOWLEDGE
        )


def _visibility(published):
    return {
        'status': Job.Status.ACTIVE,
        'published_at': published,
        'requested_visibility_days': DEMO_VISIBILITY_DAYS,
        'first_approved_at': published,
        'visibility_starts_at': published,
        'visibility_ends_at': published + timedelta(days=DEMO_VISIBILITY_DAYS),
    }


def _html_list(items):
    return '<ul>' + ''.join(f'<li>{escape(item)}</li>' for item in items) + '</ul>'


def _catalog_salary(spec):
    """``('range', 15, 25)`` (triệu VND hoặc USD) -> (salary_type, salary_min, salary_max)."""
    kind, *amounts = spec['salary']
    unit = 1 if spec.get('currency') == Job.Currency.USD else 1_000_000
    amounts = [amount * unit for amount in amounts]
    if kind == Job.SalaryType.RANGE:
        return kind, amounts[0], amounts[1]
    if kind == Job.SalaryType.UP_TO:
        return kind, None, amounts[0]
    if kind == Job.SalaryType.NEGOTIABLE:
        return kind, None, None
    return kind, amounts[0], None  # fixed / from


def existing_demo_companies(now):
    emails = [f'company{i + 1}{DEMO_DOMAIN}' for i in range(len(COMPANIES))]
    owners = {
        recruiter.user.email: recruiter
        for recruiter in RecruiterProfile.objects.filter(user__email__in=emails).select_related(
            'user', 'company'
        )
    }
    if len(owners) != len(emails):
        raise CommandError('Chưa đủ công ty demo; chạy seed_demo_jobs không kèm cờ trước.')
    for recruiter in owners.values():
        accept_current_dpa(recruiter, now)
    return [(owners[email].user, owners[email].company) for email in emails]


def seed_catalog_jobs(companies, now):
    """Tạo các tin viết tay của ``CATALOG_JOBS``; tên kỹ năng/ngành/phúc lợi lạ bị bỏ qua."""
    rnd = random.Random(2026)
    jitter = random.Random(11)
    skills = {skill.name: skill for skill in Skill.objects.all()}
    benefits = {benefit.name: benefit for benefit in Benefit.objects.filter(is_active=True)}
    languages = {language.code: language for language in Language.objects.all()}
    categories = {
        c.name: c
        for c in JobCategory.objects.filter(parent__isnull=False, status='active').select_related(
            'parent'
        )
    }
    wards_by_province = {}

    for spec in CATALOG_JOBS:
        user, company = companies[spec['company']]
        salary_type, salary_min, salary_max = _catalog_salary(spec)
        work_types = spec.get('work', [Job.WorkType.ONSITE])
        schedule = CATALOG_SCHEDULES[spec.get('schedule', 'office')]
        age_min, age_max = spec.get('age', (None, None))
        published = now - timedelta(days=rnd.randint(0, 20), hours=rnd.randint(0, 23))
        job = Job.objects.create(
            posted_by=user,
            company=company,
            title=spec['title'],
            description=f'<p>{escape(spec["summary"])}</p>{_html_list(spec["tasks"])}',
            requirements=_html_list(spec['requirements']),
            benefits=_html_list(spec.get('perks', []) + COMPANY_PERKS[spec['company']]),
            application_reasons=spec.get('reasons', []),
            work_schedule_note=schedule.get('note', ''),
            work_type=work_types[0],
            work_types=work_types,
            employment_type=spec.get('employment', Job.EmploymentType.FULL_TIME),
            experience_years=spec['experience'],
            position_level=spec.get('level', Job.PositionLevel.EMPLOYEE),
            education_level=spec.get('education', Job.EducationLevel.UNIVERSITY),
            gender_requirement=spec.get('gender', Job.GenderRequirement.ANY),
            age_min=age_min,
            age_max=age_max,
            number_of_vacancies=spec.get('vacancies', 1),
            salary_type=salary_type,
            salary_min=salary_min,
            salary_max=salary_max,
            income_display_type=spec.get('income', Job.IncomeDisplayType.INCOME),
            currency=spec.get('currency', Job.Currency.VND),
            deadline=(now + timedelta(days=rnd.choice([10, 20, 30, 45]))).date(),
            **_visibility(published),
        )
        if category := categories.get(spec['category']):
            _assign_category(job, category)

        locations = []
        for province in spec['provinces']:
            if province not in wards_by_province:
                wards_by_province[province] = list(
                    Location.objects.filter(
                        level='ward', parent__name__endswith=f' {province}'
                    ).only('id', 'latitude', 'longitude')
                )
            if wards := wards_by_province[province]:
                ward = rnd.choice(wards)
                locations.append(
                    JobLocation(
                        job=job,
                        location=ward,
                        address_detail=f'Tầng {rnd.randint(1, 20)}, số {rnd.randint(1, 300)} đường Trung Tâm',
                        **_demo_pin(ward, jitter),
                    )
                )
        JobLocation.objects.bulk_create(locations)
        JobWorkSchedule.objects.bulk_create(
            [
                JobWorkSchedule(
                    job=job,
                    weekday_from=day_from,
                    weekday_to=day_to,
                    start_time=start,
                    end_time=end,
                    is_overnight=end < start,
                    note=note,
                    sort_order=index,
                )
                for index, (day_from, day_to, start, end, note) in enumerate(schedule['slots'])
            ]
        )
        JobBenefit.objects.bulk_create(
            [
                JobBenefit(job=job, benefit=benefits[name], sort_order=index)
                for index, name in enumerate(spec['benefits'])
                if name in benefits
            ]
        )
        JobSkill.objects.bulk_create(
            [
                JobSkill(job=job, skill=skills[name], importance=importance)
                for importance, key in (
                    (JobSkill.Importance.REQUIRED, 'skills'),
                    (JobSkill.Importance.PREFERRED, 'preferred_skills'),
                )
                for name in spec.get(key, [])
                if name in skills
            ]
        )
        JobLanguageRequirement.objects.bulk_create(
            [
                JobLanguageRequirement(
                    job=job,
                    language=languages[code],
                    proficiency_level=level,
                    certificate=certificate,
                    is_required=required,
                    sort_order=index,
                )
                for index, (code, level, certificate, required) in enumerate(
                    spec.get('languages', [])
                )
                if code in languages
            ]
        )
    return len(CATALOG_JOBS)


class Command(BaseCommand):
    help = 'Seed demo companies + active jobs (spread over recent days) for the homepage dashboard/demo. Re-runnable.'

    def add_arguments(self, parser):
        mode = parser.add_mutually_exclusive_group()
        mode.add_argument(
            '--clear', action='store_true', help='Only remove demo data, do not reseed.'
        )
        mode.add_argument(
            '--catalog-only',
            action='store_true',
            help='Chỉ tạo lại các tin của CATALOG_JOBS trên công ty demo đang có, giữ dữ liệu khác.',
        )

    def handle(self, *args, **options):
        # Tài khoản demo dùng mật khẩu có trong repo công khai. Production không được
        # tạo tài khoản: chỉ dọn (--clear) hoặc thêm tin cho công ty demo đã có
        # (--catalog-only, không tạo user nào).
        if settings.IS_PRODUCTION and not (options['clear'] or options['catalog_only']):
            raise CommandError('Không seed dữ liệu demo trên production.')
        now = timezone.now()
        if options['catalog_only']:
            companies = existing_demo_companies(now)
            removed = Job.objects.filter(
                posted_by__email__endswith=DEMO_DOMAIN,
                title__in=[spec['title'] for spec in CATALOG_JOBS],
            ).delete()[0]
            created = seed_catalog_jobs(companies, now)
            self.stdout.write(
                self.style.SUCCESS(f'Removed {removed} rows, seeded {created} catalog jobs.')
            )
            return
        removed = User.objects.filter(email__endswith=DEMO_DOMAIN).delete()[0]
        self.stdout.write(f'Removed old demo data ({removed} rows).')
        if options['clear']:
            self.stdout.write(self.style.SUCCESS('Demo data cleared.'))
            return

        benefits = list(Benefit.objects.filter(is_active=True))
        languages = list(Language.objects.filter(is_active=True))
        skills = list(Skill.objects.all())

        provinces = list(
            Location.objects.filter(
                level='province',
                name__in=[
                    'Thành phố Hà Nội',
                    'Thành phố Hồ Chí Minh',
                    'Thành phố Đà Nẵng',
                    'Thành phố Hải Phòng',
                    'Tỉnh Bắc Ninh',
                    'Tỉnh Hưng Yên',
                ],
            )
        )
        if not provinces:
            provinces = list(Location.objects.filter(level='province')[:6])
        wards = list(
            Location.objects.filter(level='ward', parent__in=provinces).select_related('parent')
        )

        top_cats = {c.name: c for c in JobCategory.objects.filter(parent__isnull=True)}
        children_of = {}
        for name, cat in top_cats.items():
            domains = list(JobCategory.objects.filter(parent=cat, status='active'))
            specializations = list(JobCategory.objects.filter(parent__in=domains, status='active'))
            children_of[name] = specializations or domains or [cat]

        rnd = random.Random(42)
        # Riêng một bộ sinh số cho tọa độ để không xáo trộn dữ liệu demo cũ (seed 42).
        jitter = random.Random(7)
        companies = []
        for i, (cname, size, industry) in enumerate(COMPANIES):
            user = User.objects.create_user(
                email=f'company{i + 1}{DEMO_DOMAIN}',
                password='demo12345',
                role=User.Role.EMPLOYER,
                full_name=cname,
                status=User.Status.ACTIVE,
            )
            colour = DEMO_BRAND_COLOURS[i % len(DEMO_BRAND_COLOURS)]
            company = Company.objects.create(
                company_name=cname,
                slug=f'{slugify(cname)}-demo-{i + 1}',
                company_size=size,
                description=(
                    f'<p>{cname} là doanh nghiệp hoạt động trong lĩnh vực {industry}, '
                    'liên tục mở rộng đội ngũ và tìm kiếm nhân sự phù hợp.</p>'
                ),
                logo_url=save_demo_image(
                    f'company-{i + 1}-logo', (400, 400), colour, slugify(cname)[:1].upper()
                ),
                cover_image_url=save_demo_image(f'company-{i + 1}-cover', (1200, 400), colour),
                # Vài công ty lớn bật trang thương hiệu để demo luồng URL /brand/...
                has_brand_page=i in BRAND_COMPANY_INDEXES,
                created_by=user,
            )
            industry_obj, _ = Industry.objects.get_or_create(name=industry)
            company.company_industries.create(industry=industry_obj, is_primary=True)
            recruiter = RecruiterProfile.objects.create(
                user=user,
                company=company,
                company_role=RecruiterProfile.CompanyRole.OWNER,
            )
            approve_demo_representative(recruiter, now)
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
                job = Job.objects.create(
                    posted_by=user,
                    company=company,
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
                    age_min=age_min,
                    age_max=age_max,
                    number_of_vacancies=rnd.choice([1, 2, 3, 5, 10]),
                    salary_type=salary_type,
                    salary_min=smin,
                    salary_max=smax,
                    deadline=(published + timedelta(days=rnd.choice([7, 15, 30, 45]))).date(),
                    **_visibility(published),
                )
                if category:
                    _assign_category(job, category)

                # Tin remote demo tối đa 1 văn phòng; tin thường 1-3 địa điểm.
                max_locations = 1 if work_type == 'remote' else min(3, len(wards))
                location_count = (
                    rnd.randint(0, max_locations)
                    if work_type == 'remote'
                    else rnd.randint(1, max_locations)
                )
                selected_wards = rnd.sample(wards, location_count) if wards else []
                JobLocation.objects.bulk_create(
                    [
                        JobLocation(
                            job=job,
                            location=ward,
                            address_detail=f'Tầng {rnd.randint(2, 15)}, tòa nhà số {rnd.randint(1, 200)} đường Trung Tâm',
                            **_demo_pin(ward, jitter),
                        )
                        for ward in selected_wards
                    ]
                )

                # 40% tin làm 2 ca để trang chi tiết render nhiều khung giờ.
                if rnd.random() < 0.4:
                    JobWorkSchedule.objects.create(
                        job=job,
                        weekday_from=1,
                        weekday_to=5,
                        start_time='06:00',
                        end_time='14:00',
                        note='Ca sáng',
                        sort_order=0,
                    )
                    JobWorkSchedule.objects.create(
                        job=job,
                        weekday_from=1,
                        weekday_to=6,
                        start_time='14:00',
                        end_time='22:00',
                        note='Ca chiều',
                        sort_order=1,
                    )
                else:
                    JobWorkSchedule.objects.create(
                        job=job,
                        weekday_from=1,
                        weekday_to=5,
                        start_time='08:00',
                        end_time='17:30',
                    )
                if rnd.random() < 0.3:
                    job.work_schedule_note = 'Nghỉ trưa 1 tiếng; có thể đăng ký OT theo dự án.'
                    job.save(update_fields=['work_schedule_note'])

                JobBenefit.objects.bulk_create(
                    [
                        JobBenefit(job=job, benefit=benefit, sort_order=index)
                        for index, benefit in enumerate(
                            rnd.sample(benefits, min(rnd.randint(3, 5), len(benefits)))
                        )
                    ]
                )
                # ~35% tin yêu cầu 1-2 ngoại ngữ (có chứng chỉ + mức ưu tiên) để test render.
                if languages and rnd.random() < 0.35:
                    for index, language in enumerate(
                        rnd.sample(languages, rnd.randint(1, min(2, len(languages))))
                    ):
                        JobLanguageRequirement.objects.create(
                            job=job,
                            language=language,
                            proficiency_level=rnd.choice(
                                ['basic', 'conversational', 'working', 'professional']
                            ),
                            certificate=LANGUAGE_CERTIFICATES.get(language.code, ''),
                            is_required=rnd.random() < 0.7,
                            sort_order=index,
                        )
                if skills:
                    JobSkill.objects.bulk_create(
                        [
                            JobSkill(
                                job=job,
                                skill=skill,
                                importance=JobSkill.Importance.REQUIRED
                                if rnd.random() < 0.7
                                else JobSkill.Importance.PREFERRED,
                            )
                            for skill in rnd.sample(skills, min(rnd.randint(2, 4), len(skills)))
                        ]
                    )
                job_count += 1

        job_count += seed_catalog_jobs(companies, now)
        self.stdout.write(
            self.style.SUCCESS(
                f'Seeded {len(companies)} demo companies and {job_count} active jobs.'
            )
        )
