"""Nhập hàng loạt tin tuyển dụng: kiểm tra từng dòng, chạy thử, ghi thật và chạy lại."""

from django.contrib.auth import get_user_model
from django.test import TestCase

from apps.employers.models import Company
from apps.employers.tests.readiness_helpers import make_employer_ready
from apps.locations.models import Location
from apps.skills.models import Skill

from ..models import Job, JobCategory, JobCategoryAssignment, JobSkill, Language
from ..services import import_job_postings
from ..services.bulk_import import rich_text_from_lines


class JobBulkImportTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.employer = get_user_model().objects.create_user(
            email='import-employer@example.com',
            password='password',
            role='employer',
            full_name='Người Đăng Tin',
        )
        cls.company = Company.objects.create(company_name='Import Co', created_by=cls.employer)
        make_employer_ready(cls.employer, company=cls.company)
        group = JobCategory.objects.create(
            name='Công nghệ thông tin', category_type=JobCategory.CategoryType.OCCUPATION_GROUP
        )
        cls.domain = JobCategory.objects.create(
            name='Lập trình Web', category_type=JobCategory.CategoryType.DOMAIN, parent=group
        )
        cls.specialization = JobCategory.objects.create(
            name='Backend Developer',
            category_type=JobCategory.CategoryType.SPECIALIZATION,
            parent=cls.domain,
        )
        Location.objects.create(
            code='import-province', level=Location.Level.PROVINCE, name='Thành phố Đà Nẵng'
        )
        Language.objects.get_or_create(name='Tiếng Anh', code='en')
        cls.python = Skill.objects.create(
            name='Python', normalized_name='python', aliases=['Python 3']
        )

    def row(self, **overrides):
        row = {
            'code': 'JD-001',
            'company': '',
            'title': 'Backend Developer (Python)',
            'specialization': 'Backend Developer',
            'domains': [],
            'position_level': 'Nhân viên',
            'experience_years': '2 năm',
            'education_level': 'Đại học',
            'work_type': 'Hybrid',
            'employment_type': 'Full-time',
            'province': 'Thành phố Đà Nẵng',
            'salary_min_million': '18',
            'salary_max_million': '30',
            'required_skills': ['Python 3'],
            'preferred_skills': [],
            'languages': [
                {
                    'language': 'Tiếng Anh',
                    'level': 'Giao tiếp',
                    'certificate': '',
                    'required': False,
                }
            ],
            'description': '- Phát triển dịch vụ backend\n- Viết kiểm thử tự động',
            'requirements': 'Ít nhất 2 năm kinh nghiệm Python',
            'benefits': '- Lương tháng 13',
        }
        row.update(overrides)
        return row

    def test_apply_publishes_a_complete_public_job(self):
        report = import_job_postings([self.row()], apply=True)

        self.assertEqual(report['summary'], {'total': 1, 'imported': 1, 'skipped': 0, 'errors': 0})
        job = Job.publicly_available_queryset().get(public_id=report['rows'][0]['job_public_id'])
        self.assertEqual((job.posted_by, job.company), (self.employer, self.company))
        self.assertEqual(
            (job.position_level, job.experience_years, job.education_level, job.work_types),
            ('employee', '2', 'university', ['hybrid']),
        )
        self.assertEqual(
            (job.salary_type, job.salary_min, job.salary_max),
            (Job.SalaryType.RANGE, 18_000_000, 30_000_000),
        )
        self.assertEqual(
            job.description,
            '<ul><li>Phát triển dịch vụ backend</li><li>Viết kiểm thử tự động</li></ul>',
        )
        roles = dict(job.category_assignments.values_list('role', 'category__name'))
        self.assertEqual(
            roles,
            {
                JobCategoryAssignment.Role.PRIMARY_SPECIALIZATION: 'Backend Developer',
                JobCategoryAssignment.Role.DOMAIN_KNOWLEDGE: 'Lập trình Web',
            },
        )
        self.assertEqual(
            list(job.job_skills.values_list('skill__name', 'importance')),
            [('Python', JobSkill.Importance.REQUIRED)],
        )
        requirement = job.language_requirements.get()
        self.assertEqual(
            (requirement.language.name, requirement.proficiency_level, requirement.is_required),
            ('Tiếng Anh', 'conversational', False),
        )
        self.assertEqual(job.job_locations.get().location.name, 'Thành phố Đà Nẵng')
        self.assertEqual(report['rows'][0]['slug'], job.slug)

    def test_dry_run_reports_the_same_result_without_writing(self):
        report = import_job_postings(
            [self.row(required_skills=['Python', 'Kế toán thuế'])], apply=False
        )

        self.assertFalse(report['applied'])
        self.assertEqual(report['rows'][0]['status'], 'imported')
        self.assertEqual(report['new_skills'], {'Kế toán thuế': 1})
        self.assertFalse(Job.objects.exists())
        self.assertFalse(Skill.objects.filter(normalized_name='kế toán thuế').exists())

    def test_unknown_skill_is_rejected_on_apply_unless_creation_is_allowed(self):
        row = self.row(required_skills=['Python'], preferred_skills=['Docker', 'python'])

        rejected = import_job_postings([row], apply=True)
        self.assertEqual(rejected['rows'][0]['status'], 'error')
        self.assertIn('Docker', rejected['rows'][0]['errors'][0])
        self.assertFalse(Job.objects.exists())

        created = import_job_postings([row], apply=True, create_missing_skills=True)
        job = Job.objects.get(public_id=created['rows'][0]['job_public_id'])
        # Kỹ năng lặp ở cả hai cột giữ mức bắt buộc.
        self.assertEqual(
            sorted(job.job_skills.values_list('skill__name', 'importance')),
            [('Docker', JobSkill.Importance.PREFERRED), ('Python', JobSkill.Importance.REQUIRED)],
        )

    def test_invalid_row_lists_every_problem_and_creates_nothing(self):
        report = import_job_postings(
            [
                self.row(
                    specialization='',
                    specialization_other='Kỹ sư Robot',
                    province='Sao Hỏa',
                    position_level='Junior',
                    salary_min_million='30',
                    salary_max_million='18',
                    domains=['Không có'],
                    languages=[{'language': 'Tiếng Đức', 'level': 'Giao tiếp'}],
                )
            ],
            apply=True,
        )

        errors = ' '.join(report['rows'][0]['errors'])
        for fragment in (
            'Kỹ sư Robot',
            'Sao Hỏa',
            'Cấp bậc',
            'Lương đến',
            'Không có',
            'Tiếng Đức',
        ):
            self.assertIn(fragment, errors)
        self.assertEqual(report['summary']['errors'], 1)
        self.assertFalse(Job.objects.exists())

    def test_new_skills_are_counted_per_posting_even_for_rejected_rows(self):
        report = import_job_postings(
            [
                self.row(required_skills=['Python', 'Docker'], preferred_skills=['docker']),
                self.row(code='JD-002', title='Tin khác', required_skills=['DOCKER', 'Redis']),
                self.row(code='JD-003', province='Sao Hỏa', required_skills=['Redis']),
            ],
            apply=False,
        )

        self.assertEqual(report['new_skills'], {'Docker': 2, 'Redis': 2})

    def test_rerun_skips_existing_job_and_duplicate_code_is_an_error(self):
        import_job_postings([self.row()], apply=True)

        report = import_job_postings(
            [self.row(), self.row(title='Tin khác'), self.row(code='JD-002', title='Tin thứ ba')],
            apply=True,
        )

        self.assertEqual(
            [entry['status'] for entry in report['rows']], ['skipped', 'error', 'imported']
        )
        self.assertIn('trùng', report['rows'][1]['errors'][0])
        self.assertEqual(Job.objects.count(), 2)

    def test_missing_benefits_and_salary_fall_back_with_a_warning(self):
        report = import_job_postings(
            [self.row(benefits='', salary_min_million='', salary_max_million='')], apply=True
        )

        job = Job.objects.get(public_id=report['rows'][0]['job_public_id'])
        self.assertEqual(job.salary_type, Job.SalaryType.NEGOTIABLE)
        self.assertEqual(job.benefits, '<p>Không nêu trong tin gốc.</p>')
        self.assertEqual(len(report['rows'][0]['warnings']), 1)

    def test_named_company_must_have_an_active_publisher(self):
        ok = import_job_postings([self.row(company='import co')], apply=True)
        missing = import_job_postings(
            [self.row(code='JD-002', title='Tin khác', company='Công ty lạ')], apply=True
        )

        self.assertEqual(ok['rows'][0]['company'], 'Import Co')
        self.assertIn('Công ty lạ', missing['rows'][0]['errors'][0])

    def test_variant_spelling_with_the_same_slug_reuses_the_existing_skill(self):
        report = import_job_postings(
            [self.row(required_skills=['Python!'])], apply=True, create_missing_skills=True
        )

        job = Job.objects.get(public_id=report['rows'][0]['job_public_id'])
        self.assertEqual(job.job_skills.get().skill, self.python)
        self.assertEqual(Skill.objects.count(), 1)

    def test_optional_workplace_fields_are_stored(self):
        report = import_job_postings(
            [
                self.row(
                    vacancies='3 người',
                    address_detail='Tầng 5,  18 Thái Hà\nĐống Đa',
                    work_schedule_note='Thứ 2 - Thứ 6 (từ 08:00 đến 17:00)',
                ),
                self.row(code='JD-002', title='Địa chỉ dài', address_detail='a' * 600),
                self.row(code='JD-003', title='Sai số lượng', vacancies='nhiều'),
            ],
            apply=True,
        )

        job = Job.objects.get(public_id=report['rows'][0]['job_public_id'])
        self.assertEqual(job.number_of_vacancies, 3)
        self.assertEqual(job.work_schedule_note, 'Thứ 2 - Thứ 6 (từ 08:00 đến 17:00)')
        self.assertEqual(job.job_locations.get().address_detail, 'Tầng 5, 18 Thái Hà Đống Đa')
        long_address = Job.objects.get(public_id=report['rows'][1]['job_public_id'])
        self.assertEqual(len(long_address.job_locations.get().address_detail), 500)
        self.assertEqual(len(report['rows'][1]['warnings']), 1)
        self.assertIn('Số lượng tuyển', report['rows'][2]['errors'][0])

    def test_salary_entered_in_dong_is_a_row_error(self):
        report = import_job_postings([self.row(salary_min_million='15000000')], apply=True)

        self.assertIn('triệu đồng', report['rows'][0]['errors'][0])
        self.assertFalse(Job.objects.exists())

    def test_company_owner_publishes_before_other_members(self):
        users = get_user_model().objects
        owner = users.create_user(
            email='import-owner@example.com', password='password', role='employer'
        )
        member = users.create_user(
            email='import-member@example.com', password='password', role='employer'
        )
        company = Company.objects.create(company_name='Second Co', created_by=owner)
        make_employer_ready(member, company=company)
        make_employer_ready(owner, company=company)

        report = import_job_postings([self.row(company='Second Co')], apply=True)

        job = Job.objects.get(public_id=report['rows'][0]['job_public_id'])
        self.assertEqual(job.posted_by, owner)

    def test_rich_text_keeps_bullets_and_escapes_markup(self):
        html = rich_text_from_lines('Giới thiệu <script>x</script>\n\n1. Một\n• Hai & ba\nKết')

        self.assertEqual(
            html,
            '<p>Giới thiệu &lt;script&gt;x&lt;/script&gt;</p>'
            '<ul><li>Một</li><li>Hai &amp; ba</li></ul><p>Kết</p>',
        )
